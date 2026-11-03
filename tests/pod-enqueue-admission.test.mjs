import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-enqueue-admission-key-'.repeat(2);
const job={id:'fixture-job',business_id:'fixture-business',account_id:'fixture-account',
 platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};

function signed(overrides={}){
 const now=Date.now();
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:now-1,
  expires_at_ms:now+60000,job_id:job.id,business_id:job.business_id,account_id:job.account_id,
  platform:job.platform,revoked:false,max_mode:'PRELAUNCH',production_permission:true,
  publication_permission:false,...overrides});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
}

function fixture(){
 const db=new PodDB({bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 let txCalls=0;
 db.tx=async()=>{txCalls+=1;throw Error('UNEXPECTED_DATABASE_ACCESS');};
 return {db,txCalls:()=>txCalls};
}

function databaseFixture(insertResult){
 const db=new PodDB({bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 db.tx=async fn=>fn({query:async sql=>{
  if(sql.includes('SELECT * FROM pod_concepts'))return {rows:[{business_id:job.business_id,rights_state:'PASS',permanently_unpublished:false}]};
  return insertResult;
 }});
 return db;
}

for(const conceptId of [undefined,null,1,{},'', '   ', 'x'.repeat(257), 'bad\0concept', '\ud800']){
 test('malformed queue concept identity fails before database access: '+String(conceptId),async()=>{
  const {db,txCalls}=fixture();
  await assert.rejects(db.enqueue({job,upstream:signed(),conceptId,revision:1}),/QUEUE_SCOPE_INVALID/);
  assert.equal(txCalls(),0);
 });
}

for(const revision of [undefined,null,'1',true,0,-1,1.5,2147483648,NaN,Infinity]){
 test('malformed queue revision fails before database access: '+String(revision),async()=>{
  const {db,txCalls}=fixture();
  await assert.rejects(db.enqueue({job,upstream:signed(),conceptId:'fixture-concept',revision}),/QUEUE_SCOPE_INVALID/);
  assert.equal(txCalls(),0);
 });
}

test('authentication remains ahead of queue scope validation',async()=>{
 const {db,txCalls}=fixture();
 const upstream=signed();upstream.signature='0'.repeat(64);
 await assert.rejects(db.enqueue({job,upstream,conceptId:null,revision:0}),/SIGNATURE_INVALID/);
 assert.equal(txCalls(),0);
});

for(const revision of [1,2147483647])test('valid queue revision reaches the database unchanged: '+revision,async()=>{
 const db=new PodDB({bridge,upstreamKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 const queries=[];
 db.tx=async fn=>fn({query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.includes('SELECT * FROM pod_concepts'))return {rows:[{business_id:job.business_id,rights_state:'PASS',permanently_unpublished:false}]};
  return {rowCount:1,rows:[{id:job.id}]};
 }});
 await assert.doesNotReject(db.enqueue({job,upstream:signed(),conceptId:'fixture-concept',revision}));
 assert.deepEqual(queries[0].args,['fixture-concept']);
 assert.equal(queries[1].args[4],revision);
});

test('verified duplicate queue insert preserves the duplicate-job contract',async()=>{
 const db=databaseFixture({rowCount:0,rows:[]});
 await assert.rejects(db.enqueue({job,upstream:signed(),conceptId:'fixture-concept',revision:1}),/DUPLICATE_JOB/);
});

test('queue admission requires exact inert proof of the inserted job identity',async()=>{
 const probes=[];
 const variants=[
  {name:'missing row count',result:{rows:[{id:job.id}]}},
  {name:'mismatched id',result:{rowCount:1,rows:[{id:'different-job'}]}},
  {name:'extra returned field',result:{rowCount:1,rows:[{id:job.id,state:'raw'}]}},
  {name:'contradictory empty result',result:{rowCount:0,rows:[{id:job.id}]}},
  {name:'result accessor',result:Object.defineProperty({rowCount:1},'rows',{get(){probes.push('result accessor');return [{id:job.id}];}})},
  {name:'result Proxy',result:new Proxy({rowCount:1,rows:[{id:job.id}]},{get(target,key,receiver){if(key!=='then')probes.push('result Proxy');return Reflect.get(target,key,receiver);}})},
  {name:'rows Proxy',result:{rowCount:1,rows:new Proxy([{id:job.id}],{get(target,key,receiver){probes.push('rows Proxy');return Reflect.get(target,key,receiver);}})}},
  {name:'empty rows Proxy',result:{rowCount:0,rows:new Proxy([],{get(target,key,receiver){probes.push('empty rows Proxy');return Reflect.get(target,key,receiver);}})}},
  {name:'row Proxy',result:{rowCount:1,rows:[new Proxy({id:job.id},{get(target,key,receiver){probes.push('row Proxy');return Reflect.get(target,key,receiver);}})]}},
 ];
 for(const variant of variants){
  const db=databaseFixture(variant.result);
  await assert.rejects(db.enqueue({job,upstream:signed(),conceptId:'fixture-concept',revision:1}),
   error=>error?.message==='POD_MUTATION_UNVERIFIED',variant.name);
 }
 assert.deepEqual(probes,[]);
});
