import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

export async function verifyFailureReasons(pool,bridge){
 const id=crypto.randomUUID(),concept=crypto.randomUUID(),account=crypto.randomUUID(),business=crypto.randomUUID();
 const upstreamKey='synthetic-upstream-'.repeat(3),qaKey='synthetic-qa-'.repeat(4);
 const db=new PodDB({pool,bridge,upstreamKey,qaKey,expiresAt:'2099-01-01T00:00:00Z'});
 const brief={id,account_id:account,business_id:business,platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const job={id,platform:'redbubble',fencing_token:1};
 const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)};
 const sign=(audience,key,fields)=>{
  const payload=JSON.stringify({schema_version:1,audience,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...fields});
  return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 };
 const grant=()=>sign('content-control:pod',upstreamKey,{job_id:id,account_id:account,business_id:business,
  platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const qa=pass=>sign('content-control:pod:qa',qaKey,{verdict:pass?'PASS':'FAIL',...manifest,
  checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight'].map(k=>[k,pass]))});
 const row=async()=> (await pool.query('SELECT state,reason_code FROM pod_production_queue WHERE id=$1',[id])).rows[0];
 const processing=async()=>pool.query("UPDATE pod_production_queue SET state='processing',reason_code='REVIEW_REQUIRED',lease_until=clock_timestamp()+interval '5 minutes' WHERE id=$1",[id]);
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,business,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,attempt,fencing_token,lease_until)
   VALUES($1,$2,$3,'redbubble',1,$4,'{}',$5,'processing',1,1,clock_timestamp()+interval '5 minutes')`,[id,concept,account,brief,crypto.randomUUID()]);
  await db.failProduction(job,'NATIVE_RESOLUTION_INSUFFICIENT');
  assert.deepEqual(await row(),{state:'qa_failed',reason_code:'NATIVE_RESOLUTION_INSUFFICIENT'});
  await db.requeueRepair(id,grant());
  assert.deepEqual(await row(),{state:'raw',reason_code:null});
  const event=(await pool.query("SELECT payload FROM pod_events WHERE job_id=$1 AND kind='pod.repair.archived'",[id])).rows[0].payload;
  assert.equal(event.reason_code,'NATIVE_RESOLUTION_INSUFFICIENT');assert.equal(event.attempt,1);
  await processing();await db.failProduction(job,'private connection details');
  assert.deepEqual(await row(),{state:'qa_failed',reason_code:'PRODUCTION_BLOCKED'});
  await processing();assert.deepEqual(await db.completeProduction(job,manifest,qa(false)),{pass:false});
  assert.deepEqual(await row(),{state:'qa_failed',reason_code:'QA_FAILED'});
  await assert.rejects(db.acceptReview(id,qa(true)),/REVIEW_NOT_PENDING/);
  await pool.query('UPDATE pod_production_queue SET attempt=3 WHERE id=$1',[id]);
  await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  assert.deepEqual(await row(),{state:'qa_failed',reason_code:'QA_FAILED'});
  await processing();assert.deepEqual(await db.completeProduction(job,manifest,qa(true)),{pass:true});
  assert.deepEqual(await row(),{state:'qa_passed',reason_code:null});
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=$1',[id]);
  await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[id]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
 }
}
