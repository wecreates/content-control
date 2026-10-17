import {setTimeout as pause} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {readBridgeJSON} from '../integrations/pod/http-response.mjs';

// Local image startup acceptance only. This does not assert live readiness.
export async function waitForDisabledPod({url='http://127.0.0.1:10000/api/print/status',
 timeoutMs=60000,requestTimeoutMs=2000,retryMs=500}={}){
 const target=new URL(url);
 if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password||
  target.pathname!=='/api/print/status'||target.search||target.hash||
  ![timeoutMs,requestTimeoutMs,retryMs].every(n=>Number.isInteger(n)&&n>0&&n<=60000)){
  throw Error('POD_SMOKE_INVALID_CONFIGURATION');
 }
 const deadline=performance.now()+timeoutMs;
 while(performance.now()<deadline){
  const signal=AbortSignal.timeout(Math.max(1,Math.ceil(Math.min(requestTimeoutMs,deadline-performance.now()))));
  let response;
  try{response=await fetch(target,{redirect:'manual',signal});}
  catch{
   const remaining=deadline-performance.now();
   if(remaining>0)await pause(Math.min(retryMs,remaining));
   continue;
  }
  let status;
  try{
   if(response.status!==200){await response.body?.cancel();throw Error('status');}
   status=await readBridgeJSON(response,{maxBytes:65536,statusError:'status',sizeError:'size'});
  }catch{throw Error('POD_SMOKE_INVALID_RESPONSE');}
  if(performance.now()>=deadline)throw Error('POD_SMOKE_STARTUP_TIMEOUT');
  if(status?.status!=='DISABLED'||status.publication_enabled!==false||
   status.publication_requested!==false||status.production_status!=='DISABLED'||
   status.outbox?.status!=='DISABLED'||status.adapters_verified!==false){
   throw Error('POD_SMOKE_UNSAFE_STATE');
  }
  return {status:'PASS',publication_enabled:false,production_status:'DISABLED',outbox_status:'DISABLED'};
 }
 throw Error('POD_SMOKE_STARTUP_TIMEOUT');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await waitForDisabledPod()));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
