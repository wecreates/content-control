import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';

export async function verifyStoredEvidence(pool,db){
 const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID();
 const key='synthetic-evidence-integrity-key-'.repeat(2);
 const corrupt=crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex');
 const missing=crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex');
 const wrong=Buffer.from('deliberately mismatched disposable fixture bytes');
 // Synthetic legacy corruption, never production data or bypassed triggers.
 await pool.query('INSERT INTO pod_artifacts(sha256,body,media_type) VALUES($1,$2,$3)',[corrupt,wrong,'application/json']);
 await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'integrity-fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
 await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
 await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
  VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'submitted',$5)`,[job,concept,account,crypto.randomUUID(),{package_sha256:corrupt}]);
 const sign=(audience,e)=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:'+audience,
  issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...e});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
 for(const [proof,isMissing] of [[corrupt,false],[missing,true]]){
  const source='https://authorized.example/integrity/'+crypto.randomUUID(),event=crypto.randomUUID();
  const market={platform:'redbubble',country:'US',category:'apparel',source_url:source,source_sha256:proof,
   observed_at:new Date().toISOString(),collection_authorized:true};
  const finance={verified:true,authority_event_id:event,provider_event_id:event,provider:'redbubble',job_id:job,
   amount_minor:100,kind:'royalty',currency:'USD',occurred_at:new Date().toISOString(),evidence_sha256:proof};
  const listing={status:'LIVE',provider_verified:true,job_id:job,account_id:account,platform:'redbubble',
   provider_id:event,provider_event_id:event,package_sha256:corrupt,evidence_sha256:proof};
  for(const [domain,run] of [
   ['MARKET',()=>recordMarketObservation(db,sign('market',market),key)],
   ['FINANCIAL',()=>recordFinancialEvent(db,sign('finance',finance),key)],
   ['LISTING',()=>reconcilePublication(db,sign('listing-observation',listing),key)]
  ])await assert.rejects(run(),{message:isMissing?domain+'_EVIDENCE_MISSING':'EVIDENCE_ARTIFACT_CORRUPT'});
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_market_intelligence WHERE source_url=$1',[source])).rows[0].n,0);
 }
 for(const table of ['pod_events','pod_financial_events'])assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE job_id=$1`,[job])).rows[0].n,0);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE account_id=$1',[account])).rows[0].n,0);
 assert.deepEqual((await pool.query('SELECT state,provider_id FROM pod_production_queue WHERE id=$1',[job])).rows[0],{state:'submitted',provider_id:null});
 assert.deepEqual((await pool.query('SELECT body FROM pod_artifacts WHERE sha256=$1',[corrupt])).rows[0].body,wrong);
 await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[job]);
 await pool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
 await pool.query('DELETE FROM pod_accounts WHERE id=$1',[account]);
}
