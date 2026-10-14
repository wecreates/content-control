import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {publishOnce} from '../scripts/pod_stealth_publisher.mjs';

const key='synthetic-release-freshness-key-'.repeat(2);
const sign=p=>{const payload=JSON.stringify(p);return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
function fixture(now=Date.now()){
 const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),release_checks_passed:true};
 const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',platform:'redbubble',
  destination_platform:'redbubble',mode:'LAUNCH',package_sha256:manifest.package_sha256};
 const common={schema_version:1,issued_at_ms:now-1,expires_at_ms:now+60000};
 const release={...common,audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,
  platform:brief.platform,max_mode:'LAUNCH',launch_content_allowed:true,publication_permission:true,revoked:false,package_sha256:manifest.package_sha256};
 const qa=sign({...common,expires_at_ms:now+899000,audience:'content-control:pod:qa',verdict:'PASS',...manifest,
  checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight'].map(k=>[k,true]))});
 const job={id:brief.id,platform:brief.platform,brief,manifest,qa_envelope:qa,idempotency_key:'fixture-idempotency'};
 const events=[];
 // These enabled flags exercise an in-memory fake adapter only; no live env,
 // marketplace calls, credentials, listings or revenue are involved.
 const options={env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},accountId:brief.account_id,
  upstreamKey:key,qaKey:key,db:{claimPublish:async()=>job,assertPublishable:async()=>true,finish:async(_j,state)=>events.push(state)},
  verifyArtifacts:async()=>manifest,resolveGrant:async()=>sign(release),
  adapters:{redbubble:{authorized:true,submit:async()=>{events.push('submit');return {id:'fixture-receipt'};}}}};
 return {options,events,release,manifest};
}

test('revocation during artifact verification is observed before submission',async()=>{
 const f=fixture();let revoked=false;
 f.options.resolveGrant=async()=>{f.events.push('grant');return sign({...f.release,revoked});};
 f.options.verifyArtifacts=async()=>{f.events.push('artifacts');revoked=true;return f.manifest;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['artifacts','grant','blocked']);
});

test('grant that expires during artifact verification cannot reach adapter',async t=>{
 let now=2000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(now);
 f.options.verifyArtifacts=async()=>{now+=61000;return f.manifest;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('current grant is fetched after verified artifacts and submission uses same scoped bytes',async()=>{
 const f=fixture();
 f.options.resolveGrant=async(_job,{signal}={})=>{assert.equal(signal,f.options.signal);f.events.push('grant');return sign(f.release);};
 f.options.verifyArtifacts=async()=>{f.events.push('artifacts');return f.manifest;};
 f.options.signal=new AbortController().signal;
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['artifacts','grant','submit','submitted']);
});

test('cancellation during artifact verification never fetches a release grant or submits',async()=>{
 const f=fixture(),controller=new AbortController();f.options.signal=controller.signal;
 f.options.verifyArtifacts=async()=>{controller.abort();return f.manifest;};
 f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('expired lease or revoked local eligibility during grant fetch cannot submit',async()=>{
 for(const reason of ['LEASE_EXPIRED','ACCOUNT_DISABLED','RIGHTS_BLOCKED','FENCING_CHANGED']){
  const f=fixture();let eligible=true;
  f.options.resolveGrant=async()=>{eligible=false;return sign(f.release);};
  f.options.db.assertPublishable=async()=>{if(!eligible)throw Error(reason);return true;};
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(f.events,['blocked']);
 }
});
test('unverified or missing local eligibility result fails closed',async()=>{
 for(const result of [undefined,false,null,'true']){
  const f=fixture();f.options.db.assertPublishable=async()=>result;
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
 const f=fixture();delete f.options.db.assertPublishable;
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
});
test('grant expiry while waiting for local database validation cannot submit',async t=>{
 let now=3000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(now);f.options.db.assertPublishable=async()=>{now+=61000;return true;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
});
test('local eligibility is checked after grant resolution and before submission',async()=>{
 const f=fixture();f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
 f.options.db.assertPublishable=async()=>{f.events.push('eligibility');return true;};
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['grant','eligibility','submit','submitted']);
});
test('cancellation and kill switches are rechecked after local database validation',async()=>{
 for(const mode of ['abort','disable']){
  const f=fixture(),controller=new AbortController();f.options.signal=controller.signal;
  f.options.db.assertPublishable=async()=>{
   if(mode==='abort')controller.abort();else f.options.env.POD_PUBLICATION_ENABLED='false';
   return true;
  };
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
});
