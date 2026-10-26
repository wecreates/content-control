import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {financialTotals} from '../integrations/pod/finance.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

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
