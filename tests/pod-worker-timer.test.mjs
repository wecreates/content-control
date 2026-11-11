import test from 'node:test';
import assert from 'node:assert/strict';
import {runPodWorker} from '../integrations/pod/orchestrator.mjs';

for(const pollMs of [2147483648,Number.MAX_SAFE_INTEGER,1000.5,Infinity,NaN,'15000',999])
test('reject invalid or overflowing polling delay before work: '+String(pollMs),async()=>{
 const controller=new AbortController();let calls=0;
 const touch=()=>{calls++;controller.abort();};
 await assert.rejects(runPodWorker({pollMs,signal:controller.signal,
  shouldContinue:()=>{touch();return true;},db:{recover:touch},produce:touch,publish:touch,
  onCycle:touch,onError:touch}),/WORKER_CONFIG_INVALID/);
 assert.equal(calls,0);
});

for(const pollMs of [1000,15000,2147483647])
test('supported polling delay remains cancellable: '+pollMs,{timeout:3000},async()=>{
 const controller=new AbortController();let calls=0,timer;
 try{
  await runPodWorker({pollMs,signal:controller.signal,db:{recover:async()=>{
   calls++;timer=setTimeout(()=>controller.abort(),20);
  }},produce:async()=>({status:'IDLE'}),publish:async()=>{}});
  assert.equal(calls,1);
 }finally{clearTimeout(timer);controller.abort();}
});
