import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {databaseWait} from '../integrations/pod/database-wait.mjs';

test('native pre-abort blocks database acquisition despite false public flag',async()=>{
 const c=new AbortController(),reason=Error('cancelled');c.abort(reason);
 Object.defineProperty(c.signal,'aborted',{value:false});
 let calls=0;const waiting=databaseWait(c.signal);
 await assert.rejects(waiting.step(()=>{calls++;return 'unreachable';}),e=>e===reason);
 assert.equal(calls,0);assert.equal(waiting.interrupted,true);
});
test('waiter uses native state reason and cleanup without public getters',async()=>{
 const c=new AbortController();
 for(const key of ['aborted','reason','addEventListener','removeEventListener'])
  Object.defineProperty(c.signal,key,{get(){assert.fail('public '+key);}});
 const waiting=databaseWait(c.signal),reason={cancelled:true};
 assert.equal(await waiting.step(()=>42),42);
 const pending=waiting.step(()=>new Promise(()=>{}));c.abort(reason);
 await assert.rejects(pending,e=>e===reason);
 assert.equal(getEventListeners(c.signal,'abort').length,0);
 assert.equal(waiting.interrupted,true);
});
test('synthetic abort leaves database wait and genuine cancellation intact',async()=>{
 const c=new AbortController(),reason=Error('actual cancellation'),waiting=databaseWait(c.signal);
 let resolve,late=0,settled=false;
 const pending=waiting.step(()=>new Promise(r=>{resolve=r;}),{onLate:()=>{late++;}});
 pending.then(()=>{settled=true;},()=>{settled=true;});
 c.signal.dispatchEvent(new Event('abort'));await new Promise(r=>setImmediate(r));
 assert.equal(settled,false);assert.equal(waiting.interrupted,false);
 assert.equal(getEventListeners(c.signal,'abort').length,1);
 c.abort(reason);await assert.rejects(pending,e=>e===reason);
 resolve('late-client');await new Promise(r=>setImmediate(r));
 assert.equal(late,1);assert.equal(waiting.interrupted,true);
 assert.equal(getEventListeners(c.signal,'abort').length,0);
});
for(const proxy of [false,true])test('invalid '+(proxy?'Proxy':'forged')+' signal runs no hooks or operation',async()=>{
 let reads=0,calls=0;const raw=Object.defineProperty({},'aborted',{get(){reads++;return false;}});
 const signal=proxy?new Proxy(new AbortController().signal,{get(t,k){reads++;return Reflect.get(t,k,t);}}):raw;
 const waiting=databaseWait(signal);
 await assert.rejects(waiting.step(()=>{calls++;return 42;}),e=>e instanceof TypeError&&e.message==='POD_DATABASE_SIGNAL_INVALID');
 assert.equal(reads,0);assert.equal(calls,0);assert.equal(waiting.interrupted,false);
});
test('abort during operation creation retains immediate settlement then blocks next work',async()=>{
 const c=new AbortController(),reason=Error('stop'),waiting=databaseWait(c.signal);let calls=0;
 assert.equal(await waiting.step(()=>{c.abort(reason);return Promise.resolve('already settled');}),'already settled');
 await assert.rejects(waiting.step(()=>{calls++;return 42;}),e=>e===reason);
 assert.equal(calls,0);assert.equal(waiting.interrupted,true);
});
