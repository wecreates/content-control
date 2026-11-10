import {performance} from 'node:perf_hooks';
import {databaseWait} from './database-wait.mjs';

export async function runArchiveSession(work,{connect,signal,timeoutMs=600000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw Error('POD_ARCHIVE_TIMEOUT_INVALID');
 const controller=new AbortController(),reason=Error('POD_ARCHIVE_TIMEOUT'),expiresAt=performance.now()+timeoutMs;
 const combined=signal===undefined?controller.signal:AbortSignal.any([signal,controller.signal]);
 const waiting=databaseWait(combined);
 const checkpoint=()=>{
  if(performance.now()>=expiresAt)controller.abort(reason);
  combined.throwIfAborted();
 };
 const timer=setTimeout(()=>controller.abort(reason),timeoutMs);
 let pool,result,failed=false;
 try{
  checkpoint();
  const openPool=async env=>{
   checkpoint();
   pool=await waiting.step(()=>connect(env),{onLate:late=>{
    try{Promise.resolve(late.end()).catch(()=>{});}catch{}
   }});
   checkpoint();
   return pool;
  };
  // Do not race the archive itself: its transaction must settle any already
  // issued COMMIT. Its I/O checkpoints share this signal.
  result=await work({signal:combined,openPool});
  checkpoint();
 }catch(error){failed=true;throw error;}
 finally{
  try{
   if(pool){
    // Always initiate shutdown, even after expiry. Consume late rejection,
    // and preserve the archive's original failure if shutdown also fails.
    const ending=Promise.resolve(pool.end());ending.catch(()=>{});
    await waiting.step(()=>ending);
   }
  }catch(error){if(!failed)throw error;}
  finally{clearTimeout(timer);}
 }
 checkpoint();
 return result;
}
