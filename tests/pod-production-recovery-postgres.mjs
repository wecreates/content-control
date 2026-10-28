import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Disposable database fixtures only: no real credentials, approvals or adapters.
export async function verifyProductionRecovery(pool,bridge){
 const id=crypto.randomUUID(),concept=crypto.randomUUID(),account=crypto.randomUUID(),business=crypto.randomUUID();
 const key='synthetic-recovery-authority-'.repeat(2);
 const db=new PodDB({pool,bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 const brief={id,account_id:account,business_id:business,platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const old={...brief,fencing_token:'1'};
 const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
  package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
   'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
 const grant=(changes={})=>{
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-100,
   expires_at_ms:Date.now()+60000,job_id:id,account_id:account,business_id:business,platform:'redbubble',
   max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,...changes});
  return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 };
 const row=async()=> (await pool.query('SELECT state,reason_code,attempt,fencing_token,lease_until FROM pod_production_queue WHERE id=$1',[id])).rows[0];
 const eventCount=async()=> (await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.repair.archived'",[id])).rows[0].n;
 const expire=()=>pool.query("UPDATE pod_production_queue SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,business,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,attempt,fencing_token,lease_until)
   VALUES($1,$2,$3,'redbubble',1,$4,'{}',$5,'processing',1,1,clock_timestamp()-interval '1 second')`,
   [id,concept,account,brief,crypto.randomUUID()]);
  await db.recover();
  assert.equal((await row()).state,'blocked');assert.equal((await row()).reason_code,'PRODUCTION_LEASE_EXPIRED');
  await assert.rejects(db.holdProduction(old,manifest),/LEASE_LOST/);
  for(const change of [{expires_at_ms:Date.now()-1},{revoked:true},{production_permission:false},{job_id:crypto.randomUUID()}]){
   await assert.rejects(db.requeueRepair(id,grant(change)));
   assert.equal((await row()).state,'blocked');assert.equal(await eventCount(),0);
  }
  const outcomes=await Promise.allSettled([db.requeueRepair(id,grant()),db.requeueRepair(id,grant())]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason.message==='REPAIR_BLOCKED').length,1);
  assert.deepEqual(await row(),{state:'raw',reason_code:null,attempt:1,fencing_token:'1',lease_until:null});
  const event=(await pool.query("SELECT payload FROM pod_events WHERE job_id=$1 AND kind='pod.repair.archived'",[id])).rows[0].payload;
  assert.equal(event.reason_code,'PRODUCTION_LEASE_EXPIRED');assert.equal(event.attempt,1);assert.equal(await eventCount(),1);
  await assert.rejects(db.failProduction(old,'QA_FAILED'),/LEASE_LOST/);
  // Invoke before other queue fixtures so the real claim API selects this sole raw job.
  const retry=await db.claimProduction();assert.equal(retry.id,id);assert.equal(retry.attempt,2);assert.equal(retry.fencing_token,'2');
  await assert.rejects(db.holdProduction(old,manifest),/LEASE_LOST/);
  assert.equal(await db.assertProducible(retry),true);
  await expire();await db.recover();
  // Never reset the retry budget, even across repeated crashes.
  await db.requeueRepair(id,grant());
  const last=await db.claimProduction();assert.equal(last.id,id);assert.equal(last.attempt,3);
  await expire();await db.recover();await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  assert.equal(await eventCount(),2);

  await pool.query('UPDATE pod_production_queue SET attempt=1 WHERE id=$1',[id]);
  for(const [state,reason] of [['ambiguous','LEASE_EXPIRED'],['submitted','PRODUCTION_LEASE_EXPIRED'],
   ['blocked','LEASE_EXPIRED'],['blocked','RIGHTS_BLOCKED'],['publishing','PRODUCTION_LEASE_EXPIRED']]){
   await pool.query('UPDATE pod_production_queue SET state=$2,reason_code=$3 WHERE id=$1',[id,state,reason]);
   await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  }
  await pool.query("UPDATE pod_production_queue SET state='blocked',reason_code='PRODUCTION_LEASE_EXPIRED',lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1",[id]);
  await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  await pool.query('UPDATE pod_production_queue SET lease_until=NULL WHERE id=$1',[id]);
  await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  await expire();await pool.query("UPDATE pod_production_queue SET provider_id='synthetic-existing-listing' WHERE id=$1",[id]);
  await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  await pool.query('UPDATE pod_production_queue SET provider_id=NULL WHERE id=$1',[id]);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
  await assert.rejects(db.requeueRepair(id,grant()),/REPAIR_BLOCKED/);
  assert.equal(await eventCount(),2);
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=$1',[id]);
  await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[id]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
 }
}
