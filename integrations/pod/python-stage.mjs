import {spawn} from 'node:child_process';
import path from 'node:path';
import {stageFailureReason} from './failure-reasons.mjs';

// Do not resolve cancellation until the process closes: callers clean up its
// workspace in finally. Escalate ignored SIGTERM so a stage cannot run forever.
export async function runPythonStage(script,args,{root,signal,env=process.env,
 timeoutMs=480000,killGraceMs=5000,maxOutputBytes=1048576}={}){
 if(signal?.aborted)throw Error('PYTHON_STAGE_ABORTED');
 for(const n of [timeoutMs,killGraceMs,maxOutputBytes])if(!Number.isSafeInteger(n)||n<1)throw Error('PYTHON_STAGE_CONFIG_INVALID');
 return new Promise((resolve,reject)=>{
  let child;
  try{child=spawn(env.POD_PYTHON||'python3',[path.join(root,'scripts',script),...args],
   {cwd:root,env,stdio:['ignore','pipe','pipe']});}catch{reject(Error('PYTHON_STAGE_SPAWN_FAILED'));return;}
  let bytes=0,failure=null,forceTimer,timer,settled=false;
  const chunks=[];
  const terminate=reason=>{
   if(failure||settled)return;
   failure=reason;child.kill('SIGTERM');
   forceTimer=setTimeout(()=>{if(!settled)child.kill('SIGKILL');},killGraceMs);
  };
  const abort=()=>terminate('PYTHON_STAGE_ABORTED');
  const cleanup=()=>{clearTimeout(timer);clearTimeout(forceTimer);signal?.removeEventListener('abort',abort);};
  const finish=code=>{
   if(settled)return;settled=true;cleanup();
   if(failure||code!==0){
    const error=Error(failure||'PYTHON_STAGE_FAILED');
    if(!failure)error.reasonCode=stageFailureReason(Buffer.concat(chunks).toString('utf8'));
    reject(error);
   }
   else resolve(Buffer.concat(chunks).toString('utf8'));
  };
  child.stdout.on('data',chunk=>{
   bytes+=chunk.length;
   if(bytes>maxOutputBytes)terminate('PYTHON_STAGE_OUTPUT_LIMIT');
   else if(!failure)chunks.push(chunk);
  });
  child.stderr.on('data',chunk=>{
   // Count but never retain stderr. Both streams share the resource bound.
   bytes+=chunk.length;if(bytes>maxOutputBytes)terminate('PYTHON_STAGE_OUTPUT_LIMIT');
  });
  child.on('error',()=>{failure=failure||'PYTHON_STAGE_SPAWN_FAILED';});
  child.on('close',finish);
  timer=setTimeout(()=>terminate('PYTHON_STAGE_TIMEOUT'),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
 });
}
