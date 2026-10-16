import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {metrics} from '../integrations/pod/metrics.mjs';

// Run before other queue fixtures. No live credentials, account or market calls.
export async function verifyMonitoring(pool,bridge){
 const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID(),event=crypto.randomUUID(),late=crypto.randomUUID();
 const expiresAt=Date.now()+3600000;let checked=false;
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'monitor-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,lease_until)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'processing',clock_timestamp()-interval '1 second')`,[job,concept,account,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload,created_at) VALUES($1,$2,'pod.fixture','{\"private\":\"do-not-report\"}',clock_timestamp()-interval '20 minutes')",[event,job]);
  const db=new PodDB({bridge,expiresAt:new Date(expiresAt).toISOString(),pool:{connect:async()=>{
   const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,args)=>{
    const result=await client.query(sql,args);
    if(sql.startsWith('SELECT platform')&&!checked){
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
  assert.equal(report.incident_count,'0');assert.equal(report.queues.find(q=>q.state==='processing').count,'1');
  assert.ok(report.health.alerts.some(a=>a.code==='OUTBOX_DELIVERY_OVERDUE'));
  const text=JSON.stringify(report);for(const secret of [job,event,late,concept,'do-not-report'])assert.equal(text.includes(secret),false);
  assert.equal(report.publication_enabled,false);assert.equal(report.health.acceptance_verified,false);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[job])).rows[0].state,'qa_failed');
  assert.equal((await pool.query('SELECT business_id FROM pod_concepts WHERE id=$1',[concept])).rows[0].business_id,'monitor-fixture');
  await assert.rejects(db.recover(),/POD_STORAGE_EXPIRING/);
  assert.equal(db.expiresAt,expiresAt);
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=$1',[job]);
  await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[job]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 }
}
