import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {performance} from 'node:perf_hooks';
import {diagnosticStep,isDiagnosticDeadline} from '../integrations/pod/diagnostic-deadline.mjs';
const timeout=e=>isDiagnosticDeadline(e)&&e.message==='POD_DIAGNOSTIC_TIMEOUT';
const deadline=signal=>({signal,expiresAt:performance.now()+40000});
const step=(work,d,options)=>Promise.resolve().then(()=>diagnosticStep(work,d,options));
test('native diagnostic abort prevents work despite a false public flag',async()=>{
 const c=new AbortController();c.abort();Object.defineProperty(c.signal,'aborted',{value:false});let calls=0;
 await assert.rejects(step(()=>{calls++;return 42;},deadline(c.signal)),timeout);assert.equal(calls,0);
});
test('synthetic diagnostic abort does not consume real cancellation',{timeout:2000},async()=>{
 const c=new AbortController();let finish,entered;const started=new Promise(r=>entered=r);
 const operation=step(()=>{entered();return new Promise(r=>finish=r);},deadline(c.signal));
 let settled=false;operation.then(()=>settled=true,()=>settled=true);
 try{
  await started;c.signal.dispatchEvent(new Event('abort'));await new Promise(r=>setImmediate(r));assert.equal(settled,false);
  c.abort();await assert.rejects(operation,timeout);assert.equal(getEventListeners(c.signal,'abort').length,0);
 }finally{c.abort();finish(42);}
});
test('diagnostic checks and cleanup ignore public signal getters',async()=>{
 const c=new AbortController();for(const key of ['aborted','addEventListener','removeEventListener'])
  Object.defineProperty(c.signal,key,{get(){assert.fail('public member read');}});
 assert.equal(await step(()=>42,deadline(c.signal)),42);assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('operation cannot extend an admitted diagnostic deadline',async t=>{
 let now=100;t.mock.method(performance,'now',()=>now);const d=deadline(new AbortController().signal);let late;
 await assert.rejects(step(()=>{d.expiresAt=80000;now=40100;return 'late client';},d,{onLate:v=>late=v}),timeout);
 assert.equal(late,'late client');
});
test('executable diagnostic deadline fields fail without invocation',async()=>{
 let reads=0,calls=0;const trap=()=>{reads++;throw Error('private deadline');};
 for(const d of [{get signal(){return trap();},expiresAt:40000},new Proxy({},{get:trap,getOwnPropertyDescriptor:trap})])
  await assert.rejects(step(()=>{calls++;},d),timeout);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('forged and Proxy diagnostic signals cannot run traps or work',async()=>{
 let reads=0,calls=0;const trap=()=>{reads++;throw Error('private signal');};
 for(const signal of [{get aborted(){return trap();}},new Proxy(new AbortController().signal,{get:trap})])
  await assert.rejects(step(()=>{calls++;},deadline(signal)),timeout);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('cancelled diagnostic destroys a late acquisition exactly once',async()=>{
 const c=new AbortController();let finish,late=0;
 const operation=diagnosticStep(()=>new Promise(r=>finish=r),deadline(c.signal),{onLate:()=>late++});
 c.abort();await assert.rejects(operation,timeout);finish({});await new Promise(r=>setImmediate(r));
 assert.equal(late,1);assert.equal(getEventListeners(c.signal,'abort').length,0);
});
