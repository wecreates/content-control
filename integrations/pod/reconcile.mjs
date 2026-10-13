import crypto from 'node:crypto';
import {verifyEnvelope} from './policy.mjs';

// An authenticated provider observer must confirm the listing; submit success is insufficient.
export async function reconcilePublication(db,envelope,key){
 const e=verifyEnvelope(envelope,key,'content-control:pod:listing-observation');
 if(e.status!=='LIVE'||e.provider_verified!==true||!e.provider_id||!e.provider_event_id||!/^[a-f0-9]{64}$/.test(e.evidence_sha256||''))throw Error('LISTING_EVIDENCE_REQUIRED');
 return db.tx(async c=>{
  const job=(await c.query('SELECT * FROM pod_production_queue WHERE id=$1 FOR UPDATE',[e.job_id])).rows[0];
  if(!job||job.account_id!==e.account_id||job.platform!==e.platform||job.manifest?.package_sha256!==e.package_sha256||
   !['submitted','ambiguous','published'].includes(job.state)||(job.provider_id&&job.provider_id!==e.provider_id))throw Error('LISTING_SCOPE_INVALID');
  const artifact=await c.query('SELECT 1 FROM pod_artifacts WHERE sha256=$1',[e.evidence_sha256]);
  if(!artifact.rowCount)throw Error('LISTING_EVIDENCE_MISSING');
  const seen=await c.query('SELECT evidence_sha256 FROM pod_provider_inbox WHERE provider=$1 AND account_id=$2 AND provider_event_id=$3',[e.platform,e.account_id,e.provider_event_id]);
  if(seen.rowCount){if(seen.rows[0].evidence_sha256!==e.evidence_sha256)throw Error('LISTING_REPLAY_CONFLICT');return {duplicate:true};}
  await c.query('INSERT INTO pod_provider_inbox(provider,account_id,provider_event_id,evidence_sha256,payload) VALUES($1,$2,$3,$4,$5)',[e.platform,e.account_id,e.provider_event_id,e.evidence_sha256,e]);
  await c.query("UPDATE pod_production_queue SET state='published',provider_id=$2,lease_until=NULL,updated_at=now() WHERE id=$1",[e.job_id,e.provider_id]);
  await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),e.job_id,'pod.published',{provider_id:e.provider_id,evidence_sha256:e.evidence_sha256}]);
  return {published:true};
 });
}
