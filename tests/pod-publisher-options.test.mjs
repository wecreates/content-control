import test from 'node:test';
import assert from 'node:assert/strict';
import {publishOnce,runPublisher} from '../scripts/pod_stealth_publisher.mjs';

const disabled=()=>({env:{PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
 db:{listReady:async()=>[]},log:()=>{}});
test('synthetic abort events do not accelerate publisher polling',{timeout:3000},async()=>{
 const controller=new AbortController();let reads=0,fakeTimer,abortTimer;
 try{
  fakeTimer=setTimeout(()=>controller.signal.dispatchEvent(new Event('abort')),10);
  abortTimer=setTimeout(()=>controller.abort(),40);
  await runPublisher({...disabled(),signal:controller.signal,db:{listReady:async()=>{reads++;return [];}}});
  assert.equal(reads,1);
 }finally{clearTimeout(fakeTimer);clearTimeout(abortTimer);controller.abort();}
});

for(const entry of [publishOnce,runPublisher])
test(entry.name+' rejects executable outer options before dry-run reads',async t=>{
 for(const key of ['db','env','accountId','adapters','resolveGrant','verifyArtifacts','upstreamKey','qaKey','log','signal'])
 await t.test(key,async()=>{
  let reads=0;
  const options=disabled();
  Object.defineProperty(options,key,{enumerable:true,get(){reads++;throw Error('private executable option');}});
  await assert.rejects(entry(options),/^Error: PUBLISH_OPTIONS_UNVERIFIED$/);
  assert.equal(reads,0);
 });
 let reads=0;
 const proxy=new Proxy(disabled(),{get(){reads++;throw Error('private option proxy');}});
 await assert.rejects(entry(proxy),/^Error: PUBLISH_OPTIONS_UNVERIFIED$/);
 assert.equal(reads,0);
});

for(const entry of [publishOnce,runPublisher])
test(entry.name+' rejects forged or executable cancellation without queue reads',async()=>{
 let touched=0,reads=0;
 for(const signal of [null,{},new Proxy(new AbortController().signal,{get(){reads++;return false;}}),
  Object.defineProperty({},'aborted',{get(){reads++;return false;}})]){
  const options={...disabled(),signal,db:{listReady:async()=>{touched++;return [];}}};
  await assert.rejects(entry(options),/^Error: PUBLISH_SIGNAL_UNVERIFIED$/);
 }
 assert.equal(touched,0);assert.equal(reads,0);
});

test('publisher uses native cancellation state rather than shadowed members',async()=>{
 const controller=new AbortController();let reads=0,logs=0;
 Object.defineProperty(controller.signal,'aborted',{get(){reads++;return false;}});
 Object.defineProperty(controller.signal,'throwIfAborted',{get(){reads++;return ()=>{};}});
 const options={...disabled(),signal:controller.signal,
  db:{listReady:async({signal})=>{assert.equal(signal,controller.signal);controller.abort();return [];}},
  log:()=>{logs++;}};
 assert.deepEqual(await publishOnce(options),{status:'STOPPED'});
 assert.equal(reads,0);assert.equal(logs,0);
});

test('plain disabled options and genuine un-aborted signals retain dry-run behavior',async()=>{
 const options=disabled();
 assert.deepEqual(await publishOnce(options),{status:'DRY_RUN',count:0});
 assert.deepEqual(await publishOnce({...options,signal:new AbortController().signal}),{status:'DRY_RUN',count:0});
});

test('publisher loop uses native cancellation after its dry-run read',async()=>{
 const controller=new AbortController();let reads=0,calls=0;
 Object.defineProperty(controller.signal,'aborted',{get(){reads++;return false;}});
 await runPublisher({...disabled(),signal:controller.signal,db:{listReady:async()=>{calls++;controller.abort();return [];}}});
 assert.equal(calls,1);assert.equal(reads,0);
});

test('publisher polling wait forwards cancellation without reading shadowed members',{timeout:3000},async()=>{
 const controller=new AbortController();let reads=0,calls=0,timer;
 for(const key of ['aborted','reason','addEventListener','removeEventListener'])
  Object.defineProperty(controller.signal,key,{get(){reads++;throw Error('shadowed signal member');}});
 try{
  await runPublisher({...disabled(),signal:controller.signal,db:{listReady:async()=>{
   calls++;timer=setTimeout(()=>controller.abort(),20);return [];
  }}});
  assert.equal(calls,1);assert.equal(reads,0);
 }finally{clearTimeout(timer);}
});
