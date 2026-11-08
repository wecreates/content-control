import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {diagnosticDeadline,diagnosticStep,isDiagnosticDeadline} from '../integrations/pod/diagnostic-deadline.mjs';

async function bounded(promise){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('TEST_DIAGNOSTIC_STEP_STALLED')),1000);
 })]);}
 finally{clearTimeout(timer);}
}

test('late diagnostic success cannot beat a delayed native timer callback',async t=>{
 let now=100,timeoutMs,release,late;
 t.mock.method(performance,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',ms=>{timeoutMs=ms;return new AbortController().signal;});
 const deadline=diagnosticDeadline();
 const result=diagnosticStep(()=>new Promise(resolve=>{release=resolve;}),deadline,{onLate:value=>{late=value;}});
 assert.equal(timeoutMs,40000);
 now=40100;release('late-client');
 await assert.rejects(result,error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
 assert.equal(late,'late-client');
});

test('late diagnostic rejection is a timeout and cannot start later work',async t=>{
 let now=200,rejectOperation,calls=0;
 t.mock.method(performance,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',()=>new AbortController().signal);
 const deadline=diagnosticDeadline();
 const result=diagnosticStep(()=>{calls++;return new Promise((_,reject)=>{rejectOperation=reject;});},deadline);
 now=40200;rejectOperation(Error('private late database failure'));
 await assert.rejects(result,error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
 await assert.rejects(diagnosticStep(()=>{calls++;return 'unreachable';},deadline),
  error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
 assert.equal(calls,1);
});

test('a synchronous operation crossing the deadline cannot expose its error',async t=>{
 let now=300;
 t.mock.method(performance,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',()=>new AbortController().signal);
 const deadline=diagnosticDeadline();
 await assert.rejects(diagnosticStep(()=>{
  now=40300;
  throw Error('private synchronous database failure');
 },deadline),error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
});

test('failed diagnostic abort-listener registration cannot start database work',async()=>{
 let calls=0;
 const signal={aborted:false,
  addEventListener(){throw Error('private listener failure');},
  removeEventListener(){}};
 const deadline={signal,expiresAt:performance.now()+40000};
 await assert.rejects(bounded(diagnosticStep(()=>{calls++;return new Promise(()=>{});},deadline)),
  error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
 assert.equal(calls,0);
});

test('synchronous diagnostic abort registration prevents database work',async()=>{
 let calls=0;
 const signal={aborted:false,
  addEventListener(_type,listener){listener();},
  removeEventListener(){}};
 const deadline={signal,expiresAt:performance.now()+40000};
 await assert.rejects(bounded(diagnosticStep(()=>{calls++;return new Promise(()=>{});},deadline)),
  error=>isDiagnosticDeadline(error)&&error.message==='POD_DIAGNOSTIC_TIMEOUT');
 assert.equal(calls,0);
});

test('failed diagnostic listener cleanup cannot strand settlement',async()=>{
 const signal={aborted:false,
  addEventListener(){},
  removeEventListener(){throw Error('private cleanup failure');}};
 const deadline={signal,expiresAt:performance.now()+40000};
 assert.equal(await bounded(diagnosticStep(()=>Promise.resolve('complete'),deadline)),'complete');
 const failure=Error('database failed');
 await assert.rejects(bounded(diagnosticStep(()=>Promise.reject(failure),deadline)),error=>error===failure);
});
