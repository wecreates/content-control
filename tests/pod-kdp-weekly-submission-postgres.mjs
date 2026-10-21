import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Disposable PostgreSQL fixtures only. No provider call or publication switch.
export async function verifyKdpWeeklySubmission(pool,bridge){
 const concept=crypto.randomUUID(),account=crypto.randomUUID();
 const jobs=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 const db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'kdp-week-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'kdp','ACTIVE',10)",[account]);
  for(const [index,job] of jobs.entries())await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,created_at)
   VALUES($1,$2,$3,'kdp',$4::integer,'{}','{}',$5,'qa_passed',clock_timestamp()+($4::integer*interval '1 millisecond'))`,
   [job,concept,account,index+1,crypto.randomUUID()]);

  const first=await db.claimPublish(account,45);
  assert.equal(first.id,jobs[0]);
  await pool.query("UPDATE pod_production_queue SET state='qa_passed' WHERE id=$1",[first.id]);
  await pool.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()-interval '1 second' WHERE id=$1",[account]);
  const retry=await db.claimPublish(account,45);
  assert.equal(retry.id,first.id,'same-week retry remains the same counted title');
  await pool.query("UPDATE pod_production_queue SET state='blocked' WHERE id=$1",[retry.id]);
  await pool.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()-interval '1 second' WHERE id=$1",[account]);

  const second=await db.claimPublish(account,45);
  assert.equal(second.id,jobs[1]);
  await pool.query("UPDATE pod_production_queue SET state='blocked' WHERE id=$1",[second.id]);
  await pool.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()-interval '1 second' WHERE id=$1",[account]);
  assert.equal(await db.claimPublish(account,45),null,'third distinct KDP paperback is held');
  assert.equal((await pool.query('SELECT count(DISTINCT job_id)::int AS n FROM pod_quota_reservations WHERE account_id=$1',[account])).rows[0].n,2);
  assert.equal((await pool.query("SELECT state FROM pod_production_queue WHERE id=$1",[jobs[2]])).rows[0].state,'qa_passed');

  await pool.query(`UPDATE pod_quota_reservations SET reserved_at=
   ((date_trunc('week',(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day') AT TIME ZONE 'UTC')-interval '1 microsecond'
   WHERE account_id=$1`,[account]);
  const nextWeek=await db.claimPublish(account,45);
  assert.equal(nextWeek.id,jobs[2],'Sunday UTC reset admits a new weekly title');
 }finally{
  await pool.query('DELETE FROM pod_quota_reservations WHERE account_id=$1',[account]);
  await pool.query('DELETE FROM pod_production_queue WHERE account_id=$1',[account]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 }
}
