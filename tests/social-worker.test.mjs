import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createInstagramAdapter} from '../integrations/social-automation/instagram-adapter.mjs';
import {SocialReadWorker} from '../integrations/social-automation/worker.mjs';
import {SocialAutomation, EncryptedSocialStore} from '../social-automation.js';
const grant = {account_id:'1234',access_token:'PRIVATE',scopes:['instagram_basic'],expires_at:200000000};
function response(data,status=200){return new Response(JSON.stringify(data),{status});}
async function fixture(t,adapter){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'social-worker-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=new EncryptedSocialStore({file:path.join(dir,'vault'),key:'b'.repeat(64)});const runtime=new SocialAutomation({store,adapters:{instagram:adapter},now:()=>100000});await runtime.connect('instagram',grant);return {runtime,store};}
test('Instagram adapter limits hosts, fields, response pages and methods',async()=>{
 const calls=[];
 const adapter=createInstagramAdapter({fetchImpl:async(url,options)=>{calls.push({url,options});return response(url.pathname.endsWith('/media')?{data:[{id:'88',media_type:'VIDEO',media_product_type:'REELS',access_token:'SHOULD_DROP'}],paging:{next:'https://evil.test'}}:{id:'1234',username:'owner',access_token:'SHOULD_DROP'});}});
 const result=await adapter.read_media(grant,{url:'https://evil.test'});
 assert.equal(calls.length,2);assert.equal(result.full_analysis,false);assert.equal(result.pagination_followed,false);assert.equal(result.items[0].access_token,undefined);
 for(const {url,options} of calls){assert.equal(url.origin,'https://graph.facebook.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer PRIVATE');assert.ok(!String(url).includes('PRIVATE'));assert.ok(options.signal instanceof AbortSignal);}
 assert.equal(calls[1].url.searchParams.get('limit'),'5');assert.equal(adapter.publish,undefined);assert.equal(adapter.refresh,undefined);
});
test('Instagram adapter sanitizes provider errors and rejects identity mismatch',async()=>{
 for(const [code,message] of [[190,'REAUTHORIZE'],[10,'PERMISSION_DENIED'],[4,'PROVIDER_FAILED']]){const a=createInstagramAdapter({fetchImpl:async()=>response({error:{code,message:'PRIVATE'}},400)});await assert.rejects(a.verify(grant),e=>e.message===message);}
 const a=createInstagramAdapter({fetchImpl:async()=>response({id:'999',username:'other'})});await assert.rejects(a.verify(grant),/ACCOUNT_VERIFICATION/);
 const b=createInstagramAdapter({fetchImpl:async()=>{throw Error('PRIVATE')}});await assert.rejects(b.verify(grant),e=>e.message==='PROVIDER_FAILED');
});
test('oversized response and invalid account path are refused',async()=>{
 const a=createInstagramAdapter({fetchImpl:async()=>response({data:'x'.repeat(262145)})});await assert.rejects(a.verify(grant),/PROVIDER_FAILED/);
 let calls=0;const b=createInstagramAdapter({fetchImpl:async()=>{calls++;}});await assert.rejects(b.verify({...grant,account_id:'../../me'}),/REAUTHORIZE/);assert.equal(calls,0);
});
test('worker resumes persisted jobs and deduplicates repeated cycles across restart',async t=>{
 let reads=0;const adapter={verify:async g=>({verified:true,account_id:g.account_id}),read_media:async()=>{reads++;return {items:[],full_analysis:false};}};
 const {runtime,store}=await fixture(t,adapter);const worker=new SocialReadWorker({runtime,now:()=>100000});
 await Promise.all([worker.cycle(),worker.cycle()]);await worker.cycle();
 const restored=new SocialAutomation({store:new EncryptedSocialStore({file:store.file,key:'b'.repeat(64)}),adapters:{instagram:adapter},now:()=>100000});await new SocialReadWorker({runtime:restored,now:()=>100000}).cycle();
 assert.equal(reads,1);assert.equal((await store.read()).jobs[0].result.full_analysis,false);assert.equal(worker.status().worker_running,false);
});
test('worker stops scheduling after revoked authorization and never starts twice',async t=>{
 let reads=0;const {runtime}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id}),read_media:async()=>{reads++;throw Error('REAUTHORIZE');}});
 let timers=0,clears=0;const worker=new SocialReadWorker({runtime,now:()=>100000,setTimer:()=>{timers++;return 5;},clearTimer:()=>clears++});
 worker.start();worker.start();await worker.cycle();await worker.stop();await worker.cycle();
 assert.equal(reads,1);assert.equal(timers,1);assert.equal(clears,1);assert.equal(worker.status().publication_enabled,false);assert.equal(worker.status().worker_running,false);
});
test('overlapping store instances refuse concurrent writes without deleting owner lock',async t=>{
 const {store}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id})});let release,started;const ready=new Promise(r=>started=r);const held=store.update(async d=>{started();await new Promise(r=>release=r);d.marker=1;});await ready;
 const second=new EncryptedSocialStore({file:store.file,key:'b'.repeat(64)});await assert.rejects(second.update(d=>{d.marker=2}),/PRIVATE_STORE_BUSY/);await fs.access(store.file+'.lock');release();await held;assert.equal((await second.read()).marker,1);
 await second.update(d=>{d.marker=2});assert.equal((await store.read()).marker,2);
});
test('queued jobs cannot switch accounts after reauthorization',async t=>{
 let calls=0;const {runtime}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id}),read_media:async()=>calls++});await runtime.enqueue({id:'old-account',platform:'instagram',operation:'read_media'});await runtime.connect('instagram',{...grant,account_id:'999'});await runtime.tick();assert.equal(calls,0);assert.equal((await runtime.status()).jobs[0].reason,'ACCOUNT_CHANGED');
});


test('hosted service stays off by default and refuses incomplete activation without network',async()=>{
 const {initializeSocialService}=await import('../integrations/social-automation/hosted-service.mjs');
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('unexpected');};
 const off=await initializeSocialService({env:{},fetchImpl});assert.equal(off.status().worker_running,false);assert.equal(off.status().status,'NOT_ACTIVATED');
 const blocked=await initializeSocialService({env:{SOCIAL_WORKER_ENABLED:'true',SOCIAL_VAULT_KEY:'PRIVATE'},fetchImpl});assert.equal(blocked.status().status,'ACTIVATION_BLOCKED');assert.ok(!JSON.stringify(blocked.status()).includes('PRIVATE'));assert.equal(calls,0);
});

test('hosted service runs a configured private vault without exposing its results',async t=>{
 const {initializeSocialService}=await import('../integrations/social-automation/hosted-service.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hosted-social-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'vault');const store=new EncryptedSocialStore({file,key:'c'.repeat(64)});
 await store.update(d=>{d.connections.instagram={...grant,expires_at:Date.now()+172800000,status:'connected'};});
 const service=await initializeSocialService({env:{SOCIAL_WORKER_ENABLED:'true',SOCIAL_STORAGE_MODE:'private_durable',SOCIAL_VAULT_FILE:file,SOCIAL_VAULT_KEY:'c'.repeat(64)},fetchImpl:async url=>response(url.pathname.endsWith('/media')?{data:[{id:'55',media_type:'VIDEO'}]}:{id:grant.account_id,username:'PRIVATE_USERNAME'})});
 assert.equal(service.status().status,'READ_WORKER_STARTED');assert.equal(service.status().durable_storage_verified,false);assert.equal(service.status().oauth_routes_enabled,false);
 for(let turns=0;service.status().last_cycle.last_completed_at===null&&turns<1000;turns++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(service.status().last_cycle.status,'CYCLE_COMPLETED');
 await service.stop();const state=await store.read();assert.equal(state.jobs[0].status,'completed');assert.equal(state.jobs[0].result.full_analysis,false);assert.ok(!JSON.stringify(service.status()).includes('PRIVATE_USERNAME'));
});

test('vault inside application directory cannot be activated',async t=>{
 const {initializeSocialService}=await import('../integrations/social-automation/hosted-service.mjs');
 const {store}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id})});
 const service=await initializeSocialService({root:path.dirname(store.file),env:{SOCIAL_WORKER_ENABLED:'true',SOCIAL_STORAGE_MODE:'private_durable',SOCIAL_VAULT_FILE:store.file,SOCIAL_VAULT_KEY:'b'.repeat(64)}});
 assert.equal(service.status().status,'ACTIVATION_BLOCKED');assert.equal(service.status().worker_running,false);
});

test('full queue still drains existing due jobs and reports capacity without deleting history',async t=>{
 let reads=0;const {runtime,store}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id}),read_profile:async()=>{reads++;return {};},read_media:async()=>{throw Error('must not enqueue');}});
 await runtime.enqueue({id:'due-profile',platform:'instagram',operation:'read_profile'});
 await store.update(d=>{for(let i=0;i<999;i++)d.jobs.push({id:`history-${i}`,platform:'instagram',operation:'read_profile',status:'completed',result:{preserved:i}});});
 const worker=new SocialReadWorker({runtime,now:()=>100000});const result=await worker.cycle();
 assert.equal(reads,1);assert.equal(result.status,'CYCLE_BLOCKED');assert.equal(result.reason,'QUEUE_CAPACITY_REACHED');assert.equal(result.publication_enabled,false);
 const saved=await store.read();assert.equal(saved.jobs.length,1000);assert.equal(saved.jobs[0].status,'completed');assert.deepEqual(saved.jobs[999].result,{preserved:998});
});
test('expired refreshable grant schedules renewal while unsupported expiry never calls provider',async t=>{
 let refreshes=0,reads=0;const {runtime,store}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id}),refresh:async g=>{refreshes++;return {...g,expires_at:200000000};},read_media:async()=>{reads++;return {};}});
 await store.update(d=>{d.connections.instagram.expires_at=99999;});
 await new SocialReadWorker({runtime,now:()=>100000}).cycle();assert.equal(refreshes,1);assert.equal(reads,1);assert.equal((await store.read()).jobs[0].status,'completed');
 delete runtime.adapters.instagram.refresh;await store.update(d=>{d.connections.instagram.expires_at=99999;});
 await new SocialReadWorker({runtime,now:()=>200000}).cycle();assert.equal(reads,1);
});
test('new verified grant recovers blocked same-bucket poll without retrying old failed job',async t=>{
 let reads=0;const {runtime,store}=await fixture(t,{verify:async g=>({verified:true,account_id:g.account_id}),read_media:async()=>{reads++;if(reads===1)throw Error('REAUTHORIZE');return {};}});
 let now=100000;runtime.now=()=>now;const worker=new SocialReadWorker({runtime,now:()=>now});await worker.cycle();assert.equal((await store.read()).jobs[0].status,'blocked');
 now++;await runtime.connect('instagram',grant);await worker.cycle();await worker.cycle();
 const jobs=(await store.read()).jobs;assert.equal(reads,2);assert.equal(jobs.length,2);assert.equal(jobs[0].status,'blocked');assert.equal(jobs[0].attempts,1);assert.equal(jobs[1].status,'completed');
});
