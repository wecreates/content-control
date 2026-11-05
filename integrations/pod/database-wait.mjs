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
  let pending;
  try{pending=Promise.resolve(operation());}catch(error){return Promise.reject(error);}
  return new Promise((resolve,reject)=>{
   let settled=false;
   const aborted=()=>{if(!settled){settled=true;interrupted=true;reject(signal.reason);}};
   signal.addEventListener('abort',aborted,{once:true});
   pending.then(value=>{
    if(settled){try{onLate?.(value);}catch{}return;}
    settled=true;signal.removeEventListener('abort',aborted);resolve(value);
   },error=>{
    if(settled)return;
    settled=true;signal.removeEventListener('abort',aborted);reject(error);
   });
  });
 };
 return Object.freeze({step,get interrupted(){return interrupted;}});
}
