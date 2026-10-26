import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};

function fixture({expireOnConnect=false,expireOnQuery=null}={}){
 const calls=[];
 let connects=0;
 let db;
 const client={
  async query(sql){
   calls.push(sql);
   if((typeof sql==='string'?sql:sql.text)===expireOnQuery)db.expiresAt=0;
   return {rows:[]};
  },
  release(){}
 };
 const pool={async connect(){connects++;if(expireOnConnect)db.expiresAt=0;return client;}};
 db=new PodDB({pool,bridge,expiresAt:'2099-01-01T00:00:00Z'});
 return {db,calls,get connects(){return connects;}};
}

test('transaction rejects an invalid wall clock before database access',async()=>{
 const originalNow=Date.now;
 try{
  for(const now of [NaN,'0',0.5,-1,8640000000000001,Number.MAX_SAFE_INTEGER+1]){
   const state=fixture();
   Date.now=()=>now;
   await assert.rejects(state.db.tx(()=>assert.fail('transaction callback reached')),/POD_STORAGE_EXPIRING/);
   assert.equal(state.connects,0);
   assert.deepEqual(state.calls,[]);
  }
 }finally{Date.now=originalNow;}
});

test('transaction stops before BEGIN when storage expires during connection acquisition',async()=>{
 const {db,calls}=fixture({expireOnConnect:true});
 await assert.rejects(db.tx(()=>assert.fail('transaction callback reached')),/POD_STORAGE_EXPIRING/);
 assert.deepEqual(calls,[]);
});

test('transaction stops before setup when storage expires during BEGIN',async()=>{
 const {db,calls}=fixture({expireOnQuery:'BEGIN'});
 await assert.rejects(db.tx(()=>assert.fail('transaction callback reached')),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.some(sql=>sql.startsWith('SET LOCAL')),false);
});

test('transaction stops before later setup when storage expires during lock-timeout setup',async()=>{
 const lock="SET LOCAL lock_timeout='2s'";
 const {db,calls}=fixture({expireOnQuery:lock});
 await assert.rejects(db.tx(()=>assert.fail('transaction callback reached')),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.includes("SET LOCAL statement_timeout='10s'"),false);
});

test('transaction client stops before a later query after storage expires',async()=>{
 const {db,calls}=fixture({expireOnQuery:'FIRST'});
 await assert.rejects(db.tx(async client=>{
  await client.query('FIRST');
  await client.query('SECOND');
 }),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.includes('SECOND'),false);
});

test('transaction client stops before a query when storage expires during non-database callback work',async()=>{
 const {db,calls}=fixture();
 await assert.rejects(db.tx(async client=>{
  await Promise.resolve();
  db.expiresAt=0;
  await client.query('AFTER_CALLBACK_WAIT');
 }),/POD_STORAGE_EXPIRING/);
 assert.equal(calls.includes('AFTER_CALLBACK_WAIT'),false);
});

test('transaction business statements use the single-statement extended protocol',async()=>{
 const {db,calls}=fixture();
 await db.tx(client=>client.query('SELECT fixture',['bound']));
 assert.deepEqual(calls[3],{text:'SELECT fixture',values:['bound'],queryMode:'extended'});
});

test('transaction does not roll back when opening the transaction fails',async()=>{
 const original=Error('BEGIN_FAILURE'),calls=[],releases=[];
 const client={release:bad=>releases.push(bad),query:async sql=>{calls.push(sql);throw original;}};
 const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.tx(()=>assert.fail('transaction callback reached')),error=>error===original);
 assert.deepEqual(calls,['BEGIN']);
 assert.deepEqual(releases,[false]);
});
