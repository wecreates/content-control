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
function fixture(previous=null,missing=[],corrupt=[]){
 const writes=[];
 const db={tx:async fn=>fn({query:async(sql,args)=>{
  if(sql.includes('FROM pod_artifacts'))return {rows:args[0].filter(sha=>!missing.includes(sha)).map(sha=>({sha256:sha,body_sha256:corrupt.includes(sha)?'0'.repeat(64):sha}))};
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
test('corrupt source, image or rank bytes block new observations and replays',async()=>{
 for(const field of ['source_sha256','image_sha256','rank_evidence_sha256'])for(const replay of [false,true]){
  const o=observation(),f=fixture(replay?{...o,id:'existing'}:null,[],[o[field]]);
  await assert.rejects(recordMarketObservation(f.db,sign(o),key),/EVIDENCE_ARTIFACT_CORRUPT/);
  assert.equal(f.writes.length,0);
 }
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

test('observation timestamps require explicit timezone and full time before database access',async()=>{
 for(const observed_at of ['2026-01-01','2026-01-01T00:00:00','01/01/2026','2026-01-01 00:00:00Z']){
  const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),observed_at}),key),/MARKET_EVIDENCE_INVALID/);
  assert.equal(f.writes.length,0);
 }
});
test('observation timestamps cannot normalize nonexistent dates or midnight overflow',async()=>{
 for(const observed_at of ['2026-02-30T00:00:00Z','2025-02-29T00:00:00Z','2026-01-01T24:00:00Z']){
  const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),observed_at}),key),/MARKET_EVIDENCE_INVALID/);
  assert.equal(f.writes.length,0);
 }
});
test('observation timestamp objects and arrays are not coerced into dates',async()=>{
 for(const observed_at of [['2026-01-01T00:00:00Z'],2026,null,true,{}]){
  const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),observed_at}),key),/MARKET_EVIDENCE_INVALID/);
  assert.equal(f.writes.length,0);
 }
});
test('observation precision cannot exceed PostgreSQL microseconds',async()=>{
 const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),observed_at:'2026-01-01T00:00:00.1234567Z'}),key),/MARKET_EVIDENCE_INVALID/);
 assert.equal(f.writes.length,0);
});
test('valid explicit zones and microseconds retain original observation parameters',async()=>{
 for(const observed_at of ['2024-02-29T12:30:00Z','2026-01-01T00:00:00.123456Z','2026-01-01T01:00:00.123456+01:00','2025-12-31T16:00:00.123456-08:00']){
  const f=fixture();await recordMarketObservation(f.db,sign({...observation(),observed_at}),key);
  assert.equal(f.writes[0][3],observed_at);
 }
});
test('future observation timestamps remain blocked',async()=>{
 const f=fixture();await assert.rejects(recordMarketObservation(f.db,sign({...observation(),observed_at:new Date(Date.now()+86400000).toISOString()}),key),/MARKET_EVIDENCE_INVALID/);
 assert.equal(f.writes.length,0);
});


for(const [field,code] of [['source_url','MARKET_SOURCE_INVALID'],['country','MARKET_EVIDENCE_INVALID'],
 ['currency','PRICE_EVIDENCE_INVALID'],['source_sha256','MARKET_EVIDENCE_INVALID']]){
 test(`signed ${field} must be a primitive string before database access`,async()=>{
  for(const wrap of [value=>[value],value=>[[value]],()=>({}),()=>null,()=>true]){
   const o=observation();
   await assert.rejects(recordMarketObservation({tx(){assert.fail('malformed scalar reached database');}},
    sign({...o,[field]:wrap(o[field])}),key),new RegExp(code));
  }
 });
}
test('validated scalar source identity is passed unchanged for insert and exact replay',async()=>{
 const o={...observation(),source_url:'https://example.org/Source%2fExact?b=2&a=1#fragment'};
 const f=fixture();await recordMarketObservation(f.db,sign(o),key);
 for(const [index,field] of [[2,'source_url'],[4,'country'],[8,'currency'],[10,'source_sha256']])
  assert.equal(f.writes[0][index],o[field]);
 const replay=fixture({...o,id:'original-id',price_minor:'1200'});
 assert.deepEqual(await recordMarketObservation(replay.db,sign(o),key),{inserted:false,id:'original-id'});
});
