import crypto from 'node:crypto';
import {types as utilTypes} from 'node:util';
import {verifyEnvelope} from './policy.mjs';
import {assertStoredEvidence} from './stored-evidence.mjs';
import {validEvidenceTime} from './evidence-time.mjs';
import {validOpaqueText} from './text-identity.mjs';

const REPLAY_FIELDS=Object.freeze(['id','job_id','provider','provider_event_id','kind','amount_minor','currency',
 'evidence_sha256','authority_event_id','occurred_at_matches']);
const TOTAL_FIELDS=Object.freeze(['currency','verified_net_recorded_minor','evidence_count']);
const MAX_CURRENCIES=26**3;
const canonicalUnsigned=value=>typeof value==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(value);
const canonicalSignedTotal=value=>typeof value==='string'&&/^(0|-?[1-9][0-9]{0,38})$/.test(value);
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  const descriptor=Object.getOwnPropertyDescriptor(target,key);
  return descriptor&&Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
 }catch{return {valid:false};}
}
function ordinaryRecord(value){
 try{
  return value!==null&&(typeof value==='object'||typeof value==='function')&&!utilTypes.isProxy(value)&&
   [Object.prototype,null].includes(Object.getPrototypeOf(value));
 }catch{return false;}
}
function inertQueryResult(value){
 return value!==null&&(typeof value==='object'||typeof value==='function')&&!utilTypes.isProxy(value);
}
function snapshotMutationCount(result){
 if(!inertQueryResult(result))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 const count=dataProperty(result,'rowCount');
 if(!count.valid||!Number.isSafeInteger(count.value)||count.value<0||count.value>1)throw Error('FINANCIAL_QUERY_UNVERIFIED');
 return count.value;
}
function verifyAuditMutation(result,expected){
 if(!inertQueryResult(result))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||count.value!==1||!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))
  throw Error('FINANCIAL_QUERY_UNVERIFIED');
 let length,rowDescriptor;
 try{
  const lengthDescriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  length=lengthDescriptor&&Object.hasOwn(lengthDescriptor,'value')?lengthDescriptor.value:null;
  rowDescriptor=Object.getOwnPropertyDescriptor(rows.value,'0');
 }catch{throw Error('FINANCIAL_QUERY_UNVERIFIED');}
 if(length!==1||!rowDescriptor||!Object.hasOwn(rowDescriptor,'value')||!ordinaryRecord(rowDescriptor.value))
  throw Error('FINANCIAL_QUERY_UNVERIFIED');
 for(const field of ['id','job_id','kind']){
  const capability=dataProperty(rowDescriptor.value,field);
  if(!capability.valid||capability.value!==expected[field])throw Error('FINANCIAL_QUERY_UNVERIFIED');
 }
}
function snapshotReplayRows(result){
 if(!inertQueryResult(result))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||descriptor.value>2)throw Error();
  length=descriptor.value;
 }catch{throw Error('FINANCIAL_QUERY_UNVERIFIED');}
 const snapshots=[];
 for(let index=0;index<length;index++){
  let element;
  try{element=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('FINANCIAL_QUERY_UNVERIFIED');}
  if(!element||!Object.hasOwn(element,'value')||!ordinaryRecord(element.value))throw Error('FINANCIAL_QUERY_UNVERIFIED');
  const snapshot={};
  for(const field of REPLAY_FIELDS){
   const capability=dataProperty(element.value,field);
   if(!capability.valid||utilTypes.isProxy(capability.value))throw Error('FINANCIAL_QUERY_UNVERIFIED');
   snapshot[field]=capability.value;
  }
  snapshots.push(Object.freeze(snapshot));
 }
 return Object.freeze(snapshots);
}
function snapshotFinancialTotals(result){
 if(!inertQueryResult(result))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('FINANCIAL_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||
   descriptor.value>MAX_CURRENCIES)throw Error();
  length=descriptor.value;
 }catch{throw Error('FINANCIAL_QUERY_UNVERIFIED');}
 const snapshots=[],currencies=new Set();
 for(let index=0;index<length;index++){
  let element;
  try{element=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('FINANCIAL_QUERY_UNVERIFIED');}
  if(!element||!Object.hasOwn(element,'value')||!ordinaryRecord(element.value))throw Error('FINANCIAL_QUERY_UNVERIFIED');
  const snapshot={};
  for(const field of TOTAL_FIELDS){
   const capability=dataProperty(element.value,field);
   if(!capability.valid||typeof capability.value!=='string')throw Error('FINANCIAL_QUERY_UNVERIFIED');
   snapshot[field]=capability.value;
  }
  if(!/^[A-Z]{3}$/.test(snapshot.currency)||!canonicalSignedTotal(snapshot.verified_net_recorded_minor)||
   !canonicalUnsigned(snapshot.evidence_count)||snapshot.evidence_count==='0'||currencies.has(snapshot.currency))
   throw Error('FINANCIAL_QUERY_UNVERIFIED');
  currencies.add(snapshot.currency);snapshots.push(Object.freeze(snapshot));
 }
 return Object.freeze(snapshots);
}

export async function recordFinancialEvent(db,envelope,key){
 const e=verifyEnvelope(envelope,key,'content-control:pod:finance');
 if(e.verified!==true||!['authority_event_id','provider_event_id','provider','job_id'].every(k=>validOpaqueText(e[k]))||
  !Number.isSafeInteger(e.amount_minor)||!['royalty','refund','fee','production_cost','generation_cost','tax','adjustment'].includes(e.kind)||
  !/^[A-Z]{3}$/.test(e.currency)||!validEvidenceTime(e.occurred_at)||
  typeof e.evidence_sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.evidence_sha256))throw Error('FINANCIAL_EVIDENCE_REQUIRED');
 if((e.kind==='royalty'&&e.amount_minor<0)||(['refund','fee','production_cost','generation_cost','tax'].includes(e.kind)&&e.amount_minor>0))throw Error('FINANCIAL_SIGN_INVALID');
 return db.tx(async c=>{
  await assertStoredEvidence(c,[e.evidence_sha256],'FINANCIAL_EVIDENCE_MISSING');
  db.active();
  const id=crypto.randomUUID();
  const result=await c.query(`INSERT INTO pod_financial_events(id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
   [id,e.job_id,e.provider,e.provider_event_id,e.kind,e.amount_minor,e.currency,e.occurred_at,e.evidence_sha256,e.authority_event_id]);
  db.active();
  if(snapshotMutationCount(result)===0){
   // Both identities must resolve to exactly the same immutable event. A new
   // provider ID cannot turn one authoritative event into additional income.
   // pg's Date decoder loses microseconds. Compare the original parameter in
   // PostgreSQL so sub-millisecond changes cannot masquerade as exact retries.
   const matches=snapshotReplayRows(await c.query(`SELECT id,job_id,provider,provider_event_id,kind,amount_minor,currency,
    evidence_sha256,authority_event_id,occurred_at=$4::timestamptz AS occurred_at_matches
    FROM pod_financial_events WHERE (provider=$1 AND provider_event_id=$2) OR authority_event_id=$3`,
    [e.provider,e.provider_event_id,e.authority_event_id,e.occurred_at]));
   db.active();
   const previous=matches[0];
   if(matches.length!==1||!['job_id','provider','provider_event_id','kind','currency','evidence_sha256','authority_event_id'].every(k=>previous[k]===e[k])||
    String(previous.amount_minor)!==String(e.amount_minor)||previous.occurred_at_matches!==true)throw Error('FINANCIAL_REPLAY_CONFLICT');
   verifyEnvelope(envelope,key,'content-control:pod:finance');
   return {id:previous.id,duplicate:true};
  }
  const audit={id:crypto.randomUUID(),job_id:e.job_id,kind:'pod.finance.verified'};
  verifyAuditMutation(await c.query(`INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)
   RETURNING id,job_id,kind`,[audit.id,audit.job_id,audit.kind,
   {financial_event_id:id,authority_event_id:e.authority_event_id}]),audit);
  db.active();
  verifyEnvelope(envelope,key,'content-control:pod:finance');
  return {id,duplicate:false};
 });
}
export async function financialTotals(db){
 return snapshotFinancialTotals(await db.read(`SELECT currency,sum(amount_minor)::text AS verified_net_recorded_minor,count(*)::text AS evidence_count
  FROM pod_financial_events GROUP BY currency ORDER BY currency`));
}

