import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-evidence-expiry-key-'.repeat(2),hash='a'.repeat(64);
const cases=[['market',false],['market',true],['finance',false],['finance',true],['listing',false],['listing',true],['listing-published',false]];
async function exercise(kind,duplicate,expired){
 const originalNow=Date.now,issued=originalNow();let now=issued;
 Date.now=()=>now;
 try{
  const audience=kind.startsWith('listing')?'listing-observation':kind;
  const e={schema_version:1,audience:'content-control:pod:'+audience,issued_at_ms:issued-1,expires_at_ms:issued+1000,
   ...(kind==='market'?{platform:'redbubble',source_url:'https://authorized.example/fixture',country:'US',category:'apparel',
    observed_at:new Date(issued-1000).toISOString(),source_sha256:hash,collection_authorized:true,observations:{}}:
    kind==='finance'?{verified:true,authority_event_id:'authority-fixture',provider_event_id:'event-fixture',provider:'fixture',job_id:'job-fixture',
     amount_minor:10,kind:'royalty',currency:'USD',occurred_at:new Date(issued-1000).toISOString(),evidence_sha256:hash}:
     {status:'LIVE',provider_verified:true,job_id:'job-fixture',account_id:'account-fixture',platform:'redbubble',provider_id:'listing-fixture',
      provider_event_id:'event-fixture',package_sha256:hash,evidence_sha256:hash})};
  const payload=JSON.stringify(e),envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const queries=[],rows=(...rows)=>({rows,rowCount:rows.length});
  const client={release(){},query:async sql=>{
   queries.push(sql);
   if(/^(SELECT|INSERT|UPDATE)/.test(sql))now=issued+(expired?1000:999);
   if(sql.includes('FROM pod_artifacts'))return rows({sha256:hash,body_sha256:hash});
   if(sql.startsWith('INSERT INTO pod_market_intelligence')||sql.startsWith('INSERT INTO pod_financial_events'))return duplicate?rows():rows({id:'record-fixture'});
   if(sql.startsWith('SELECT * FROM pod_market_intelligence'))return rows({...e,id:'record-fixture'});
   if(sql.startsWith('SELECT * FROM pod_financial_events'))return rows({...e,id:'record-fixture',occurred_at:new Date(e.occurred_at)});
   if(sql.startsWith('SELECT * FROM pod_production_queue'))return rows({id:e.job_id,account_id:e.account_id,platform:e.platform,
    state:kind==='listing-published'?'published':'submitted',provider_id:e.provider_id,manifest:{package_sha256:hash}});
   if(sql.startsWith('SELECT evidence_sha256,payload FROM pod_provider_inbox'))return duplicate?rows({evidence_sha256:hash,payload:e}):rows();
   return rows();
  }};
  const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
  const run=()=>kind==='market'?recordMarketObservation(db,envelope,key):kind==='finance'?recordFinancialEvent(db,envelope,key):reconcilePublication(db,envelope,key);
  if(expired){await assert.rejects(run(),/ENVELOPE_EXPIRED_OR_INVALID/);assert.equal(queries.includes('COMMIT'),false);assert.equal(queries.at(-1),'ROLLBACK');}
  else{await run();assert.equal(queries.at(-1),'COMMIT');}
 }finally{Date.now=originalNow;}
}
for(const [kind,duplicate] of cases){
 const name=kind+(duplicate?' replay':' new evidence');
 test('expired signed '+name+' rolls back after database waits',()=>exercise(kind,duplicate,true));
 test('current signed '+name+' remains accepted',()=>exercise(kind,duplicate,false));
}
