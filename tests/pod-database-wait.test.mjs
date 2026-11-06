import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseWait} from '../integrations/pod/database-wait.mjs';

async function bounded(promise){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('TEST_DATABASE_WAIT_STALLED')),1000);
 })]);}
 finally{clearTimeout(timer);}
}

test('failed abort-listener registration does not start database work',async()=>{
 let calls=0;const failure=Error('signal listener failed');
 const signal={aborted:false,reason:undefined,
  addEventListener(){throw failure;},removeEventListener(){}};
 const waiting=databaseWait(signal);
 await assert.rejects(bounded(waiting.step(()=>{calls++;return new Promise(()=>{});})),error=>error===failure);
 assert.equal(calls,0);
 assert.equal(waiting.interrupted,false);
});

test('synchronous abort registration prevents database work and preserves its reason',async()=>{
 let calls=0;const reason=new DOMException('stopped','AbortError');
 const signal={aborted:false,reason,
  addEventListener(_type,listener){listener();},removeEventListener(){}};
 const waiting=databaseWait(signal);
 await assert.rejects(bounded(waiting.step(()=>{calls++;return new Promise(()=>{});})),error=>error===reason);
 assert.equal(calls,0);
 assert.equal(waiting.interrupted,true);
});

test('failed listener cleanup cannot strand a settled database step',async()=>{
 const signal={aborted:false,reason:undefined,
  addEventListener(){},removeEventListener(){throw Error('private signal detail');}};
 const waiting=databaseWait(signal);
 assert.equal(await bounded(waiting.step(()=>Promise.resolve('complete'))),'complete');
 const failure=Error('database failed');
 await assert.rejects(bounded(waiting.step(()=>Promise.reject(failure))),error=>error===failure);
});
