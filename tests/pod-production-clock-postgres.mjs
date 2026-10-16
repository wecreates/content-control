import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Disposable PostgreSQL only. Run before unrelated raw queue fixtures.
export async function verifyProductionClock(pool,bridge){
 const dbFor=target=>new PodDB({pool:target,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 const concept=crypto.randomUUID(),account=crypto.randomUUID();
 const jobs=[];
 async function addJob(delay='-1 second'){
  const id=crypto.randomUUID();jobs.push(id);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,next_attempt_at)
   VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,clock_timestamp()+$6::interval)`,
   [id,concept,account,jobs.length,crypto.randomUUID(),delay]);
  return id;
 }
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'production-clock-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  for(const kind of ['timestamps','elapsed-retry','future-retry']){
   const job=await addJob(kind==='elapsed-retry'?'1 second':kind==='future-retry'?'1 hour':'-1 second');
   const blocker=await pool.connect();let pending,workerPid;
   const db=dbFor({connect:async()=>{
    const client=await pool.connect();workerPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    return client;
   }});
   try{
    await blocker.query('BEGIN');
    // A relation lock blocks UPDATE before candidate selection, unlike queue
    // row locks which the worker deliberately skips.
    await blocker.query('LOCK TABLE pod_production_queue IN SHARE MODE');
    pending=db.claimProduction().then(value=>({value}),error=>({error}));
    let waiting=false;
    for(let i=0;i<100;i++){
     if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
     if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,kind+' reached real table lock');
    if(kind==='elapsed-retry'){
     assert.equal((await pool.query(`SELECT a.xact_start<q.next_attempt_at AS initially_future
      FROM pg_stat_activity a CROSS JOIN pod_production_queue q WHERE a.pid=$1 AND q.id=$2`,[workerPid,job])).rows[0].initially_future,true);
     await blocker.query(`SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM next_attempt_at-clock_timestamp()))+0.1)
      FROM pod_production_queue WHERE id=$1`,[job]);
    }else await blocker.query('SELECT pg_sleep(0.15)');
    const barrier=(await blocker.query('SELECT clock_timestamp()::text AS stamp')).rows[0].stamp;
    await blocker.query('COMMIT');
    const result=await pending;assert.equal(result.error,undefined,kind);
    if(kind==='future-retry'){
     assert.equal(result.value,null);
     assert.deepEqual((await pool.query('SELECT state,attempt,fencing_token,lease_until FROM pod_production_queue WHERE id=$1',[job])).rows[0],
      {state:'raw',attempt:0,fencing_token:'0',lease_until:null});
    }else{
     assert.equal(result.value?.id,job,kind);
     assert.equal(result.value.state,'processing');assert.equal(result.value.attempt,1);assert.equal(result.value.fencing_token,'1');
     assert.deepEqual((await pool.query(`SELECT lease_until >= $2::timestamptz+interval '30 minutes' AS lease_fresh,
      updated_at >= $2::timestamptz AS update_fresh FROM pod_production_queue WHERE id=$1`,[job,barrier])).rows[0],
      {lease_fresh:true,update_fresh:true},kind);
    }
   }finally{await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;}
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[job]);
  }
  const first=await addJob(),second=await addJob();
  const blocker=await pool.connect();
  try{
   await blocker.query('BEGIN');
   await blocker.query('SELECT id FROM pod_production_queue WHERE id=$1 FOR UPDATE',[first]);
   assert.equal((await dbFor(pool).claimProduction()).id,second,'a locked earlier job does not stall another candidate');
   assert.equal(await dbFor(pool).claimProduction(),null,'locked and already processing jobs cannot be claimed');
  }finally{await blocker.query('ROLLBACK');blocker.release();}
  const claims=await Promise.all([dbFor(pool).claimProduction(),dbFor(pool).claimProduction()]);
  assert.equal(claims.filter(Boolean).length,1);assert.equal(claims.find(Boolean).id,first);
  for(const id of [first,second])assert.deepEqual((await pool.query('SELECT attempt,fencing_token FROM pod_production_queue WHERE id=$1',[id])).rows[0],{attempt:1,fencing_token:'1'});
 }finally{
  await pool.query('DELETE FROM pod_production_queue WHERE account_id=$1',[account]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 }
}
