import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {EncryptedSocialStore,SocialAutomation,ownerReadProgress,socialRuntimeReadiness} from '../social-automation.js';
import {SocialReadWorker} from '../integrations/social-automation/worker.mjs';
async function setup(t,adapter={}){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'social-runtime-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'vault');const store=new EncryptedSocialStore({file,key:'a'.repeat(64)});let now=100000;const runtime=new SocialAutomation({store,now:()=>now,adapters:{instagram:{verify:async g=>({account_id:g.account_id,verified:true}),...adapter}}});return {store,runtime,file,advance:n=>now+=n,grant:{access_token:'PRIVATE_TOKEN',account_id:'private_account',scopes:['basic'],expires_at:now+172800000}};}
test('credentials encrypted and public projection excludes secrets across restart',async t=>{const x=await setup(t);await x.runtime.connect('instagram',x.grant);assert.ok(!(await fs.readFile(x.file,'utf8')).includes('PRIVATE_TOKEN'));const restored=new EncryptedSocialStore({file:x.file,key:'a'.repeat(64)});assert.equal((await restored.read()).connections.instagram.access_token,'PRIVATE_TOKEN');assert.ok(!JSON.stringify(await x.runtime.status()).includes('PRIVATE_TOKEN'));await assert.rejects(new EncryptedSocialStore({file:x.file,key:'b'.repeat(64)}).read(),/INTEGRITY/)});
test('idempotent concurrent ticks invoke read once and refuse publishing',async t=>{let calls=0;const x=await setup(t,{read_media:async()=>{calls++;return {};}});await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'one',platform:'instagram',operation:'read_media'});assert.equal((await x.runtime.enqueue({id:'one',platform:'instagram',operation:'read_media'})).created,false);await assert.rejects(x.runtime.enqueue({id:'one',platform:'instagram',operation:'read_profile'}),/CONFLICT/);await assert.rejects(x.runtime.enqueue({id:'post',platform:'instagram',operation:'publish'}),/DISABLED/);await Promise.all([x.runtime.tick(),x.runtime.tick()]);await x.runtime.tick();assert.equal(calls,1)});
test('renewal precedes read',async t=>{let refreshed=0;const x=await setup(t,{refresh:async g=>(refreshed++,{...g,access_token:'RENEWED',expires_at:400000000}),read_media:async g=>{assert.equal(g.access_token,'RENEWED');return {}}});await x.runtime.connect('instagram',x.grant);x.advance(100000000);await x.runtime.enqueue({id:'renew',platform:'instagram',operation:'read_media'});await x.runtime.tick();assert.equal(refreshed,1);assert.equal((await x.runtime.status()).jobs[0].status,'completed')});
test('bounded retry and error redaction',async t=>{const x=await setup(t,{read_media:async()=>{throw Error('PRIVATE_TOKEN provider internals')}});await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'fail',platform:'instagram',operation:'read_media'});for(let i=0;i<3;i++){await x.runtime.tick();x.advance(4000000)}const s=await x.runtime.status();assert.equal(s.jobs[0].status,'blocked');assert.equal(s.jobs[0].attempts,3);assert.ok(!JSON.stringify(s).includes('PRIVATE_TOKEN'))});
test('empty environment and no adapter cannot claim activated runtime',async t=>{assert.equal(socialRuntimeReadiness({}).worker_running,false);const x=await setup(t);await assert.rejects(x.runtime.connect('youtube',x.grant),/ADAPTER/)});

test('refresh failures exhaust retry budget without reading media',async t=>{let reads=0;const x=await setup(t,{refresh:async()=>{throw Error('network')},read_media:async()=>{reads++;return {};}});await x.runtime.connect('instagram',x.grant);x.advance(100000000);await x.runtime.enqueue({id:'refresh-fail',platform:'instagram',operation:'read_media'});for(let i=0;i<4;i++){await x.runtime.tick();x.advance(4000000)}assert.equal(reads,0);const j=(await x.runtime.status()).jobs[0];assert.equal(j.status,'blocked');assert.equal(j.attempts,3)});
test('revoked authorization blocks subsequent calls',async t=>{const x=await setup(t,{read_media:async()=>{throw Error('REAUTHORIZE')}});await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'revoked',platform:'instagram',operation:'read_media'});await x.runtime.tick();assert.equal((await x.runtime.status()).connections[0].status,'reauthorization_required');assert.equal((await x.runtime.status()).jobs[0].status,'blocked')});
test('read results are encrypted and omitted from public status',async t=>{const x=await setup(t,{read_media:async()=>({caption:'PRIVATE_CAPTION'})});await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'result',platform:'instagram',operation:'read_media'});await x.runtime.tick();assert.equal((await x.store.read()).jobs[0].result.caption,'PRIVATE_CAPTION');assert.ok(!(await fs.readFile(x.file,'utf8')).includes('PRIVATE_CAPTION'));assert.ok(!JSON.stringify(await x.runtime.status()).includes('PRIVATE_CAPTION'))});


test('valid short-lived grant reads until expiry without requiring unsupported renewal',async t=>{
 let reads=0;const x=await setup(t,{read_media:async()=>{reads++;return {};}});x.grant.expires_at=160000;
 await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'short',platform:'instagram',operation:'read_media'});await x.runtime.tick();
 assert.equal(reads,1);assert.equal((await x.runtime.status()).jobs[0].status,'completed');
 x.advance(60001);await x.runtime.enqueue({id:'expired',platform:'instagram',operation:'read_media'});await x.runtime.tick();
 assert.equal(reads,1);assert.equal((await x.runtime.status()).jobs[1].reason,'REAUTHORIZE');
});
test('renewed short-lived token is usable and account switching is rejected',async t=>{
 let reads=0;const x=await setup(t,{refresh:async g=>({...g,access_token:'SHORT_NEW',expires_at:200000}),read_media:async g=>{assert.equal(g.access_token,'SHORT_NEW');reads++;return {}}});
 x.grant.expires_at=160000;await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'short-renew',platform:'instagram',operation:'read_media'});await x.runtime.tick();assert.equal(reads,1);
 x.runtime.adapters.instagram.refresh=async g=>({...g,account_id:'other',expires_at:250000});await x.runtime.enqueue({id:'wrong-account',platform:'instagram',operation:'read_media'});await x.runtime.tick();assert.equal(reads,1);assert.equal((await x.runtime.status()).jobs[1].status,'blocked');
});
test('hanging provider cannot hold the store or tick indefinitely',async t=>{
 let signal;const x=await setup(t,{read_media:async(_g,_p,ctx)=>{signal=ctx.signal;return new Promise(()=>{})}});x.runtime.providerTimeoutMs=20;
 await x.runtime.connect('instagram',x.grant);await x.runtime.enqueue({id:'timeout',platform:'instagram',operation:'read_media'});
 await x.runtime.tick();assert.equal(signal.aborted,true);assert.equal((await x.runtime.status()).jobs[0].status,'retry');
 await x.runtime.enqueue({id:'next',platform:'instagram',operation:'read_profile'});assert.equal((await x.runtime.status()).jobs.length,2);
});
test('hanging identity verification times out without storing a connection',async t=>{
 const x=await setup(t,{verify:async()=>new Promise(()=>{})});x.runtime.providerTimeoutMs=20;
 await assert.rejects(x.runtime.connect('instagram',x.grant),/PROVIDER_TIMEOUT/);assert.deepEqual((await x.store.read()).connections,{});
});

test('authorization cancellation during identity verification never persists a late grant',async t=>{
 let release,started;const ready=new Promise(r=>started=r);const controller=new AbortController();
 const x=await setup(t,{verify:async(g,{signal})=>{started();await new Promise(r=>release=r);assert.equal(signal.aborted,true);return {verified:true,account_id:g.account_id};}});
 const pending=x.runtime.connect('instagram',x.grant,{signal:controller.signal});await ready;controller.abort();
 await assert.rejects(pending,/AUTHORIZATION_CANCELLED/);release();await new Promise(r=>setImmediate(r));
 assert.deepEqual((await x.store.read()).connections,{});
});
test('grant expiring during verification cannot be persisted as connected',async t=>{
 const x=await setup(t);x.runtime.adapters.instagram.verify=async g=>{x.advance(200000000);return {verified:true,account_id:g.account_id};};
 await assert.rejects(x.runtime.connect('instagram',x.grant),/INVALID_AUTHORIZATION/);
 assert.deepEqual((await x.store.read()).connections,{});
});

test('empty or primitive provider responses cannot mark a read verified',async t=>{
 for(const result of [undefined,null,false,42,'ok',[]]){
  const x=await setup(t,{read_media:async()=>result});await x.runtime.connect('instagram',x.grant);
  await x.runtime.enqueue({id:'bad',platform:'instagram',operation:'read_media'});await x.runtime.tick();
  const d=await x.store.read();assert.equal(d.jobs[0].status,'retry');assert.equal(d.connections.instagram.last_read_at,undefined);assert.equal(d.jobs[0].completed_at,undefined);
 }
});

test('first retained read belongs to the current verified grant and survives encrypted reload', async t=>{
 let calls=0;
 const x=await setup(t,{read_media:async()=>{calls++;return {caption:'PRIVATE_RESULT'};}});
 const state=async()=>new EncryptedSocialStore({file:x.file,key:'a'.repeat(64)}).read();
 const progress=async()=>ownerReadProgress(await state(),['instagram'],x.runtime.now());
 const instagram=async()=>(await progress()).providers.find(p=>p.platform==='instagram');
 const worker=new SocialReadWorker({runtime:x.runtime,now:x.runtime.now});
 assert.equal((await instagram()).status,'CONNECTION_REQUIRED');
 await x.runtime.connect('instagram',x.grant);
 const firstGrant=(await state()).connections.instagram;
 assert.equal((await instagram()).status,'FIRST_READ_PENDING');
 await worker.cycle();
 const first=await instagram();
 assert.equal(first.status,'FIRST_READ_RETAINED');
 assert.equal(first.first_read_completed_at,100000);
 assert.equal(first.first_read_operation,'read_media');
 const before=await fs.readFile(x.file);
 const view=JSON.stringify(await progress());
 for(const privateValue of [firstGrant.generation,x.grant.account_id,'PRIVATE_TOKEN','PRIVATE_RESULT','poll_']) {
  assert.ok(!view.includes(privateValue));
 }
 assert.deepEqual(await fs.readFile(x.file),before);
 await x.runtime.connect('instagram',x.grant);
 const secondGrant=(await state()).connections.instagram;
 assert.equal(secondGrant.verified_at,firstGrant.verified_at);
 assert.notEqual(secondGrant.generation,firstGrant.generation);
 assert.equal((await instagram()).status,'FIRST_READ_PENDING');
 await worker.cycle();
 assert.equal(calls,2);
 assert.equal((await instagram()).status,'FIRST_READ_RETAINED');
 x.advance(10);
 await x.runtime.enqueue({id:'later',platform:'instagram',operation:'read_media'});
 assert.equal((await instagram()).first_read_job_status,'COMPLETED');
 await x.runtime.tick();
 assert.equal((await instagram()).first_read_completed_at,100000);
 await x.store.update(d=>{ d.connections.instagram.status='reauthorization_required'; });
 assert.equal((await instagram()).status,'REAUTHORIZATION_REQUIRED');
 assert.equal((await instagram()).first_read_completed_at,null);
 await x.store.update(d=>{ d.connections.instagram.status='connected'; delete d.connections.instagram.generation; });
 assert.equal((await instagram()).status,'FIRST_READ_PENDING');
 x.advance(200000000);
 assert.equal((await instagram()).status,'REAUTHORIZATION_REQUIRED');
});

test('owner first-read phase shows actual retries and a blocked read without exposing old grant details',async t=>{
 let reads=0;
 const x=await setup(t,{read_media:async()=>{
  if(++reads<=3)throw Error('PRIVATE_PROVIDER_FAILURE');
  return {caption:'PRIVATE_RESULT'};
 }});
 const progress=async()=>ownerReadProgress(await x.store.read(),['instagram'],x.runtime.now());
 const instagram=async()=>(await progress()).providers[1];
 const phase=async()=> (await instagram()).first_read_job_status;
 const worker=new SocialReadWorker({runtime:x.runtime,now:x.runtime.now});
 assert.equal(await phase(),null);
 await x.runtime.connect('instagram',x.grant);
 const original=(await x.store.read()).connections.instagram;
 assert.equal(await phase(),'NOT_QUEUED');
 await x.runtime.enqueue({id:'private-first-job',platform:'instagram',operation:'read_media'});
 assert.equal(await phase(),'QUEUED');
 for(const [delay, expected] of [[120001,'RETRY_PENDING'],[240001,'RETRY_PENDING'],[0,'BLOCKED']]){
  assert.equal((await worker.cycle()).status,expected==='BLOCKED'?'CYCLE_BLOCKED':'CYCLE_RETRY_PENDING');
  assert.equal(await phase(),expected);
  assert.equal((await instagram()).status,'FIRST_READ_PENDING');
  x.advance(delay);
 }
 const before=await fs.readFile(x.file);
 const view=JSON.stringify(await progress());
 for(const privateValue of [original.generation,x.grant.account_id,x.grant.access_token,'private-first-job','PRIVATE_PROVIDER_FAILURE','PROVIDER_FAILED']){
  assert.ok(!view.includes(privateValue));
 }
 assert.deepEqual(await fs.readFile(x.file),before);
 await x.runtime.enqueue({id:'second-read',platform:'instagram',operation:'read_profile'});
 assert.equal(await phase(),'QUEUED');
 await x.runtime.connect('instagram',x.grant);
 assert.equal(await phase(),'NOT_QUEUED');
 assert.equal((await worker.cycle()).status,'CYCLE_COMPLETED');
 assert.equal((await instagram()).status,'FIRST_READ_RETAINED');
 assert.equal(await phase(),'COMPLETED');
 assert.equal(reads,4);
 await x.store.update(d=>{ delete d.connections.instagram.generation; });
 assert.equal(await phase(),null);
});
