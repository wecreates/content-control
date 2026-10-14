import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {recordMarketObservation} from '../integrations/pod/market.mjs';

const key='synthetic-market-evidence-key-'.repeat(2);
const sign=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:market',
 issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
const observation=()=>({platform:'redbubble',source_url:'https://example.org/permitted-fixture',
 country:'US',category:'shirt',observed_at:'2026-01-01T00:00:00Z',collection_authorized:true,
 source_sha256:'a'.repeat(64),image_sha256:'b'.repeat(64),rank_evidence_sha256:'c'.repeat(64),
 price_minor:1200,currency:'USD',observed_rank:2,observations:{tags:['fixture'],layout:{color:'blue'}}});
function fixture(previous=null,missing=[]){
 const writes=[];
 const db={tx:async fn=>fn({query:async(sql,args)=>{
  if(sql.includes('FROM pod_artifacts'))return {rows:args[0].filter(sha=>!missing.includes(sha)).map(sha=>({sha256:sha}))};
  if(sql.startsWith('INSERT INTO pod_market_intelligence')){writes.push(args);return {rowCount:previous?0:1,rows:previous?[]:[{id:'stored-id'}]};}
  if(sql.includes('FROM pod_market_intelligence'))return {rows:previous?[previous]:[]};
  throw Error('UNEXPECTED_QUERY');
 }})};
 return {db,writes};
}
test('rank requires a real SHA-256 rather than any truthy string',async()=>{
 const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),rank_evidence_sha256:'not-proof'}),key),/RANK_EVIDENCE_INVALID/);
 assert.equal(f.writes.length,0);
});
test('source, image and rank evidence must each exist before intake',async()=>{
 for(const field of ['source_sha256','image_sha256','rank_evidence_sha256']){
  const o=observation(),f=fixture(null,[o[field]]);
  await assert.rejects(recordMarketObservation(f.db,sign(o),key),/MARKET_EVIDENCE_MISSING/);
  assert.equal(f.writes.length,0);
 }
});
test('rank evidence is retained beside the observed rank',async()=>{
 const o=observation(),f=fixture();assert.deepEqual(await recordMarketObservation(f.db,sign(o),key),{inserted:true,id:'stored-id'});
 assert.ok(f.writes[0].includes(o.rank_evidence_sha256));
});
test('identical refreshed evidence returns the original observation ID',async()=>{
 const o=observation(),f=fixture({...o,id:'original-id',price_minor:'1200',observed_at:new Date(o.observed_at)});
 assert.deepEqual(await recordMarketObservation(f.db,sign({...o,observations:{layout:{color:'blue'},tags:['fixture']}}),key),{inserted:false,id:'original-id'});
});
test('conflicting retries cannot silently change scope, price, rank or proof',async()=>{
 for(const change of [{country:'CA'},{category:'mug'},{price_minor:999},{currency:'CAD'},{observed_rank:1},
  {source_sha256:'d'.repeat(64)},{image_sha256:'d'.repeat(64)},{rank_evidence_sha256:'d'.repeat(64)},
  {observations:{tags:['different']}}]){
  const o=observation(),f=fixture({...o,id:'original-id'});
  await assert.rejects(recordMarketObservation(f.db,sign({...o,...change}),key),/MARKET_REPLAY_CONFLICT/);
 }
});
test('legacy ranked rows without stored proof fail closed on retry',async()=>{
 const o=observation(),f=fixture({...o,id:'legacy-id',rank_evidence_sha256:null});
 await assert.rejects(recordMarketObservation(f.db,sign(o),key),/MARKET_REPLAY_CONFLICT/);
});
test('unsupported destinations and malformed optional evidence never write',async()=>{
 for(const change of [{platform:'etsy'},{image_sha256:'invalid'},{observations:[]},{observations:'unstructured'},
  {observed_rank:null,rank_evidence_sha256:'a'.repeat(64)}]){
  const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),...change}),key));
  assert.equal(f.writes.length,0);
 }
});
test('unpriced unranked observations remain valid with stored source evidence',async()=>{
 const o=observation();for(const key of ['price_minor','currency','observed_rank','rank_evidence_sha256','image_sha256','observations'])delete o[key];
 const f=fixture();assert.deepEqual(await recordMarketObservation(f.db,sign(o),key),{inserted:true,id:'stored-id'});
});
