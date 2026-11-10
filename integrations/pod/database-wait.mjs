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
  if(signal.aborted){interrupted=true;return Promise.reject(signal.reason);}
  return new Promise((resolve,reject)=>{
   let settled=false,starting=false,abortDuringStart=false;
   const remove=()=>{try{signal.removeEventListener('abort',aborted);}catch{}};
   const settleAbort=()=>{
    if(!settled){settled=true;interrupted=true;remove();
     try{reject(signal.reason);}catch(error){reject(error);}}
   };
   const aborted=()=>{if(starting)abortDuringStart=true;else settleAbort();};
   try{signal.addEventListener('abort',aborted,{once:true});}
   catch(error){if(!settled){settled=true;reject(error);}return;}
   // A custom signal may invoke its listener during registration. Do not start
   // database work after cancellation has already won.
   if(settled){remove();return;}
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
