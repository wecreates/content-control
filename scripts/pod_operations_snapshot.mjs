import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool} from '../pod-db-bridge.js';
import {metrics} from '../integrations/pod/metrics.mjs';
import {parseStorageExpiry} from '../integrations/pod/storage-expiry.mjs';
import {operationalHealth} from '../integrations/pod/operational-health.mjs';
import {diagnosticDeadline,diagnosticStep} from '../integrations/pod/diagnostic-deadline.mjs';

// Manual read-only diagnostics remain usable when service startup/preflight is
// blocked. This does not mount a router, start workers, migrate or change flags.
export async function operationsSnapshot({env=process.env,connect=createPodPool,clock=Date.now,signal}={}){
 // Keep a standalone CLI alive long enough to emit its bounded failure receipt.
 const controller=new AbortController();
 const deadline=diagnosticDeadline(signal===undefined?controller.signal:AbortSignal.any([signal,controller.signal]));
 const timer=setTimeout(()=>controller.abort(),40000);
 const step=operation=>diagnosticStep(operation,deadline);
 let pool,report;
 try{
  pool=await diagnosticStep(()=>connect(env),deadline,{onLate:late=>{
   try{Promise.resolve(late.end()).catch(()=>{});}catch{}
  }});
  report=await step(()=>metrics({pool,expiresAt:parseStorageExpiry(env.POD_STORAGE_EXPIRES_AT)},
   {env,clock,signal:deadline.signal}));
 }finally{
  try{
   if(pool){
    // Initiate cleanup even after expiry, but never await it indefinitely.
    const ending=Promise.resolve(pool.end());ending.catch(()=>{});
    await step(()=>ending);
   }
  }finally{clearTimeout(timer);}
 }
 // Owned-pool shutdown is another asynchronous boundary after metrics release.
 return {...report,health:operationalHealth({expiresAt:parseStorageExpiry(env.POD_STORAGE_EXPIRES_AT),
  artifactBytes:report.artifact_bytes,expiredLeases:report.health.expired_leases,
  pendingEvents:report.health.outbox.pending,oldestEventSeconds:report.health.outbox.oldest_pending_seconds,
  now:clock(),env})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==2)throw Error('UNEXPECTED_ARGUMENTS');
  console.log(JSON.stringify(await operationsSnapshot()));
 }catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_OPERATIONS_SNAPSHOT_UNAVAILABLE'}));process.exitCode=1;}
}
