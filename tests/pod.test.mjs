import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyEnvelope,enforceBrief,enforceQA,assertBridge,BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {publishOnce} from '../scripts/pod_stealth_publisher.mjs';
import {economicsFixture} from './pod-economics-fixture.mjs';
const key='test-only-key-never-use-in-production';
function signed(p){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-100,expires_at_ms:Date.now()+60000,...p});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};}
function fixture(){
 const job={id:'job',account_id:'account',business_id:'business',platform:'kdp',destination_platform:'kdp',mode:'LAUNCH',package_sha256:'a'.repeat(64)};
 const grant={job_id:'job',account_id:'account',business_id:'business',platform:'kdp',max_mode:'LAUNCH',launch_content_allowed:true,publication_permission:true,revoked:false,package_sha256:job.package_sha256,...economicsFixture(job)};return {job,grant};
}
test('valid envelope verifies',()=>assert.equal(verifyEnvelope(signed({}),key,'content-control:pod').schema_version,1));
test('tampered envelope fails',()=>{const e=signed({});e.payload+=' ';assert.throws(()=>verifyEnvelope(e,key,'content-control:pod'));});
test('expired envelope fails',()=>assert.throws(()=>verifyEnvelope(signed({expires_at_ms:0}),key,'content-control:pod')));
test('wrong audience fails',()=>assert.throws(()=>verifyEnvelope(signed({}),key,'wrong')));
test('complete native bridge required',()=>assertBridge({producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}}));
test('missing native rules fail',()=>assert.throws(()=>assertBridge({})));
for(const [name,change] of [
 ['missing permission',f=>delete f.grant.publication_permission],
 ['false permission',f=>f.grant.publication_permission=false],
 ['readiness ceiling',f=>f.grant.max_mode='PRELAUNCH'],
 ['unknown mode',f=>f.job.mode='YES'],
 ['Etsy',f=>f.job.platform='etsy'],
 ['indirect Etsy',f=>f.job.destination_platform='etsy'],
 ['scope mismatch',f=>f.grant.account_id='other'],
 ['revocation',f=>f.grant.revoked=true]])test(name,()=>{const f=fixture();change(f);assert.throws(()=>enforceBrief(f.grant,f.job,{publishing:true}));});
test('claims and price are omitted unless verified upstream',()=>{
 const f=fixture();f.job.claims=['invented'];f.grant.price={verified:false,amount_minor:1};
 f.grant.verified_facts={title:{value:'Allowed title',verified:true,evidence_ids:['e']},shipping:{value:'Tomorrow',verified:true,evidence_ids:['e']}};
 const b=enforceBrief(f.grant,f.job);assert.equal(b.price,null);assert.deepEqual(Object.keys(b.facts),['title']);assert.equal(b.claims,undefined);
});
test('missing QA checks cannot pass vacuously',()=>assert.throws(()=>enforceQA({verdict:'PASS'},'x','y')));
test('forbidden upstream claim stays omitted despite verified flag',()=>{
 const f=fixture();f.grant.forbidden_claims=['title'];f.grant.verified_facts={title:{value:'Blocked',verified:true,evidence_ids:['e']}};
 assert.deepEqual(enforceBrief(f.grant,f.job).facts,{});
});
test('dry run never claims or invokes publishing dependencies',async()=>{
 let reads=0;const db={listReady:async()=>{reads++;return [];},claimPublish:()=>{throw Error('MUTATION');}};
 const r=await publishOnce({db,env:{PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'true'},log:()=>{}});assert.equal(r.status,'DRY_RUN');assert.equal(reads,1);
});
test('missing environment fails to dry run',async()=>{assert.equal((await publishOnce({db:{listReady:async()=>[]},env:{},log:()=>{}})).status,'DRY_RUN');});
test('unregistered adapter blocks without submission',async()=>{
 const f=fixture();let state;const db={claimPublish:async()=>({...f.job,brief:f.job}),finish:async(_j,s)=>{state=s;}};
 await publishOnce({db,env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},resolveGrant:async()=>signed(f.grant),verifyArtifacts:async()=>({}),upstreamKey:key,qaKey:key});assert.equal(state,'blocked');
});
test('timeout after submission is ambiguous and never retried',async()=>{
 const f=fixture();const template='b'.repeat(64);let calls=0,state;
 const qa=signed({audience:'content-control:pod:qa',verdict:'PASS',package_sha256:f.job.package_sha256,template_sha256:template,
  checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details','editorial'].map(k=>[k,true]))});
 const db={claimPublish:async()=>({...f.job,brief:f.job,manifest:{package_sha256:f.job.package_sha256},qa_envelope:qa}),assertPublishable:async()=>true,finish:async(_j,s)=>{state=s;}};
 await publishOnce({db,env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},
  adapters:{kdp:{authorized:true,submit:async()=>{calls++;throw Error('timeout');}}},
  resolveGrant:async()=>signed(f.grant),verifyArtifacts:async()=>({package_sha256:f.job.package_sha256,template_sha256:template,release_checks_passed:true}),upstreamKey:key,qaKey:key});
 assert.equal(calls,1);assert.equal(state,'ambiguous');
});
test('production permission permits PRELAUNCH but never publication',()=>{
 const {job,grant}=fixture();job.mode='PRELAUNCH';grant.publication_permission=false;grant.production_permission=true;
 assert.equal(enforceBrief(grant,job).mode,'PRELAUNCH');
 assert.throws(()=>enforceBrief(grant,job,{publishing:true}),/PUBLICATION_PERMISSION_REQUIRED/);
 grant.revoked=true;assert.throws(()=>enforceBrief(grant,job),/APPROVAL_REVOKED/);
});
test('task inputs are bound to the authoritative grant',()=>{
 const {job,grant}=fixture();job.task_sha256='a'.repeat(64);
 assert.throws(()=>enforceBrief(grant,job),/TASK_SCOPE_MISMATCH/);
 grant.task_sha256=job.task_sha256;
 assert.equal(enforceBrief(grant,job).task_sha256,job.task_sha256);
});

