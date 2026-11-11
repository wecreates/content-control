import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {runArchiveSession} from '../integrations/pod/archive-session.mjs';

test('archive cannot report success after timeout with a shadowed checkpoint',async()=>{
 await assert.rejects(runArchiveSession(async({signal})=>{
  Object.defineProperty(signal,'throwIfAborted',{value:()=>{}});
  await pause(40);return 'false success';
 },{timeoutMs:20,connect:()=>assert.fail('pool requested')}),/^Error: POD_ARCHIVE_TIMEOUT$/);
});
test('archive cleanup uses private cancellation despite shadowed work signal',async()=>{
 let ended=0;
 await assert.rejects(runArchiveSession(async({signal,openPool})=>{
  await openPool({});
  Object.defineProperty(signal,'aborted',{value:false});
  Object.defineProperty(signal,'throwIfAborted',{value:()=>{}});
  Object.defineProperty(signal,'addEventListener',{get(){assert.fail('public listener member');}});
  await pause(40);return 'false success';
 },{timeoutMs:20,connect:()=>({end(){ended++;return new Promise(()=>{});}})}),/^Error: POD_ARCHIVE_TIMEOUT$/);
 assert.equal(ended,1);
});
test('archive composes native source cancellation without public member access',async()=>{
 const controller=new AbortController();
 for(const key of ['aborted','reason','throwIfAborted','addEventListener','removeEventListener'])
  Object.defineProperty(controller.signal,key,{get(){assert.fail('public source member read');}});
 const value=await runArchiveSession(async()=>42,{signal:controller.signal,connect:()=>assert.fail('pool requested')});
 assert.equal(value,42);assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
test('archive ignores synthetic source abort but preserves genuine reason',async()=>{
 const controller=new AbortController(),reason=Error('stopped');let finish,entered;
 const started=new Promise(r=>entered=r);
 const operation=runArchiveSession(async()=>{entered();return new Promise(r=>finish=r);},{signal:controller.signal,connect:()=>{}});
 await started;controller.signal.dispatchEvent(new Event('abort'));controller.abort(reason);finish('commit settled');
 await assert.rejects(operation,e=>e===reason);assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
for(const proxy of [false,true])test(`archive rejects forged signal before work (Proxy=${proxy})`,async()=>{
 let reads=0;const trap=()=>{reads++;assert.fail('signal trap');};
 const target={get aborted(){return trap();}},signal=proxy?new Proxy(target,{get:trap}):target;
 await assert.rejects(runArchiveSession(()=>assert.fail('work started'),{signal,connect:()=>assert.fail('pool requested')}),TypeError);
 assert.equal(reads,0);
});
test('already aborted archive source preserves its exact reason without work',async()=>{
 const controller=new AbortController(),reason=Error('stopped');controller.abort(reason);
 Object.defineProperty(controller.signal,'aborted',{value:false});
 await assert.rejects(runArchiveSession(()=>assert.fail('work started'),{signal:controller.signal,connect:()=>{}}),e=>e===reason);
 assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
test('synthetic source abort cannot cancel a healthy archive session',async()=>{
 const controller=new AbortController();
 const value=await runArchiveSession(async({signal})=>{
  controller.signal.dispatchEvent(new Event('abort'));
  await pause(1);assert.equal(signal.aborted,false);return 42;
 },{signal:controller.signal,connect:()=>assert.fail('pool requested')});
 assert.equal(value,42);assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
