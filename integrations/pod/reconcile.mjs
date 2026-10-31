import crypto from 'node:crypto';
import {types as utilTypes} from 'node:util';
import {PLATFORMS,verifyEnvelope} from './policy.mjs';
import {assertStoredEvidence} from './stored-evidence.mjs';
import {validOpaqueText} from './text-identity.mjs';

const LISTING_FIELDS=Object.freeze(['account_id','evidence_sha256','job_id','package_sha256','platform',
 'provider_event_id','provider_id','provider_verified','status']);
const JOB_FIELDS=Object.freeze(['account_id','lease_until','manifest','platform','provider_id','reason_code','state']);
const INBOX_FIELDS=Object.freeze(['evidence_sha256','payload']);
const SIGNED_LISTING_FIELDS=Object.freeze([...LISTING_FIELDS,'audience','expires_at_ms','issued_at_ms','schema_version'].sort());
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  let current=target;
  while(current!==null){
   if(utilTypes.isProxy(current))return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(descriptor)return Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
   current=Object.getPrototypeOf(current);
  }
  return {valid:true,value:undefined};
 }catch{return {valid:false};}
}
function snapshotRecord(value,fields){
 let prototype;
 try{prototype=Object.getPrototypeOf(value);}catch{throw Error('LISTING_QUERY_UNVERIFIED');}
 if(value===null||(typeof value!=='object'&&typeof value!=='function')||utilTypes.isProxy(value)||
  (prototype!==Object.prototype&&prototype!==null))throw Error('LISTING_QUERY_UNVERIFIED');
 const snapshot={};
 for(const field of fields){
  const capability=dataProperty(value,field);
  if(!capability.valid||utilTypes.isProxy(capability.value))throw Error('LISTING_QUERY_UNVERIFIED');
  snapshot[field]=capability.value;
 }
 return Object.freeze(snapshot);
}
function snapshotQueryRows(result,fields,maxRows){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('LISTING_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!Object.hasOwn(descriptor||{},'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||
   descriptor.value>maxRows)throw Error();
  length=descriptor.value;
 }catch{throw Error('LISTING_QUERY_UNVERIFIED');}
 const snapshots=[];
 for(let index=0;index<length;index++){
  let descriptor;
  try{descriptor=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('LISTING_QUERY_UNVERIFIED');}
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('LISTING_QUERY_UNVERIFIED');
  snapshots.push(snapshotRecord(descriptor.value,fields));
 }
 return Object.freeze(snapshots);
}
function exactListingObservation(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
  JSON.stringify(Object.keys(value).sort())===JSON.stringify(SIGNED_LISTING_FIELDS);
}

// An authenticated provider observer must confirm the listing; submit success is insufficient.
export async function reconcilePublication(db,envelope,key){
 const e=verifyEnvelope(envelope,key,'content-control:pod:listing-observation');
 if(!exactListingObservation(e)||e.status!=='LIVE'||e.provider_verified!==true||!PLATFORMS.includes(e.platform)||
  !['job_id','account_id','platform','provider_id','provider_event_id'].every(k=>validOpaqueText(e[k]))||
  !/^[a-f0-9]{64}$/.test(e.package_sha256||'')||!/^[a-f0-9]{64}$/.test(e.evidence_sha256||''))throw Error('LISTING_EVIDENCE_REQUIRED');
 const evidence=Object.fromEntries(LISTING_FIELDS.map(field=>[field,e[field]]));
 return db.tx(async c=>{
  const jobRow=snapshotQueryRows(await c.query('SELECT * FROM pod_production_queue WHERE id=$1 FOR UPDATE',[e.job_id]),JOB_FIELDS,1)[0];
  const job=jobRow?Object.freeze({...jobRow,package_sha256:snapshotRecord(jobRow.manifest,['package_sha256']).package_sha256}):null;
  db.active();
  if(!job||job.account_id!==e.account_id||job.platform!==e.platform||job.package_sha256!==e.package_sha256||
   !['submitted','ambiguous','published'].includes(job.state)||
   (job.state==='published'?(job.provider_id!==e.provider_id||job.reason_code!=null||job.lease_until!=null):
    job.provider_id!=null&&job.provider_id!==e.provider_id))throw Error('LISTING_SCOPE_INVALID');
  await assertStoredEvidence(c,[e.evidence_sha256],'LISTING_EVIDENCE_MISSING');
  db.active();
  const seen=snapshotQueryRows(await c.query('SELECT evidence_sha256,payload FROM pod_provider_inbox WHERE provider=$1 AND account_id=$2 AND provider_event_id=$3',[e.platform,e.account_id,e.provider_event_id]),INBOX_FIELDS,1);
  db.active();
  if(seen.length){
   const previous=seen[0],previousPayload=snapshotRecord(previous.payload,LISTING_FIELDS);
   // Refreshed envelope times may differ, but the observed listing and its proof
   // must remain identical. A shared evidence file does not identify one job.
   if(previous.evidence_sha256!==e.evidence_sha256||!LISTING_FIELDS.every(k=>previousPayload[k]===e[k]))throw Error('LISTING_REPLAY_CONFLICT');
   // The inbox insert and published transition commit atomically. A retained
   // event attached to any other queue state is corruption, not a safe retry.
   if(job.state!=='published')throw Error('LISTING_REPLAY_STATE_INVALID');
   verifyEnvelope(envelope,key,'content-control:pod:listing-observation');
   return {duplicate:true};
  }
  await c.query('INSERT INTO pod_provider_inbox(provider,account_id,provider_event_id,evidence_sha256,payload) VALUES($1,$2,$3,$4,$5)',[e.platform,e.account_id,e.provider_event_id,e.evidence_sha256,evidence]);
  db.active();
  // A fresh observation is new evidence, not another publication transition.
  // The job row lock serializes concurrent observations with different event IDs.
  if(job.state==='published'){verifyEnvelope(envelope,key,'content-control:pod:listing-observation');return {published:true,already_published:true};}
  await c.query("UPDATE pod_production_queue SET state='published',provider_id=$2,reason_code=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[e.job_id,e.provider_id]);
  db.active();
  await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),e.job_id,'pod.published',{provider_id:e.provider_id,evidence_sha256:e.evidence_sha256}]);
  db.active();
  verifyEnvelope(envelope,key,'content-control:pod:listing-observation');
  return {published:true};
 });
}

