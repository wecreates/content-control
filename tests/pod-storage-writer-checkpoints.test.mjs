import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';

const key='synthetic-storage-writer-checkpoint-key-'.repeat(2);
const sha='a'.repeat(64);
const sign=(audience,value)=>{
 const payload=JSON.stringify({schema_version:1,audience,issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
};
const market=()=>sign('content-control:pod:market',{platform:'redbubble',
 source_url:'https://example.org/authorized-fixture',country:'US',category:'apparel',
 observed_at:'2026-01-01T00:00:00Z',source_sha256:sha,collection_authorized:true});
const finance=()=>sign('content-control:pod:finance',{verified:true,authority_event_id:'authority-event',
 provider_event_id:'provider-event',provider:'redbubble',job_id:'job-fixture',amount_minor:100,
 kind:'royalty',currency:'USD',occurred_at:'2026-01-01T00:00:00Z',evidence_sha256:sha});
const listing=()=>sign('content-control:pod:listing-observation',{status:'LIVE',provider_verified:true,
 job_id:'job-fixture',account_id:'account-fixture',platform:'redbubble',provider_id:'listing-fixture',
 provider_event_id:'listing-event',package_sha256:sha,evidence_sha256:sha});
const evidence=()=>({rows:[{sha256:sha,media_type:'application/json',body_sha256:sha}]});
const job=()=>({rows:[{id:'job-fixture',account_id:'account-fixture',platform:'redbubble',
 state:'submitted',provider_id:null,manifest:{package_sha256:sha}}]});

function expiringDB(query){
 let expired=false;
 return {expire:()=>{expired=true;},active(){if(expired)throw Error('POD_STORAGE_EXPIRING');},
  tx:fn=>fn({query})};
}

test('market intake stops before insert when storage expires during evidence lookup',async()=>{
 let writes=0;let db;
 db=expiringDB(async sql=>{
  if(sql.includes('FROM pod_artifacts')){db.expire();return evidence();}
  if(sql.startsWith('INSERT'))writes++;
  return {rowCount:1,rows:[{id:'market-id'}]};
 });
 await assert.rejects(recordMarketObservation(db,market(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(writes,0);
});

test('market replay stops before row lookup when storage expires during conflict wait',async()=>{
 let replayReads=0;let db;
 db=expiringDB(async sql=>{
  if(sql.includes('FROM pod_artifacts'))return evidence();
  if(sql.startsWith('INSERT INTO pod_market_intelligence')){db.expire();return {rowCount:0,rows:[]};}
  if(sql.startsWith('SELECT * FROM pod_market_intelligence'))replayReads++;
  return {rows:[]};
 });
 await assert.rejects(recordMarketObservation(db,market(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(replayReads,0);
});

test('financial intake stops before ledger insert when storage expires during evidence lookup',async()=>{
 let writes=0;let db;
 db=expiringDB(async sql=>{
  if(sql.includes('FROM pod_artifacts')){db.expire();return evidence();}
  if(sql.startsWith('INSERT'))writes++;
  return {rowCount:1,rows:[{id:'financial-id'}]};
 });
 await assert.rejects(recordFinancialEvent(db,finance(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(writes,0);
});

test('financial intake stops before outbox insert when storage expires during ledger insert',async()=>{
 let outboxWrites=0;let db;
 db=expiringDB(async sql=>{
  if(sql.includes('FROM pod_artifacts'))return evidence();
  if(sql.startsWith('INSERT INTO pod_financial_events')){db.expire();return {rowCount:1,rows:[{id:'financial-id'}]};}
  if(sql.startsWith('INSERT INTO pod_events'))outboxWrites++;
  return {rowCount:1,rows:[]};
 });
 await assert.rejects(recordFinancialEvent(db,finance(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(outboxWrites,0);
});

test('listing readback stops before inbox lookup when storage expires during evidence lookup',async()=>{
 let inboxReads=0;let db;
 db=expiringDB(async sql=>{
  if(sql.startsWith('SELECT * FROM pod_production_queue'))return job();
  if(sql.includes('FROM pod_artifacts')){db.expire();return evidence();}
  if(sql.includes('FROM pod_provider_inbox'))inboxReads++;
  return {rows:[],rowCount:0};
 });
 await assert.rejects(reconcilePublication(db,listing(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(inboxReads,0);
});

test('listing readback stops before state mutation when storage expires during inbox insert',async()=>{
 let stateWrites=0;let db;
 db=expiringDB(async sql=>{
  if(sql.startsWith('SELECT * FROM pod_production_queue'))return job();
  if(sql.includes('FROM pod_artifacts'))return evidence();
  if(sql.includes('FROM pod_provider_inbox'))return {rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO pod_provider_inbox')){db.expire();return {rowCount:1,rows:[]};}
  if(sql.startsWith('UPDATE pod_production_queue')||sql.startsWith('INSERT INTO pod_events'))stateWrites++;
  return {rowCount:1,rows:[]};
 });
 await assert.rejects(reconcilePublication(db,listing(),key),/POD_STORAGE_EXPIRING/);
 assert.equal(stateWrites,0);
});
