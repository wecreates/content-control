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
  return {rows:[{id:job.id}]};
 }});
 await assert.doesNotReject(db.enqueue({job,upstream:signed(),conceptId:'fixture-concept',revision}));
 assert.deepEqual(queries[0].args,['fixture-concept']);
 assert.equal(queries[1].args[4],revision);
});
