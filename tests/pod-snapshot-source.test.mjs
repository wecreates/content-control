import test from 'node:test';
import assert from 'node:assert/strict';
import {operationsSnapshot} from '../scripts/pod_operations_snapshot.mjs';
import {isDiagnosticDeadline} from '../integrations/pod/diagnostic-deadline.mjs';

for(const proxy of [false,true])test('snapshot rejects '+(proxy?'Proxy':'forged')+' source before timer or pool work',async t=>{
 let traps=0,timers=0,calls=0;
 const set=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(...args)=>{timers++;return set(...args);});
 const raw=Object.defineProperty({},'aborted',{get(){traps++;return false;}});
 const signal=proxy?new Proxy(new AbortController().signal,{get(target,key){traps++;return Reflect.get(target,key,target);}}):raw;
 await assert.rejects(operationsSnapshot({signal,connect:()=>{calls++;throw Error('unexpected pool');}}),isDiagnosticDeadline);
 assert.equal(traps,0);assert.equal(timers,0);assert.equal(calls,0);
});
test('snapshot admits source before any native composition',async t=>{
 const controller=new AbortController();let direct=0,calls=0;
 const any=AbortSignal.any.bind(AbortSignal);
 t.mock.method(AbortSignal,'any',signals=>{
  if(signals.includes(controller.signal)){direct++;throw Error('RAW_SOURCE_COMPOSED');}
  return any(signals);
 });
 await assert.rejects(operationsSnapshot({signal:controller.signal,connect:()=>{calls++;throw Error('EXPECTED_CONNECT_FAILURE');}}),/EXPECTED_CONNECT_FAILURE/);
 assert.equal(direct,0);assert.equal(calls,1);
});
test('cancelled source with false public flag cannot allocate a pool',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 Object.defineProperty(controller.signal,'aborted',{value:false});
 await assert.rejects(operationsSnapshot({signal:controller.signal,connect:()=>{calls++;throw Error('unexpected pool');}}),isDiagnosticDeadline);
 assert.equal(calls,0);
});
test('snapshot cancellation during pool acquisition destroys late pool exactly once',async()=>{
 const controller=new AbortController();let complete,ended=0;
 for(const key of ['aborted','reason','addEventListener','removeEventListener'])
  Object.defineProperty(controller.signal,key,{get(){assert.fail('public source '+key);}});
 const task=operationsSnapshot({signal:controller.signal,connect:()=>new Promise(resolve=>{complete=resolve;})});
 controller.signal.dispatchEvent(new Event('abort'));
 controller.abort();
 await assert.rejects(task,isDiagnosticDeadline);
 complete({end(){ended++;return Promise.reject(Error('private late shutdown'));}});
 await new Promise(r=>setImmediate(r));
 assert.equal(ended,1);
});

