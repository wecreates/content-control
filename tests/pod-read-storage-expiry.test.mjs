import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {financialTotals} from '../integrations/pod/finance.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

test('guarded reads use a database-enforced read-only transaction',async()=>{
 const queries=[],releases=[];
 const client={release:bad=>releases.push(bad),query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql==='SELECT fixture')return {rows:[{value:1}]};
  return {rows:[]};
 }};
 const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 assert.deepEqual(await db.read('SELECT fixture',['bound']),{rows:[{value:1}]});
 assert.deepEqual(queries,[
  {sql:'BEGIN READ ONLY',args:undefined},
  {sql:"SET LOCAL statement_timeout='10s'",args:undefined},
  {sql:'SELECT fixture',args:['bound']},
  {sql:'COMMIT',args:undefined},
 ]);
 assert.deepEqual(releases,[false]);
});

for(const expiryStage of ['begin','timeout','query'])test(`guarded read rolls back when storage expires during ${expiryStage}`,async()=>{
 const queries=[],releases=[];let db;
 const client={release:bad=>releases.push(bad),query:async sql=>{
  queries.push(sql);
  if((expiryStage==='begin'&&sql==='BEGIN READ ONLY')||
   (expiryStage==='timeout'&&sql.startsWith('SET LOCAL'))||
   (expiryStage==='query'&&sql==='SELECT fixture'))db.expiresAt=Date.now();
  return {rows:[]};
 }};
 db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.read('SELECT fixture'),/^Error: POD_STORAGE_EXPIRING$/);
 assert.equal(queries.at(-1),'ROLLBACK');assert.equal(queries.includes('COMMIT'),false);
 if(expiryStage!=='query')assert.equal(queries.includes('SELECT fixture'),false);
 assert.deepEqual(releases,[false]);
});

test('guarded read preserves query failure and discards a client whose rollback fails',async()=>{
 const original=Error('ORIGINAL_READ_FAILURE'),queries=[],releases=[];
 const client={release:bad=>releases.push(bad),query:async sql=>{
  queries.push(sql);if(sql==='SELECT fixture')throw original;if(sql==='ROLLBACK')throw Error('ROLLBACK_FAILURE');return {rows:[]};
 }};
 const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.read('SELECT fixture'),error=>error===original);
 assert.equal(queries.at(-1),'ROLLBACK');assert.deepEqual(releases,[true]);
});

test('guarded read does not roll back when opening the transaction fails',async()=>{
 const original=Error('BEGIN_FAILURE'),queries=[],releases=[];
 const client={release:bad=>releases.push(bad),query:async sql=>{
  queries.push(sql);throw original;
 }};
 const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.read('SELECT fixture'),error=>error===original);
 assert.deepEqual(queries,['BEGIN READ ONLY']);assert.deepEqual(releases,[false]);
});

test('all production read paths stop before SQL when storage expires during connection acquisition',async()=>{
 const operationsKey='k'.repeat(32),sha='a'.repeat(64);
 for(const [name,read] of [
  ['release-ready list',db=>db.listReady()],
  ['operations job list',db=>db.listOperationsJobs()],
  ['review package',db=>db.reviewPackage('fixture-job')],
  ['review artifact',db=>db.reviewArtifact('fixture-job',sha)],
  ['financial totals',db=>financialTotals(db)],
  ['artifact bytes',db=>new ArtifactStore(db).get(sha)],
  ['outbox selection',db=>deliverOutbox(db,{url:'https://authority.example/events',key:operationsKey,
   fetchImpl:()=>assert.fail('network reached')})],
 ]){
  let db,queries=0,releases=0;
  const client={query:async()=>{queries++;assert.fail(`${name} reached SQL after expiry`);},release(){releases++;}};
  const pool={connect:async()=>{db.expiresAt=Date.now();return client;},query:async()=>assert.fail(`${name} bypassed guarded acquisition`)};
  db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
  await assert.rejects(read(db),/^Error: POD_STORAGE_EXPIRING$/);
  assert.equal(queries,0,name);assert.equal(releases,1,name);
 }
});

test('database guard rejects normalized or ambiguous storage expiry text before access',()=>{
 for(const expiresAt of ['2099-01-01','2099-01-01 00:00:00Z','2099-01-01T01:00:00+01:00',
  '2099-01-01T00:00:00.0Z','2099-01-01T00:00:00z','2099-01-01T00:00:00Z ']){
  const pool={connect:async()=>assert.fail('invalid expiry reached database')};
  const db=new PodDB({pool,bridge,expiresAt});
  assert.throws(()=>db.active(),/POD_STORAGE_EXPIRING/);
 }
});

for(const [name,read] of [
 ['release-ready list',db=>db.listReady()],
 ['operations job list',db=>db.listOperationsJobs()]
]){
 test(name+' rechecks storage lifetime after its database wait',async()=>{
  let db;
  const client={release(){},query:async()=>{db.expiresAt=Date.now();return {rows:[]};}};
  const pool={connect:async()=>client};
  db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
  await assert.rejects(read(db),/POD_STORAGE_EXPIRING/);
 });
}

test('financial totals recheck storage lifetime after their database wait',async()=>{
 let db;
 const expected=[{currency:'USD',verified_net_recorded_minor:'125',evidence_count:'2'}];
 const client={release(){},query:async()=>{db.expiresAt=Date.now();return {rows:expected};}};
 const pool={connect:async()=>client};
 db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(financialTotals(db),/POD_STORAGE_EXPIRING/);
});
