import {performance} from 'node:perf_hooks';
import {databaseWait} from './database-wait.mjs';
import {types as utilTypes} from 'node:util';
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const nativeReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get;
const nativeThrowIfAborted=AbortSignal.prototype.throwIfAborted;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;

export async function runArchiveSession(work,{connect,signal,timeoutMs=600000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw Error('POD_ARCHIVE_TIMEOUT_INVALID');
 if(signal!==undefined){
  if(utilTypes.isProxy(signal))throw new TypeError('POD_ARCHIVE_SIGNAL_INVALID');
  Reflect.apply(nativeThrowIfAborted,signal,[]);
 }
 const controller=new AbortController(),reason=Error('POD_ARCHIVE_TIMEOUT'),expiresAt=performance.now()+timeoutMs;
 const onAbort=()=>{if(Reflect.apply(nativeAborted,signal,[]))controller.abort(Reflect.apply(nativeReason,signal,[]));};
 if(signal)Reflect.apply(addAbortListener,signal,['abort',onAbort]);
 // The archive can observe cancellation, but must not replace the session's
 // deadline checks or the pool shutdown waiter's private signal members.
 const combined=AbortSignal.any([controller.signal]);
 const waiting=databaseWait(controller.signal);
 const checkpoint=()=>{
  if(performance.now()>=expiresAt)controller.abort(reason);
  Reflect.apply(nativeThrowIfAborted,controller.signal,[]);
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
  finally{clearTimeout(timer);if(signal)Reflect.apply(removeAbortListener,signal,['abort',onAbort]);}
 }
 checkpoint();
 return result;
}
