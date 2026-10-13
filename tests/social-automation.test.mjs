import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {EncryptedSocialStore,SocialAutomation,socialRuntimeReadiness} from '../social-automation.js';
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
