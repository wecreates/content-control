import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {productionActivity} from '../integrations/pod/capacity.mjs';

// Isolated history fixtures run before the suite creates other queue records.
export async function verifyCapacity(pool){
 const concepts=Array.from({length:3},()=>crypto.randomUUID()),account=crypto.randomUUID();
 const jobs=Array.from({length:4},()=>crypto.randomUUID());
 const a='a'.repeat(64),b='b'.repeat(64);let checked=false;
 try{
  for(const id of concepts)await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state,created_at) VALUES($1,'capacity-private',$2,'PASS',clock_timestamp()-interval '1 hour')",[id,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  for(const [i,id] of jobs.entries())await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state)
   VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,'blocked')`,[id,concepts[i<2?0:i-1],account,i+1,crypto.randomUUID()]);
  const event=async(job,kind,payload,age='1 hour')=>pool.query('INSERT INTO pod_events(id,job_id,kind,payload,created_at) VALUES($1,$2,$3,$4,clock_timestamp()-$5::interval)',[crypto.randomUUID(),job,kind,payload,age]);
  await event(jobs[0],'pod.production.review_required',{package_sha256:a});
  await event(jobs[0],'pod.production.review_required',{package_sha256:a}); // Retry duplicate.
  await event(jobs[1],'pod.production.review_required',{package_sha256:a}); // Variant of same concept/artwork.
  await event(jobs[0],'pod.production.qa_passed',{package_sha256:a,fencing_token:'2'});
  await event(jobs[2],'pod.production.qa_failed',{package_sha256:b,fencing_token:'1'}); // Completed direct-QA production.
  await event(jobs[3],'pod.production.qa_passed',{package_sha256:'c'.repeat(64)}); // Later manual review, not generation.
  await event(jobs[3],'pod.production.review_required',{package_sha256:'c'.repeat(64)},'25 hours');
  await event(jobs[3],'pod.production.review_required',{package_sha256:'d'.repeat(64)},'-1 hour');
  await event(jobs[3],'pod.production.review_required',{package_sha256:'invalid'});
  await event(jobs[3],'pod.fixture.unrelated',{package_sha256:'e'.repeat(64)});
  const db={active(){throw Error('POD_STORAGE_EXPIRING');},pool:{connect:async()=>{
   const c=await pool.connect();return {release:bad=>c.release(bad),query:async(sql,args)=>{
    if(sql.startsWith('WITH')){
     checked=true;assert.equal((await c.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
     await c.query('SAVEPOINT capacity_write');
     await assert.rejects(c.query("UPDATE pod_accounts SET state='ACTIVE' WHERE id=$1",[account]),e=>e.code==='25006');
     await c.query('ROLLBACK TO SAVEPOINT capacity_write');
    }
    return c.query(sql,args);
   }};
  }}};
  const r=await productionActivity(db);assert.equal(checked,true);
  assert.deepEqual(r.counts,{registered_concept_records:'3',generated_concept_records:'2',generated_jobs:'3',
   generated_package_hashes:'2',jobs_with_pass_event:'2',jobs_with_fail_event:'1'});
  assert.equal(new Date(r.window.end)-new Date(r.window.start),86400000);
  assert.equal(r.capacity_verified,false);assert.equal(r.acceptance_verified,false);assert.equal(r.publication_enabled,false);
  for(const secret of [...concepts,...jobs,account,a,b,'capacity-private'])assert.equal(JSON.stringify(r).includes(secret),false);
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=ANY($1::uuid[])',[jobs]);
  await pool.query('DELETE FROM pod_production_queue WHERE id=ANY($1::uuid[])',[jobs]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  await pool.query('DELETE FROM pod_concepts WHERE id=ANY($1::uuid[])',[concepts]);
 }
}
