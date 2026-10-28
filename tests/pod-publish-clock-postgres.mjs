import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
 JSON.stringify(value);
const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
 package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
  'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
const manifestSha256=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
async function insertQaPassed(pool,job,concept,account,revision){
 await pool.query(`INSERT INTO pod_production_queue
  (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
  VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,'qa_passed',$6)`,[job,concept,account,revision,crypto.randomUUID(),manifest]);
 await pool.query("INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,'pod.production.qa_passed',$3)",
  [crypto.randomUUID(),job,{manifest_sha256:manifestSha256,publication_enabled:false}]);
}

// Disposable PostgreSQL fixtures only. No provider call or publication switch.
export async function verifyPublishClock(pool,bridge){
 for(const kind of ['timestamps','elapsed-cooldown','disabled','future-cooldown','elapsed-quota']){
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID();
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'clock-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',1)",[account]);
  await insertQaPassed(pool,job,concept,account,1);
  if(kind==='elapsed-quota')await pool.query(`INSERT INTO pod_quota_reservations(job_id,attempt,account_id,reserved_at)
   VALUES($1,0,$2,clock_timestamp()-interval '24 hours'+interval '1 hour')`,[job,account]);
  const blocker=await pool.connect();let pending,workerPid;
  const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>{
   const client=await pool.connect();workerPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   return client;
  }}});
  try{
   await blocker.query('BEGIN');
   await blocker.query('SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE',[account]);
   pending=db.claimPublish(account,45).then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let i=0;i<100;i++){
    if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
    if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.equal(waiting,true,kind+' reached real account lock');
   if(kind==='elapsed-cooldown')await blocker.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()+interval '50 milliseconds' WHERE id=$1",[account]);
   if(kind==='disabled')await blocker.query("UPDATE pod_accounts SET state='DISABLED' WHERE id=$1",[account]);
   if(kind==='future-cooldown')await blocker.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()+interval '1 hour' WHERE id=$1",[account]);
   if(kind==='elapsed-quota')await blocker.query("UPDATE pod_quota_reservations SET reserved_at=clock_timestamp()-interval '24 hours'+interval '50 milliseconds' WHERE account_id=$1",[account]);
   await blocker.query('SELECT pg_sleep(0.15)');
   // Keep timestamps as PostgreSQL text: Node Date truncates microseconds.
   const barrier=(await blocker.query('SELECT clock_timestamp()::text AS stamp')).rows[0].stamp;
   await blocker.query('COMMIT');
   const result=await pending;
   assert.equal(result.error,undefined,kind);
   const blocked=['disabled','future-cooldown'].includes(kind);
   if(blocked){
    assert.equal(result.value,null,kind);
    assert.deepEqual((await pool.query('SELECT state,attempt,fencing_token,lease_until FROM pod_production_queue WHERE id=$1',[job])).rows[0],
     {state:'qa_passed',attempt:0,fencing_token:'0',lease_until:null});
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_quota_reservations WHERE account_id=$1',[account])).rows[0].n,0);
   }else{
    assert.equal(result.value?.id,job,kind+' eligible at current clock');
    const checks=(await pool.query(`SELECT
     q.lease_until >= $2::timestamptz+interval '5 minutes' AS lease_fresh,
     q.updated_at >= $2::timestamptz AS update_fresh,
     a.next_allowed_at >= $2::timestamptz+interval '45 seconds' AS cooldown_fresh,
     r.reserved_at >= $2::timestamptz AS reservation_fresh
     FROM pod_production_queue q JOIN pod_accounts a ON a.id=q.account_id
     JOIN pod_quota_reservations r ON r.job_id=q.id AND r.attempt=q.attempt WHERE q.id=$1`,[job,barrier])).rows[0];
    assert.deepEqual(checks,{lease_fresh:true,update_fresh:true,cooldown_fresh:true,reservation_fresh:true},kind);
    assert.equal(result.value.attempt,1);assert.equal(result.value.fencing_token,'1');
   }
  }finally{
   await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;
   await pool.query('DELETE FROM pod_quota_reservations WHERE account_id=$1',[account]);
   await pool.query('DELETE FROM pod_events WHERE job_id=$1',[job]);
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[job]);
   await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
   await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  }
 }
 // Account locking preserves single-claim and daily-quota guarantees under
 // contention even when multiple ready jobs exist.
 const concept=crypto.randomUUID(),account=crypto.randomUUID(),jobs=[crypto.randomUUID(),crypto.randomUUID()];
 const db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'quota-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',1)",[account]);
  for(const [i,job] of jobs.entries())await insertQaPassed(pool,job,concept,account,i+1);
  const claims=await Promise.all([db.claimPublish(account,45),db.claimPublish(account,180)]);
  assert.equal(claims.filter(Boolean).length,1);
  await pool.query("UPDATE pod_production_queue SET state='blocked' WHERE id=$1",[claims.find(Boolean).id]);
  await pool.query("UPDATE pod_accounts SET next_allowed_at=clock_timestamp()-interval '1 second' WHERE id=$1",[account]);
  assert.equal(await db.claimPublish(account,45),null,'consumed quota blocks the other ready job');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_quota_reservations WHERE account_id=$1',[account])).rows[0].n,1);
 }finally{
  await pool.query('DELETE FROM pod_quota_reservations WHERE account_id=$1',[account]);
  await pool.query('DELETE FROM pod_events WHERE job_id=ANY($1::uuid[])',[jobs]);
  await pool.query('DELETE FROM pod_production_queue WHERE account_id=$1',[account]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 }
}
