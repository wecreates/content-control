import {runPodWorker} from './orchestrator.mjs';
import {produceOnce} from '../../scripts/pod_production_worker.mjs';

// The host supplies authoritative resolvers, never request-supplied executable code.
// Publication is deliberately absent from this internal production lifecycle.
export function startProductionRuntime({db,production,env=process.env,pythonReady=true,onError=()=>{}}){
 let status='DISABLED',loop=Promise.resolve();
 const controller=new AbortController();
 if(env.POD_PRODUCTION_ENABLED==='true'){
  if(!pythonReady){status='BLOCKED_PYTHON_RUNTIME';}
  else if(!db||typeof production?.resolveTask!=='function'||typeof production?.resolveGrant!=='function'||
     typeof env.POD_UPSTREAM_KEY!=='string'||Buffer.byteLength(env.POD_UPSTREAM_KEY)<32){
   status='BLOCKED_PRODUCTION_CONFIGURATION';
  }else{
   status='RUNNING';
   loop=runPodWorker({db,signal:controller.signal,pollMs:15000,
    produce:()=>produceOnce({db,...production,env,upstreamKey:env.POD_UPSTREAM_KEY,signal:controller.signal}),
    publish:async()=>{},onError}).catch(()=>{status='FAILED';onError({code:'POD_WORKER_FAILED'});});
  }
 }
 return {status:()=>status,stop:async()=>{controller.abort();await loop;if(status==='RUNNING')status='STOPPED';}};
}
