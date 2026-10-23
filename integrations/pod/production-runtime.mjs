import {runPodWorker} from './orchestrator.mjs';
import {produceOnce} from '../../scripts/pod_production_worker.mjs';
import {productionReason} from './failure-reasons.mjs';

// The host supplies authoritative resolvers, never request-supplied executable code.
// Publication is deliberately absent from this internal production lifecycle.
export function startProductionRuntime({db,production,env=process.env,pythonReady=true,onError=()=>{}}){
 let status='DISABLED',loop=Promise.resolve();
 let cycles=0,consecutiveFailures=0,lastStartedAt=null,lastCompletedAt=null,lastErrorCode=null,lastResult=null;
 const reportError=error=>{consecutiveFailures++;status='RETRYING';lastErrorCode=error.code;try{onError(error);}catch{}};
 const controller=new AbortController();
 if(env.POD_PRODUCTION_ENABLED==='true'){
  if(!pythonReady){status='BLOCKED_PYTHON_RUNTIME';}
  else if(production?.authorityReady===false){status='BLOCKED_GRANT_AUTHORITY';}
  else if(!db||typeof production?.resolveTask!=='function'||typeof production?.resolveGrant!=='function'||
     typeof env.POD_UPSTREAM_KEY!=='string'||Buffer.byteLength(env.POD_UPSTREAM_KEY)<32){
   status='BLOCKED_PRODUCTION_CONFIGURATION';
  }else{
   status='RUNNING';
   loop=runPodWorker({db,signal:controller.signal,pollMs:15000,
    shouldContinue:()=>env.POD_PRODUCTION_ENABLED==='true',
    produce:()=>produceOnce({db,...production,env,upstreamKey:env.POD_UPSTREAM_KEY,signal:controller.signal}),
    publish:async()=>{},onError:reportError,onCycle:event=>{
     if(event.phase==='started'){lastStartedAt=new Date().toISOString();return;}
     cycles++;lastCompletedAt=new Date().toISOString();
     lastResult=['IDLE','STOPPED','BLOCKED','REVIEW_REQUIRED','QA_PASSED','QA_FAILED'].includes(event.result?.status)?event.result.status:'UNKNOWN';
     if(event.result?.cleanup_failed===true){reportError({code:'POD_WORKSPACE_CLEANUP_FAILED'});}
     else if(lastResult==='BLOCKED'){
      const reason=productionReason(event.result?.reason_code);
      reportError({code:reason==='PRODUCTION_BLOCKED'?'POD_PRODUCTION_BLOCKED':reason});
     }
     else if(lastResult==='QA_FAILED'){reportError({code:'QA_FAILED'});}
     else{consecutiveFailures=0;lastErrorCode=null;status='RUNNING';}
    }}).then(()=>{status='STOPPED';}).catch(()=>{reportError({code:'POD_WORKER_FAILED'});status='FAILED';});
  }
 }
 return {status:()=>status,health:()=>({status,cycles,consecutive_failures:consecutiveFailures,
  last_started_at:lastStartedAt,last_completed_at:lastCompletedAt,last_error_code:lastErrorCode,last_result:lastResult}),
  stop:async()=>{controller.abort();await loop;if(['RUNNING','RETRYING'].includes(status))status='STOPPED';}};
}
