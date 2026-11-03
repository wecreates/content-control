import test from 'node:test';
import assert from 'node:assert/strict';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const job={id:'job',account_id:'account',platform:'redbubble',fencing_token:'1'};

function fixture({currentResult={rows:[{id:job.id}]},leaseResult={rows:[{valid:true}]}}={}){
 const client={
  async query(query){
   const sql=typeof query==='string'?query:query.text;
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql==='DISCARD ALL'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.includes("q.state='processing'")&&sql.includes('FOR SHARE OF q,p'))return currentResult;
   if(sql.startsWith('SELECT lease_until>clock_timestamp()'))return leaseResult;
   throw Error('UNEXPECTED_QUERY: '+sql);
  },
  release(){}
 };
 return new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
}

test('final production guard regression rejects an accessor-backed durable row result without invocation',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [{id:job.id}];}});
 await assert.rejects(fixture({currentResult:result}).assertProducible(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('final production guard regression rejects an accessor-backed lease result without invocation',async()=>{
 let reads=0;
 const result={};
 Object.defineProperty(result,'rows',{enumerable:true,get(){reads++;return [{valid:true}];}});
 await assert.rejects(fixture({leaseResult:result}).assertProducible(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
});

test('final production guard accepts only exact inert durable row query evidence',async()=>{
 let reads=0;
 const sparse=Array(1),extraRows=[{id:job.id}];extraRows.extra=true;
 const accessorRow={};
 Object.defineProperty(accessorRow,'id',{enumerable:true,get(){reads++;return job.id;}});
 const attempts=[
  new Proxy({rows:[{id:job.id}]},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}}),
  {rows:new Proxy([{id:job.id}],{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})},
  {rows:sparse},
  {rows:extraRows},
  {rows:[{id:job.id},{id:job.id}]},
  {rows:[new Proxy({id:job.id},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})]},
  {rows:[accessorRow]},
  {rows:[{id:job.id,extra:true}]},
  {rows:[{id:'other'}]},
 ];
 for(const currentResult of attempts)
  await assert.rejects(fixture({currentResult}).assertProducible(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
 await assert.rejects(fixture({currentResult:{rows:[]}}).assertProducible(job),/^Error: LOCAL_PRODUCTION_BLOCKED$/);
});

test('final production guard accepts only exact inert lease query evidence',async()=>{
 let reads=0;
 const sparse=Array(1),extraRows=[{valid:true}];extraRows.extra=true;
 const accessorRow={};
 Object.defineProperty(accessorRow,'valid',{enumerable:true,get(){reads++;return true;}});
 const attempts=[
  new Proxy({rows:[{valid:true}]},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}}),
  {rows:new Proxy([{valid:true}],{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})},
  {rows:sparse},
  {rows:extraRows},
  {rows:[{valid:true},{valid:true}]},
  {rows:[new Proxy({valid:true},{get(target,key,receiver){if(key!=='then')reads++;return Reflect.get(target,key,receiver);}})]},
  {rows:[accessorRow]},
  {rows:[{valid:true,extra:true}]},
 ];
 for(const leaseResult of attempts)
  await assert.rejects(fixture({leaseResult}).assertProducible(job),/^Error: POD_QUERY_UNVERIFIED$/);
 assert.equal(reads,0);
 for(const leaseResult of [{rows:[]},{rows:[{valid:false}]},{rows:[{valid:null}]}])
  await assert.rejects(fixture({leaseResult}).assertProducible(job),/^Error: LOCAL_PRODUCTION_BLOCKED$/);
 assert.equal(await fixture().assertProducible(job),true);
});
