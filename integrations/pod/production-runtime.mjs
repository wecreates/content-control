import {runPodWorker} from './orchestrator.mjs';
import {produceOnce} from '../../scripts/pod_production_worker.mjs';
import {productionReason} from './failure-reasons.mjs';
import {types as utilTypes} from 'node:util';

function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  let current=target;
  while(current!==null){
   if(utilTypes.isProxy(current))return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(descriptor)return Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
   current=Object.getPrototypeOf(current);
  }
  return {valid:true,value:undefined};
 }catch{return {valid:false};}
}

// The host supplies authoritative resolvers, never request-supplied executable code.
// Publication is deliberately absent from this internal production lifecycle.
export function startProductionRuntime(options={}){
 // Parameter destructuring would invoke caller-owned accessors before the
 // disabled-state configuration boundary. Read runtime options only from data
 // descriptors and reject Proxy-backed configuration without invoking traps.
 const dbCapability=dataProperty(options,'db'),productionCapability=dataProperty(options,'production'),
  envCapability=dataProperty(options,'env'),pythonCapability=dataProperty(options,'pythonReady'),
  errorCapability=dataProperty(options,'onError');
 if([dbCapability,productionCapability,envCapability,pythonCapability,errorCapability]
  .some(capability=>!capability.valid))throw Error('PRODUCTION_RUNTIME_OPTIONS_UNVERIFIED');
 const db=dbCapability.value,production=productionCapability.value,
  env=envCapability.value===undefined?process.env:envCapability.value,
  pythonReady=pythonCapability.value===undefined?true:pythonCapability.value,
  onError=errorCapability.value===undefined?()=>{}:errorCapability.value;
 let status='DISABLED',loop=Promise.resolve();
 let cycles=0,consecutiveFailures=0,lastStartedAt=null,lastCompletedAt=null,lastErrorCode=null,lastResult=null;
 const reportError=error=>{consecutiveFailures++;status='RETRYING';lastErrorCode=error.code;try{onError(error);}catch{}};
 const controller=new AbortController();
 const enabledCapability=dataProperty(env,'POD_PRODUCTION_ENABLED');
 if(!enabledCapability.valid){status='BLOCKED_PRODUCTION_CONFIGURATION';}
 else if(enabledCapability.value==='true'){
  if(!pythonReady){status='BLOCKED_PYTHON_RUNTIME';}
  else{
   const authorityCapability=dataProperty(production,'authorityReady'),
    taskCapability=dataProperty(production,'resolveTask'),grantCapability=dataProperty(production,'resolveGrant'),
    rootCapability=dataProperty(production,'root'),keyCapability=dataProperty(env,'POD_UPSTREAM_KEY');
   if([authorityCapability,taskCapability,grantCapability,rootCapability,keyCapability]
    .some(capability=>!capability.valid)){status='BLOCKED_PRODUCTION_CONFIGURATION';}
   else if(authorityCapability.value===false){status='BLOCKED_GRANT_AUTHORITY';}
   else if(!db||typeof taskCapability.value!=='function'||typeof grantCapability.value!=='function'||
      typeof keyCapability.value!=='string'||Buffer.byteLength(keyCapability.value)<32){
    status='BLOCKED_PRODUCTION_CONFIGURATION';
   }else{
    const resolveTask=taskCapability.value,resolveGrant=grantCapability.value,
     root=rootCapability.value,upstreamKey=keyCapability.value;
    status='RUNNING';
    loop=runPodWorker({db,signal:controller.signal,pollMs:15000,
     shouldContinue:()=>{const enabled=dataProperty(env,'POD_PRODUCTION_ENABLED');return enabled.valid&&enabled.value==='true';},
     produce:()=>produceOnce({db,resolveTask,resolveGrant,root,env,upstreamKey,signal:controller.signal}),
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
 }
 return {status:()=>status,health:()=>({status,cycles,consecutive_failures:consecutiveFailures,
  last_started_at:lastStartedAt,last_completed_at:lastCompletedAt,last_error_code:lastErrorCode,last_result:lastResult}),
  stop:async()=>{controller.abort();await loop;if(['RUNNING','RETRYING'].includes(status))status='STOPPED';}};
}
