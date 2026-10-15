import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
import {productionFailure,productionReason} from '../integrations/pod/failure-reasons.mjs';

test('only fixed failure vocabulary can become an operational reason',()=>{
 for(const value of ['postgres://secret@host/db','TEXT_CLIPPED secret',null,{},'toString','__proto__']){
  assert.equal(productionReason(value),'PRODUCTION_BLOCKED');
  assert.equal(productionFailure({message:value}),'PRODUCTION_BLOCKED');
 }
 assert.equal(productionFailure({message:'PYTHON_STAGE_FAILED',reasonCode:'TEXT_CLIPPED'}),'TEXT_CLIPPED');
 assert.equal(productionFailure({message:'private',reasonCode:'TEXT_CLIPPED'}),'PRODUCTION_BLOCKED');
});

for(const [error,expected] of [
 [Error('ENVELOPE_EXPIRED_OR_INVALID'),'ENVELOPE_EXPIRED_OR_INVALID'],
 [Error('TEMPLATE_PROVENANCE_REQUIRED'),'TEMPLATE_PROVENANCE_REQUIRED'],
 [Error('private credential details'),'PRODUCTION_BLOCKED'],
 [Object.assign(Error('PYTHON_STAGE_FAILED'),{reasonCode:'NATIVE_RESOLUTION_INSUFFICIENT'}),'NATIVE_RESOLUTION_INSUFFICIENT']
])test('worker persists sanitized failure: '+expected,async()=>{
 const key='synthetic-key-'.repeat(4),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 let stored;
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
  db:{claimProduction:async()=>({id:'j',brief}),failProduction:async(job,reason)=>{stored=reason;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>{throw error;}});
 assert.equal(stored,expected);assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:expected});
 assert.ok(!JSON.stringify(result).includes('private'));
});
