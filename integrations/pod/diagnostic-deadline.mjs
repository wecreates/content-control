const DEFAULT_DIAGNOSTIC_TIMEOUT_MS=40000;
const deadlineErrors=new WeakSet();

function deadlineError(){
 const error=Error('POD_DIAGNOSTIC_TIMEOUT');
 deadlineErrors.add(error);
 return error;
}

export function diagnosticDeadline(signal){
 const timeout=AbortSignal.timeout(DEFAULT_DIAGNOSTIC_TIMEOUT_MS);
 return signal===undefined?timeout:AbortSignal.any([signal,timeout]);
}

export function isDiagnosticDeadline(error){return error!==null&&typeof error==='object'&&deadlineErrors.has(error);}

// The operation thunk prevents an already-expired deadline from acquiring a
// client or issuing another query. A late acquisition is destroyed rather
// than leaked back into the pool; late query settlement is consumed here.
export function diagnosticStep(operation,signal,{onLate}={}){
 if(signal.aborted)return Promise.reject(deadlineError());
 let pending;
 try{pending=Promise.resolve(operation());}catch(error){return Promise.reject(error);}
 return new Promise((resolve,reject)=>{
  let settled=false;
  const aborted=()=>{if(!settled){settled=true;reject(deadlineError());}};
  signal.addEventListener('abort',aborted,{once:true});
  pending.then(value=>{
   if(settled){try{onLate?.(value);}catch{}return;}
   settled=true;signal.removeEventListener('abort',aborted);resolve(value);
  },error=>{
   if(settled)return;
   settled=true;signal.removeEventListener('abort',aborted);reject(error);
  });
 });
}
