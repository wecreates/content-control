import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';

// Disposable CI fixtures only: this is enforcement testing, not editorial approval.
export async function verifyEditorialGate(pool,bridge){
 const id=crypto.randomUUID(),concept=crypto.randomUUID(),account=crypto.randomUUID();
 const key='synthetic-editorial-db-key-'.repeat(2);
 const db=new PodDB({pool,bridge,qaKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 const job={id,platform:'kdp',fencing_token:1};
 const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)};
 const qa=(editorial,manuscript_provenance=true)=>{
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
   expires_at_ms:Date.now()+60000,verdict:'PASS',...manifest,
   checks:{...Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details'].map(k=>[k,true])),editorial,manuscript_provenance}});
  return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 };
 try{
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,crypto.randomUUID(),crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'kdp')",[account]);
  await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,fencing_token,lease_until)
   VALUES($1,$2,$3,'kdp',1,'{}','{}',$4,'processing',1,clock_timestamp()+interval '5 minutes')`,[id,concept,account,crypto.randomUUID()]);
  const result=await db.completeProduction(job,manifest,qa());
  assert.equal(result.pass,false);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[id])).rows[0].state,'qa_failed');
  // Place the disposable fixture into the external review path.
  await pool.query("UPDATE pod_production_queue SET reason_code='REVIEW_REQUIRED' WHERE id=$1",[id]);
  await assert.rejects(db.acceptReview(id,qa()),/QA_BLOCKED/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[id])).rows[0].state,'qa_failed');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.production.qa_passed'",[id])).rows[0].n,0);
  for(const invalid of [undefined,false,1,'true',null]){
   // Explicit undefined is lost by JSON serialization, testing missing as well.
   const payload=JSON.parse(qa(true).payload);payload.checks.manuscript_provenance=invalid;
   const text=JSON.stringify(payload),envelope={payload:text,signature:crypto.createHmac('sha256',key).update(text).digest('hex')};
   await pool.query("UPDATE pod_production_queue SET state='processing',lease_until=clock_timestamp()+interval '5 minutes' WHERE id=$1",[id]);
   assert.equal((await db.completeProduction(job,manifest,envelope)).pass,false);
   await pool.query("UPDATE pod_production_queue SET reason_code='REVIEW_REQUIRED' WHERE id=$1",[id]);
   await assert.rejects(db.acceptReview(id,envelope),/QA_BLOCKED/);
   assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[id])).rows[0].state,'qa_failed');
  }
  assert.equal((await db.acceptReview(id,qa(true))).status,'QA_PASSED');
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[id])).rows[0].state,'qa_passed');
 }finally{
  await pool.query('DELETE FROM pod_events WHERE job_id=$1',[id]);
  await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[id]);
  await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
 }
}

