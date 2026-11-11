import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {diagnosticDeadline,diagnosticStep,isDiagnosticDeadline} from '../integrations/pod/diagnostic-deadline.mjs';
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const nativeAborted=s=>Reflect.apply(aborted,s,[]);
test('diagnostic factory rejects proxy source without executing traps',()=>{
 let traps=0;
 const signal=new Proxy(new AbortController().signal,{get(t,k){traps++;return Reflect.get(t,k,t);}});
 assert.throws(()=>diagnosticDeadline(signal),isDiagnosticDeadline);
 assert.equal(traps,0);
});
test('diagnostic factory rejects forged source without executing accessors',()=>{
 let reads=0;
 const signal={get aborted(){reads++;return false;}};
 assert.throws(()=>diagnosticDeadline(signal),isDiagnosticDeadline);
 assert.equal(reads,0);
});
test('source public fields do not override native cancellation',async()=>{
 const c=new AbortController();
 for(const key of ['aborted','reason','addEventListener','removeEventListener'])
  Object.defineProperty(c.signal,key,{get(){assert.fail('public source '+key);}});
 const d=diagnosticDeadline(c.signal);
 c.abort(Error('private source detail'));
 assert.equal(nativeAborted(d.signal),true);
 await assert.rejects(diagnosticStep(()=>assert.fail('cancelled work'),d),isDiagnosticDeadline);
});
test('synthetic source abort does not consume real cancellation',()=>{
 const c=new AbortController(),d=diagnosticDeadline(c.signal);
 c.signal.dispatchEvent(new Event('abort'));
 assert.equal(nativeAborted(d.signal),false);
 c.abort();
 assert.equal(nativeAborted(d.signal),true);
 assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('uncancelled genuine source still admits diagnostic work',async()=>{
 const c=new AbortController(),d=diagnosticDeadline(c.signal);
 assert.equal(await diagnosticStep(()=>42,d),42);
 c.abort();
 assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('already cancelled source cannot admit work despite false public flag',async()=>{
 const c=new AbortController();c.abort();
 Object.defineProperty(c.signal,'aborted',{value:false});
 const d=diagnosticDeadline(c.signal);
 await assert.rejects(diagnosticStep(()=>assert.fail('cancelled work'),d),isDiagnosticDeadline);
});
test('timeout detaches source relay and keeps 40 second bound',t=>{
 const timeout=new AbortController(),source=new AbortController();let ms;
 t.mock.method(AbortSignal,'timeout',value=>{ms=value;return timeout.signal;});
 const d=diagnosticDeadline(source.signal);
 assert.equal(getEventListeners(source.signal,'abort').length,1);
 timeout.abort();
 assert.equal(getEventListeners(source.signal,'abort').length,0);
 assert.equal(getEventListeners(timeout.signal,'abort').length,0);
 assert.equal(ms,40000);
 assert.equal(nativeAborted(d.signal),true);
 // No reason from source may change the already-ended diagnostic.
 source.abort(Error('private late reason'));
 assert.equal(nativeAborted(d.signal),true);
});

