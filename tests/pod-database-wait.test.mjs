import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseWait} from '../integrations/pod/database-wait.mjs';

test('forged abort-listener capability cannot start database work',async()=>{
 let calls=0,reads=0;
 const signal={aborted:false,reason:undefined,
  addEventListener(){reads++;throw Error('private listener failure');},removeEventListener(){}};
 const waiting=databaseWait(signal);
 await assert.rejects(waiting.step(()=>{calls++;return new Promise(()=>{});}),/^TypeError: POD_DATABASE_SIGNAL_INVALID$/);
 assert.equal(calls,0);assert.equal(reads,0);assert.equal(waiting.interrupted,false);
});
test('native synchronous cancellation prevents database work and preserves its reason',async()=>{
 let calls=0;const reason=new DOMException('stopped','AbortError'),controller=new AbortController();
 controller.abort(reason);
 const waiting=databaseWait(controller.signal);
 await assert.rejects(waiting.step(()=>{calls++;return new Promise(()=>{});}),e=>e===reason);
 assert.equal(calls,0);assert.equal(waiting.interrupted,true);
});
test('public cleanup override cannot strand a settled database step',async()=>{
 const signal=new AbortController().signal;
 Object.defineProperty(signal,'removeEventListener',{get(){assert.fail('public cleanup read');}});
 const waiting=databaseWait(signal);
 assert.equal(await waiting.step(()=>Promise.resolve('complete')),'complete');
 const failure=Error('database failed');
 await assert.rejects(waiting.step(()=>Promise.reject(failure)),e=>e===failure);
});
