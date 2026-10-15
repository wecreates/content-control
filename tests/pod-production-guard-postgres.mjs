import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Disposable CI database only. Production permission is not synthesized here.
export async function verifyProductionGuard(pool,bridge){
 for(const kind of ['lease','rights','tombstone']){
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),id=crypto.randomUUID();
  const job={id,account_id:account,platform:'redbubble',fencing_token:1};
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,crypto.randomUUID(),crypto.randomUUID()]);
  // NEW accounts may produce internal packages; publication requires ACTIVE.
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,fencing_token,lease_until)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'processing',1,clock_timestamp()+interval '5 minutes')`,[id,concept,account,crypto.randomUUID()]);
  let workerPid,pending;const blocker=await pool.connect();
  const db=new PodDB({pool:{connect:async()=>{
   const c=await pool.connect();workerPid=(await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return c;
  }},bridge,expiresAt:'2099-01-01T00:00:00Z'});
  try{
   assert.equal(await db.assertProducible(job),true);
   for(const patch of [{fencing_token:2},{account_id:crypto.randomUUID()},{platform:'zazzle'}])
    await assert.rejects(db.assertProducible({...job,...patch}),/LOCAL_PRODUCTION_BLOCKED/);
   await blocker.query('BEGIN');
   if(kind==='lease')await blocker.query('SELECT id FROM pod_production_queue WHERE id=$1 FOR UPDATE',[id]);
   else await blocker.query('SELECT id FROM pod_concepts WHERE id=$1 FOR UPDATE',[concept]);
   workerPid=undefined;
   pending=db.assertProducible(job).then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let attempt=0;attempt<100;attempt++){
    if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
    if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.equal(waiting,true,kind+' reached the lock barrier');
   if(kind==='lease')await blocker.query("UPDATE pod_production_queue SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
   else if(kind==='rights')await blocker.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
   else await blocker.query('UPDATE pod_concepts SET permanently_unpublished=true WHERE id=$1',[concept]);
   await blocker.query('COMMIT');
   assert.equal((await pending).error?.message,'LOCAL_PRODUCTION_BLOCKED',kind);
   assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[id])).rows[0].state,'processing');
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1',[id])).rows[0].n,0);
  }finally{
   await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[id]);
   await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
   await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  }
 }
}
