import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Invoked only by the existing disposable-PostgreSQL integration test after
// migrations. No production connection, authority or fixture approval is used.
export async function verifyAuthorityExpiry(pool,bridge){
 const key='synthetic-database-authority-key-'.repeat(2);
 for(const kind of ['new-intake','duplicate-intake','adverse-intake','enqueue','repair','revoked-repair']){
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),jobId=crypto.randomUUID();
  const fingerprint=crypto.randomUUID(),business=crypto.randomUUID(),intake=kind.endsWith('intake');
  const repair=kind.endsWith('repair'),revoked=kind==='revoked-repair';
  const brief={id:jobId,business_id:business,account_id:account,platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
  const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)},previousQA={fixture:'previous-review'},previousGrant={fixture:'previous-grant'};
  if(kind!=='new-intake')await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,business,fingerprint]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state) VALUES($1,'redbubble','ACTIVE')",[account]);
  if(repair)await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,attempt,manifest,qa_envelope)
   VALUES($1,$2,$3,'redbubble',1,$4,$5,$6,'qa_failed',1,$7,$8)`,
   [jobId,concept,account,brief,previousGrant,crypto.randomUUID(),manifest,previousQA]);
  const blocker=await pool.connect(),originalNow=Date.now,issued=originalNow();let now=issued,pending,workerPid;
  Date.now=()=>now;
  const payload=JSON.stringify({schema_version:1,issued_at_ms:issued-1,expires_at_ms:issued+(revoked?60000:1000),
   audience:intake?'content-control:pod:intake':'content-control:pod',
   ...(intake?{concept_id:concept,business_id:business,fingerprint,rights_state:kind==='adverse-intake'?'UNKNOWN':'PASS'}:
    {job_id:jobId,business_id:business,account_id:account,platform:'redbubble',max_mode:'PRELAUNCH',revoked:false,
     production_permission:true,publication_permission:false})});
  const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const db=new PodDB({pool:{connect:async()=>{
   const client=await pool.connect();workerPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return client;
  }},bridge,upstreamKey:key,expiresAt:new Date(issued+7*86400000).toISOString()});
  try{
   await blocker.query('BEGIN');
   if(intake)await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[fingerprint]);
   else await blocker.query('SELECT id FROM pod_concepts WHERE id=$1 FOR UPDATE',[concept]);
   pending=(intake?db.registerIntake({id:concept,businessId:business,envelope,intakeKey:key}):
    repair?db.requeueRepair(jobId,envelope):db.enqueue({job:brief,upstream:envelope,conceptId:concept,revision:1}))
    .then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let attempt=0;attempt<100;attempt++){
    if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
    if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.equal(waiting,true,kind+' reached the database barrier');
   if(revoked)await blocker.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
   else now=issued+1000;
   await blocker.query('COMMIT');
   assert.equal((await pending).error?.message,revoked?'REPAIR_BLOCKED':'ENVELOPE_EXPIRED_OR_INVALID',kind);
   const jobs=(await pool.query('SELECT state,manifest,qa_envelope,upstream_envelope,attempt FROM pod_production_queue WHERE id=$1',[jobId])).rows;
   assert.deepEqual(jobs,repair?[{state:'qa_failed',manifest,qa_envelope:previousQA,upstream_envelope:previousGrant,attempt:1}]:[],kind+' queue rollback');
   const concepts=(await pool.query('SELECT rights_state,permanently_unpublished FROM pod_concepts WHERE id=$1',[concept])).rows;
   assert.deepEqual(concepts,kind==='new-intake'?[]:[{rights_state:revoked?'UNKNOWN':'PASS',permanently_unpublished:revoked}],kind+' rights preserved');
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_daily_concept_budget WHERE business_id=$1',[business])).rows[0].n,0,kind+' budget rollback');
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 OR payload->>'concept_id'=$2",[jobId,concept])).rows[0].n,0,kind+' no event');
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[jobId]);
   await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
   await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  }finally{Date.now=originalNow;await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;}
 }
}
