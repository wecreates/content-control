import {types as utilTypes} from 'node:util';
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const nativeReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;
const abortedState=signal=>Reflect.apply(nativeAborted,signal,[]);
const abortReason=signal=>Reflect.apply(nativeReason,signal,[]);
// Race a database wait against the caller's existing cancellation signal.
// The signal reason is preserved exactly. Late settlement is consumed, and a
// client acquired after cancellation can be destroyed by the caller-supplied
// onLate hook instead of leaking back into the pool.
export function databaseWait(signal){
 let interrupted=false;
 const step=(operation,{onLate}={})=>{
  if(signal===undefined){
   try{return Promise.resolve(operation());}catch(error){return Promise.reject(error);}
  }
  // Validate inside step so callers retain their existing cleanup boundary.
  try{if(utilTypes.isProxy(signal))throw Error();abortedState(signal);}
  catch{return Promise.reject(new TypeError('POD_DATABASE_SIGNAL_INVALID'));}
  if(abortedState(signal)){interrupted=true;return Promise.reject(abortReason(signal));}
  return new Promise((resolve,reject)=>{
   let settled=false,starting=false,abortDuringStart=false;
   const remove=()=>{try{Reflect.apply(removeAbortListener,signal,['abort',aborted]);}catch{}};
   const settleAbort=()=>{
    if(!settled){settled=true;interrupted=true;remove();
     try{reject(abortReason(signal));}catch(error){reject(error);}}
   };
   const aborted=()=>{if(!abortedState(signal))return;if(starting)abortDuringStart=true;else settleAbort();};
   try{Reflect.apply(addAbortListener,signal,['abort',aborted]);}
   catch(error){if(!settled){settled=true;reject(error);}return;}
   // Synthetic events do not consume the listener; recheck native cancellation
   // before work without consulting replaceable source properties.
   if(abortedState(signal)){settleAbort();return;}
   let pending;
   try{starting=true;pending=Promise.resolve(operation());}
   catch(error){settled=true;remove();reject(error);return;}
   finally{starting=false;}
   pending.then(value=>{
    if(settled){try{onLate?.(value);}catch{}return;}
    settled=true;remove();resolve(value);
   },error=>{
    if(settled)return;
    settled=true;remove();reject(error);
   });
   // If cancellation happened while the operation was being created, let an
   // already-settled operation win first. The caller's next checkpoint still
   // observes cancellation and can safely roll back a reusable connection.
   if(abortDuringStart)queueMicrotask(settleAbort);
  });
 };
 return Object.freeze({step,get interrupted(){return interrupted;}});
}

// Initiate release even if the operation's deadline already expired. Bound
// the caller's wait without allowing a later release rejection to go unhandled.
export async function releaseDatabaseClient(client,discard,waiting){
 const pending=Promise.resolve(client.release(discard));
 pending.catch(()=>{});
 await waiting.step(()=>pending);
}

