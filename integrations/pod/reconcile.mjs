import crypto from 'node:crypto';
import {verifyEnvelope} from './policy.mjs';

// An authenticated provider observer must confirm the listing; submit success is insufficient.
export async function reconcilePublication(db,envelope,key){
 const e=verifyEnvelope(envelope,key,'content-control:pod:listing-observation');
 if(e.status!=='LIVE'||e.provider_verified!==true||
  !['job_id','account_id','platform','provider_id','provider_event_id'].every(k=>typeof e[k]==='string'&&e[k].trim().length>0&&e[k].length<=256)||
  !/^[a-f0-9]{64}$/.test(e.package_sha256||'')||!/^[a-f0-9]{64}$/.test(e.evidence_sha256||''))throw Error('LISTING_EVIDENCE_REQUIRED');
 return db.tx(async c=>{
  const job=(await c.query('SELECT * FROM pod_production_queue WHERE id=$1 FOR UPDATE',[e.job_id])).rows[0];
  if(!job||job.account_id!==e.account_id||job.platform!==e.platform||job.manifest?.package_sha256!==e.package_sha256||
   !['submitted','ambiguous','published'].includes(job.state)||(job.provider_id&&job.provider_id!==e.provider_id))throw Error('LISTING_SCOPE_INVALID');
  const artifact=await c.query('SELECT 1 FROM pod_artifacts WHERE sha256=$1',[e.evidence_sha256]);
  if(!artifact.rowCount)throw Error('LISTING_EVIDENCE_MISSING');
  const seen=await c.query('SELECT evidence_sha256,payload FROM pod_provider_inbox WHERE provider=$1 AND account_id=$2 AND provider_event_id=$3',[e.platform,e.account_id,e.provider_event_id]);
  if(seen.rowCount){
   const previous=seen.rows[0];
   // Refreshed envelope times may differ, but the observed listing and its proof
   // must remain identical. A shared evidence file does not identify one job.
   const scope=['job_id','account_id','platform','provider_id','provider_event_id','package_sha256','status','provider_verified','evidence_sha256'];
   if(previous.evidence_sha256!==e.evidence_sha256||!scope.every(k=>previous.payload?.[k]===e[k]))throw Error('LISTING_REPLAY_CONFLICT');
   return {duplicate:true};
  }
  await c.query('INSERT INTO pod_provider_inbox(provider,account_id,provider_event_id,evidence_sha256,payload) VALUES($1,$2,$3,$4,$5)',[e.platform,e.account_id,e.provider_event_id,e.evidence_sha256,e]);
  // A fresh observation is new evidence, not another publication transition.
  // The job row lock serializes concurrent observations with different event IDs.
  if(job.state==='published')return {published:true,already_published:true};
  await c.query("UPDATE pod_production_queue SET state='published',provider_id=$2,lease_until=NULL,updated_at=now() WHERE id=$1",[e.job_id,e.provider_id]);
  await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),e.job_id,'pod.published',{provider_id:e.provider_id,evidence_sha256:e.evidence_sha256}]);
  return {published:true};
 });
}

