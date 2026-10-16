import {spawn} from 'node:child_process';
import path from 'node:path';
import {stageFailureReason} from './failure-reasons.mjs';

// Do not resolve cancellation until the process closes: callers clean up its
// workspace in finally. A dedicated POSIX group includes ordinary OCR/render
// subprocesses; killing only the parent can leave inherited output pipes open.
export async function runPythonStage(script,args,{root,signal,env=process.env,
 timeoutMs=480000,killGraceMs=5000,maxOutputBytes=1048576}={}){
 if(signal?.aborted)throw Error('PYTHON_STAGE_ABORTED');
 if(process.platform==='win32')throw Error('PYTHON_STAGE_PLATFORM_UNSUPPORTED');
 for(const n of [timeoutMs,killGraceMs,maxOutputBytes])if(!Number.isSafeInteger(n)||n<1)throw Error('PYTHON_STAGE_CONFIG_INVALID');
 return new Promise((resolve,reject)=>{
  let child;
  try{child=spawn(env.POD_PYTHON||'python3',[path.join(root,'scripts',script),...args],
   {cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});}catch{reject(Error('PYTHON_STAGE_SPAWN_FAILED'));return;}
  let bytes=0,failure=null,forceTimer,timer,settled=false;
  const chunks=[];
  const signalGroup=signalName=>{
   if(!Number.isInteger(child.pid)||child.pid<1)return false;
   try{process.kill(-child.pid,signalName);return true;}
   catch(error){
    if(error.code!=='ESRCH')failure=failure||'PYTHON_STAGE_TERMINATION_FAILED';
    return false;
   }
  };
  const terminate=reason=>{
   if(failure||settled)return;
   failure=reason;signalGroup('SIGTERM');
   forceTimer=setTimeout(()=>{if(!settled)signalGroup('SIGKILL');},killGraceMs);
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
  child.on('exit',()=>{
   // The direct child has been reaped. Remaining group members must not keep
   // writing after cleanup, even if they redirected/closed their output pipes.
   if(signalGroup('SIGKILL'))failure=failure||'PYTHON_STAGE_DESCENDANTS_REMAIN';
  });
  child.on('close',finish);
  timer=setTimeout(()=>terminate('PYTHON_STAGE_TIMEOUT'),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
 });
}
