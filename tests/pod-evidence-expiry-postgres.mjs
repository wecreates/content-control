import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';

// Advance the application clock after real SQL writes have completed but before
// the callback resumes. Verify rollback in the disposable integration database.
export async function verifyEvidenceExpiry(pool,bridge,proof){
 const key='synthetic-evidence-database-key-'.repeat(2);
 for(const kind of ['market','finance','listing','review','complete-pass','complete-fail']){
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID(),event=crypto.randomUUID();
  const state=kind==='review'?'qa_failed':kind.startsWith('complete')?'processing':'submitted';
  const reason=kind==='review'?'REVIEW_REQUIRED':null,manifest={package_sha256:proof,template_sha256:proof};
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,$2,$3,'PASS')",[concept,crypto.randomUUID(),crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,reason_code,manifest,fencing_token,lease_until)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,$5,$6,$7,1,clock_timestamp()+interval '1 minute')`,
   [job,concept,account,crypto.randomUUID(),state,reason,manifest]);
  const originalNow=Date.now,issued=originalNow();let now=issued,advanced=false;
  Date.now=()=>now;
  try{
   const source='https://authorized.example/'+event;
   const audience=kind==='listing'?'listing-observation':kind==='review'||kind.startsWith('complete')?'qa':kind;
   const claims=kind==='market'?{platform:'redbubble',source_url:source,country:'US',category:'apparel',observed_at:new Date(issued-1000).toISOString(),
    source_sha256:proof,collection_authorized:true}:kind==='finance'?{verified:true,authority_event_id:event,provider_event_id:event,provider:'fixture',job_id:job,
     amount_minor:10,kind:'royalty',currency:'USD',occurred_at:new Date(issued-1000).toISOString(),evidence_sha256:proof}:kind==='listing'?
    {status:'LIVE',provider_verified:true,job_id:job,account_id:account,platform:'redbubble',provider_id:event,provider_event_id:event,package_sha256:proof,evidence_sha256:proof}:
    {verdict:kind==='complete-fail'?'FAIL':'PASS',...manifest,checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance'].map(k=>[k,true]))};
   const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:'+audience,issued_at_ms:issued-1,expires_at_ms:issued+1000,...claims});
   const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
   const db=new PodDB({pool:{connect:async()=>{
    const c=await pool.connect();return {release:(...args)=>c.release(...args),query:async(...args)=>{
     const result=await c.query(...args);
     if(args[0].startsWith('INSERT INTO pod_events')||(kind==='market'&&args[0].startsWith('INSERT INTO pod_market_intelligence'))){now=issued+1000;advanced=true;}
     return result;
    }};
   }},bridge,qaKey:key,expiresAt:new Date(issued+7*86400000).toISOString()});
   await assert.rejects(()=>kind==='market'?recordMarketObservation(db,envelope,key):kind==='finance'?recordFinancialEvent(db,envelope,key):
    kind==='listing'?reconcilePublication(db,envelope,key):kind==='review'?db.acceptReview(job,envelope):db.completeProduction({id:job,fencing_token:1},manifest,envelope),
    /ENVELOPE_EXPIRED_OR_INVALID/,kind);
   assert.equal(advanced,true,kind+' clock advanced after actual SQL');
   assert.deepEqual((await pool.query('SELECT state,reason_code,manifest,qa_envelope,provider_id FROM pod_production_queue WHERE id=$1',[job])).rows,
    [{state,reason_code:reason,manifest,qa_envelope:null,provider_id:null}],kind+' queue rollback');
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1',[job])).rows[0].n,0);
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_market_intelligence WHERE source_url=$1',[source])).rows[0].n,0);
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_financial_events WHERE authority_event_id=$1',[event])).rows[0].n,0);
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE account_id=$1',[account])).rows[0].n,0);
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[job]);
   await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
   await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
  }finally{Date.now=originalNow;}
 }
}
