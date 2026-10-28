import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export async function verifyOperationsListing(pool,db){
 const concept=crypto.randomUUID(),account=crypto.randomUUID(),ids=[];
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'operations-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  for(let i=0;i<52;i++){
   const id=crypto.randomUUID();ids.push(id);
   await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,reason_code,created_at)
    VALUES($1,$2,$3,'redbubble',$4,'{"private":"not exposed"}','{"private":"not exposed"}',$5,'blocked','private failure details',clock_timestamp()+interval '1 day')`,
    [id,concept,account,i+1,crypto.randomUUID()]);
  }
  const rows=await db.listOperationsJobs('blocked');
  assert.equal(rows.length,50);
  for(const row of rows){
   assert.ok(ids.includes(row.id));assert.equal(row.reason_code,'PRODUCTION_BLOCKED');assert.equal(row.can_preview,false);
   assert.deepEqual(Object.keys(row).sort(),['id','platform','state','reason_code','attempt','created_at','can_preview'].sort());
  }
  for(const state of ['all',"blocked' OR true --",['blocked'],{},null])await assert.rejects(db.listOperationsJobs(state),/JOB_FILTER_INVALID/);
  await pool.query("UPDATE pod_production_queue SET state='qa_failed',reason_code='REVIEW_REQUIRED',manifest='{}' WHERE id=$1",[ids[0]]);
  assert.equal((await db.listOperationsJobs()).find(row=>row.id===ids[0]).can_preview,true);
  assert.equal((await db.listOperationsJobs('qa_failed')).some(row=>row.id===ids[0]),false);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
  const revoked=(await db.listOperationsJobs()).find(row=>row.id===ids[0]);
  assert.ok(revoked);assert.equal(revoked.can_preview,false);
 }finally{
  await pool.query('DELETE FROM pod_production_queue WHERE concept_id=$1',[concept]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
 }
}
