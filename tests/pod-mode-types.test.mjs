import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {enforceBrief,verifyEnvelope} from '../integrations/pod/policy.mjs';
function fixture(){return {
 job:{id:'job',business_id:'b',account_id:'a',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'},
 grant:{job_id:'job',business_id:'b',account_id:'a',platform:'kdp',max_mode:'LAUNCH',production_permission:true,
  publication_permission:false,launch_content_allowed:false,revoked:false}};}
const invalidModes=[['LAUNCH'],['PRELAUNCH'],['RESEARCH'],new String('LAUNCH'),{toString:()=> 'LAUNCH'},null,0,true,'launch','LAUNCH\n'];
test('non-string job modes cannot bypass launch-specific permission checks',()=>{
 for(const mode of invalidModes){const {job,grant}=fixture();job.mode=mode;
  assert.throws(()=>enforceBrief(grant,job),/READINESS_CEILING/);}
});
test('non-string grant ceilings cannot authorize production or publishing',()=>{
 for(const mode of invalidModes)for(const publishing of [false,true]){
  const {job,grant}=fixture();grant.max_mode=mode;
  job.mode='LAUNCH';job.package_sha256='a'.repeat(64);grant.package_sha256=job.package_sha256;
  grant.publication_permission=true;grant.launch_content_allowed=true;
  assert.throws(()=>enforceBrief(grant,job,{publishing}),/READINESS_CEILING/);
 }
});
test('valid signature does not make an array readiness ceiling authoritative',()=>{
 const {job,grant}=fixture(),now=1700000000000,key='fixture-only-signing-key'.repeat(2);
 const payload=JSON.stringify({...grant,max_mode:['LAUNCH'],schema_version:1,audience:'content-control:pod',issued_at_ms:now,expires_at_ms:now+60000});
 const verified=verifyEnvelope({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')},key,'content-control:pod',now);
 assert.throws(()=>enforceBrief(verified,job),/READINESS_CEILING/);
});
test('exact mode strings retain all readiness ceilings and launch permissions',()=>{
 const modes=['RESEARCH','PRELAUNCH','LAUNCH'];
 for(let ceiling=0;ceiling<modes.length;ceiling++)for(let requested=0;requested<modes.length;requested++){
  const {job,grant}=fixture();job.mode=modes[requested];grant.max_mode=modes[ceiling];
  grant.publication_permission=true;grant.launch_content_allowed=true;
  if(requested>ceiling)assert.throws(()=>enforceBrief(grant,job),/READINESS_CEILING/);
  else assert.equal(enforceBrief(grant,job).mode,job.mode);
 }
 const {job,grant}=fixture();job.mode='LAUNCH';
 assert.throws(()=>enforceBrief(grant,job),/PUBLICATION_PERMISSION_REQUIRED/);
 grant.publication_permission=true;assert.throws(()=>enforceBrief(grant,job),/LAUNCH_BLOCKED/);
});
