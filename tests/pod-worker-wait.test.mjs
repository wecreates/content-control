import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {runPodWorker} from '../integrations/pod/orchestrator.mjs';
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';

const shadow=signal=>{
 let reads=0;
 for(const key of ['aborted','reason','addEventListener','removeEventListener'])
  Object.defineProperty(signal,key,{get(){reads++;throw Error('private signal member');}});
 return ()=>reads;
};

for(const phase of ['idle','recovery failure','publication failure'])
test('worker wait honors native cancellation after '+phase,{timeout:3000},async()=>{
 const controller=new AbortController(),reads=shadow(controller.signal);
 let recoveries=0,produced=0,published=0,completed=0,timer;
 const errors=[];
 try{
  await runPodWorker({signal:controller.signal,pollMs:1000,
   db:{recover:async()=>{
    recoveries++;timer=setTimeout(()=>controller.abort(),20);
    if(phase==='recovery failure')throw Error('private database failure');
   }},
   produce:async()=>{produced++;return {status:'IDLE'};},
   publish:async()=>{published++;if(phase==='publication failure')throw Error('private provider failure');},
   onCycle:event=>{if(event.phase==='completed')completed++;},onError:error=>errors.push(error)});
  assert.equal(reads(),0);assert.equal(recoveries,1);
  assert.equal(produced,phase==='recovery failure'?0:1);
  assert.equal(published,phase==='recovery failure'?0:1);
  assert.equal(completed,phase==='idle'?1:0);
  assert.deepEqual(errors,phase==='idle'?[]:[{code:'POD_WORKER_CYCLE_FAILED'}]);
 }finally{clearTimeout(timer);controller.abort();}
});

test('runtime stop completes after recovery shadows its lifecycle signal',{timeout:3000},async()=>{
 let reads,signal;
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'fixture-only-key-'.repeat(4)},
  db:{recover:async options=>{signal=options.signal;reads=shadow(signal);},
   claimProduction:async()=>null,assertProducible:async()=>{},failProduction:async()=>{},
   holdProduction:async()=>{},completeProduction:async()=>({pass:false})},
  production:{resolveGrant:async()=>{},resolveTask:async()=>{}}});
 try{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runtime.status(),'RUNNING');assert.equal(runtime.health().cycles,1);
  await runtime.stop();
  assert.equal(runtime.status(),'STOPPED');assert.equal(reads(),0);
  assert.equal(runtime.health().consecutive_failures,0);
 }finally{await runtime.stop();}
});

test('worker removes its forwarding listener after an ordinary polling interval',{timeout:4000},async()=>{
 const controller=new AbortController(),reads=shadow(controller.signal);let cycles=0,recoveries=0;
 try{
  await runPodWorker({signal:controller.signal,pollMs:1000,shouldContinue:()=>cycles<2,
   db:{recover:async()=>{recoveries++;}},produce:async()=>({status:'IDLE'}),publish:async()=>{},
   onCycle:event=>{if(event.phase==='completed')cycles++;}});
  assert.equal(cycles,2);assert.equal(recoveries,2);assert.equal(reads(),0);
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
 }finally{controller.abort();}
});
