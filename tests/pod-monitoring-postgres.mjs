import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {metrics} from '../integrations/pod/metrics.mjs';
import {productionActivity} from '../integrations/pod/capacity.mjs';

// Run before other queue fixtures. No live credentials, account or market calls.
export async function verifyMonitoring(pool,bridge){
 const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID(),event=crypto.randomUUID(),late=crypto.randomUUID();
 const invalidLeases=[['processing',null],['publishing','infinity'],['publishing','-infinity']]
  .map(([state,lease])=>({id:crypto.randomUUID(),account:crypto.randomUUID(),state,lease}));
 const accounts=[account,...invalidLeases.map(x=>x.account)];
 const expiresAt=Date.now()+3600000;let checked=false;
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'monitor-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) SELECT id,'redbubble' FROM unnest($1::uuid[]) AS account(id)",[accounts]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,lease_until)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'processing',clock_timestamp()-interval '1 second')`,[job,concept,account,crypto.randomUUID()]);
  for(const [index,{id,account:fixtureAccount,state,lease}] of invalidLeases.entries())await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,lease_until,attempt,fencing_token)
   VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,$6,$7::timestamptz,1,7)`,
   [id,concept,fixtureAccount,index+2,crypto.randomUUID(),state,lease]);
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload,created_at) VALUES($1,$2,'pod.fixture','{\"private\":\"do-not-report\"}',clock_timestamp()-interval '20 minutes')",[event,job]);
  const db=new PodDB({bridge,expiresAt:new Date(expiresAt).toISOString(),pool:{connect:async()=>{
   const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,args)=>{
    const result=await client.query(sql,args);
    if((typeof sql==='string'?sql:sql.text).startsWith('SELECT platform')&&!checked){
     checked=true;
     assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
     assert.equal((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'repeatable read');
     await client.query('SAVEPOINT diagnostic_write_test');
     await assert.rejects(client.query("UPDATE pod_concepts SET business_id='forbidden-fixture-write' WHERE id=$1",[concept]),e=>e.code==='25006');
     await client.query('ROLLBACK TO SAVEPOINT diagnostic_write_test');
     await pool.query("UPDATE pod_production_queue SET state='qa_failed',reason_code='QA_FAILED' WHERE id=$1",[job]);
     await pool.query("INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,'pod.fixture.later','{}')",[late,job]);
    }
    return result;
   }};
  }}});
  const report=await metrics(db,{env:{POD_ARTIFACT_BUDGET_BYTES:'100'}});
  assert.equal(checked,true);assert.equal(report.health.storage.lifetime,'BLOCKED');
  assert.equal(report.health.expired_leases,'1');assert.equal(report.health.outbox.pending,'1');
  assert.equal(report.health.unverified_leases,'3');
  assert.equal(report.incident_count,'0');assert.equal(report.queues.find(q=>q.state==='processing').count,'2');
  assert.ok(report.health.alerts.some(a=>a.code==='UNVERIFIED_WORKER_LEASES'));
  assert.ok(report.health.alerts.some(a=>a.code==='OUTBOX_DELIVERY_OVERDUE'));
  const text=JSON.stringify(report);for(const secret of [job,event,late,concept,...invalidLeases.map(x=>x.id),'do-not-report'])assert.equal(text.includes(secret),false);
  assert.equal(report.publication_enabled,false);assert.equal(report.health.acceptance_verified,false);
  // Force an actual aborted read-only transaction after collecting valid rows.
  // PostgreSQL resolves COMMIT with ROLLBACK; neither report may return success.
  for(const run of [metrics,productionActivity]){
   let commitTag,discarded;
   const fault={expiresAt,pool:{connect:async()=>{
    const client=await pool.connect();
    return {release:bad=>{discarded=bad;client.release(bad);},query:async(...args)=>{
     if(args[0]==='COMMIT')await assert.rejects(client.query('SELECT 1/0'),error=>error.code==='22012');
     const result=await client.query(...args);
     if(args[0]==='COMMIT')commitTag=result.command;
     return result;
    }};
   }}};
   await assert.rejects(run(fault),/^Error: POD_COMMIT_UNVERIFIED$/);
   assert.equal(commitTag,'ROLLBACK');assert.equal(discarded,true);
  }
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[job])).rows[0].state,'qa_failed');
  assert.equal((await pool.query('SELECT business_id FROM pod_concepts WHERE id=$1',[concept])).rows[0].business_id,'monitor-fixture');
  await assert.rejects(db.recover(),/POD_STORAGE_EXPIRING/);
  assert.equal(db.expiresAt,expiresAt);
  const writable=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
  await writable.recover();
  for(const {id,state,lease} of invalidLeases){
   const held=(await pool.query('SELECT state,reason_code,lease_until::text,attempt,fencing_token FROM pod_production_queue WHERE id=$1',[id])).rows[0];
   assert.deepEqual(held,{state:state==='processing'?'blocked':'ambiguous',
    reason_code:state==='processing'?'PRODUCTION_LEASE_UNVERIFIED':'PUBLISH_LEASE_UNVERIFIED',
    lease_until:lease,attempt:1,fencing_token:'7'});
  }
  await writable.recover();
  const heldReport=await metrics(writable);
  assert.equal(heldReport.health.expired_leases,'0');assert.equal(heldReport.health.unverified_leases,'3');
  assert.equal(heldReport.incident_count,'4');
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=$1',[job]);
  await pool.query('DELETE FROM pod_production_queue WHERE account_id=ANY($1::uuid[])',[accounts]);
  await pool.query('DELETE FROM pod_accounts WHERE id=ANY($1::uuid[])',[accounts]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 }
}
