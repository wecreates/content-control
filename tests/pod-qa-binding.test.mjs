import test from 'node:test';
import assert from 'node:assert/strict';
import {enforceQA,enforceBrief,REQUIRED_QA} from '../integrations/pod/policy.mjs';
const checks=Object.fromEntries(REQUIRED_QA.map(k=>[k,true]));
test('KDP requires explicit editorial approval beyond technical and cover QA',()=>{
 const p='a'.repeat(64),t='b'.repeat(64),qa={verdict:'PASS',checks,package_sha256:p,template_sha256:t};
 for(const editorial of [undefined,false,1,'true'])assert.throws(()=>enforceQA({...qa,checks:{...checks,editorial}},p,t,'kdp'),/QA_BLOCKED/);
 assert.doesNotThrow(()=>enforceQA({...qa,checks:{...checks,editorial:true}},p,t,'kdp'));
 for(const platform of ['redbubble','teepublic','zazzle','spreadshirt'])assert.doesNotThrow(()=>enforceQA(qa,p,t,platform));
});
test('QA cannot pass by comparing missing or malformed package/template hashes',()=>{
 for(const hash of [undefined,null,'','bad','A'.repeat(64),['a'.repeat(64)]]){
  assert.throws(()=>enforceQA({verdict:'PASS',checks,package_sha256:hash,template_sha256:hash},hash,hash),/QA_BLOCKED/);
 }
});
test('QA requires each explicit binding to match independently',()=>{
 const p='a'.repeat(64),t='b'.repeat(64),qa={verdict:'PASS',checks,package_sha256:p,template_sha256:t};
 assert.doesNotThrow(()=>enforceQA(qa,p,t));
 assert.throws(()=>enforceQA(qa,'c'.repeat(64),t),/QA_BLOCKED/);
 assert.throws(()=>enforceQA(qa,p,'c'.repeat(64)),/QA_BLOCKED/);
 assert.throws(()=>enforceQA({...qa,package_sha256:undefined},undefined,t),/QA_BLOCKED/);
 assert.throws(()=>enforceQA({...qa,template_sha256:undefined},p,undefined),/QA_BLOCKED/);
});
test('publication permission still requires an explicit valid release package hash',()=>{
 for(const hash of [undefined,null,'','bad','A'.repeat(64)]){
  const job={id:'job',account_id:'account',business_id:'business',platform:'kdp',destination_platform:'kdp',mode:'LAUNCH',package_sha256:hash};
  const grant={job_id:job.id,account_id:job.account_id,business_id:job.business_id,platform:job.platform,
   max_mode:'LAUNCH',publication_permission:true,launch_content_allowed:true,revoked:false,package_sha256:hash};
  assert.throws(()=>enforceBrief(grant,job,{publishing:true}),/RELEASE_SCOPE_MISMATCH/);
 }
});
