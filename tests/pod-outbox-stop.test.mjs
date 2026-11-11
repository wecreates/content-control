import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
const env={POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:'k'.repeat(32)};

for(const failure of [false,true])
test('outbox stop honors native cancellation after delivery shadows signal '+failure,{timeout:3000},async()=>{
 let reads=0,calls=0,signal;
 const runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
  calls++;signal=options.signal;
  for(const key of ['aborted','reason','addEventListener','removeEventListener'])
   Object.defineProperty(signal,key,{get(){reads++;throw Error('private signal property');}});
  if(failure)throw Error('private delivery error');
  return {delivered:1,failed:0};
 }});
 await new Promise(resolve=>setImmediate(resolve));
 const before=runtime.status();await runtime.stop();
 assert.equal(before.status,failure?'RETRYING':'RUNNING');
 assert.equal(runtime.status().status,'STOPPED');assert.equal(reads,0);assert.equal(calls,1);
 assert.equal(runtime.status().delivered,failure?0:1);
 assert.equal(getEventListeners(signal,'abort').length,0);
});

test('outbox synthetic abort cannot accelerate retry or consume real cancellation',{timeout:3000},async()=>{
 let calls=0,signal,timer;
 const runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
  calls++;signal=options.signal;
  timer=setTimeout(()=>signal.dispatchEvent(new Event('abort')),10);
  return {delivered:0,failed:0};
 }});
 try{
  await new Promise(resolve=>setTimeout(resolve,40));await runtime.stop();
  assert.equal(calls,1);assert.equal(runtime.status().status,'STOPPED');
  assert.equal(getEventListeners(signal,'abort').length,0);
 }finally{clearTimeout(timer);await runtime.stop();}
});
