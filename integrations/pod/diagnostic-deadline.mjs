import {performance} from 'node:perf_hooks';

const DEFAULT_DIAGNOSTIC_TIMEOUT_MS=40000;
const deadlineErrors=new WeakSet();

function deadlineError(){
 const error=Error('POD_DIAGNOSTIC_TIMEOUT');
 deadlineErrors.add(error);
 return error;
}

export function diagnosticDeadline(signal){
 const expiresAt=performance.now()+DEFAULT_DIAGNOSTIC_TIMEOUT_MS;
 const timeout=AbortSignal.timeout(DEFAULT_DIAGNOSTIC_TIMEOUT_MS);
 return Object.freeze({signal:signal===undefined?timeout:AbortSignal.any([signal,timeout]),expiresAt});
}

export function isDiagnosticDeadline(error){return error!==null&&typeof error==='object'&&deadlineErrors.has(error);}

function expired(deadline){
 const now=performance.now();
 return deadline.signal.aborted||!Number.isFinite(deadline.expiresAt)||!Number.isFinite(now)||now>=deadline.expiresAt;
}

// The operation thunk prevents an already-expired deadline from acquiring a
// client or issuing another query. A late acquisition is destroyed rather
// than leaked back into the pool; late query settlement is consumed here.
export function diagnosticStep(operation,deadline,{onLate}={}){
 if(expired(deadline))return Promise.reject(deadlineError());
 let pending;
 try{pending=Promise.resolve(operation());}
 catch(error){return Promise.reject(expired(deadline)?deadlineError():error);}
 return new Promise((resolve,reject)=>{
  let settled=false;
  const aborted=()=>{if(!settled){settled=true;reject(deadlineError());}};
  deadline.signal.addEventListener('abort',aborted,{once:true});
  pending.then(value=>{
   if(settled){try{onLate?.(value);}catch{}return;}
   settled=true;deadline.signal.removeEventListener('abort',aborted);
   if(expired(deadline)){
    try{onLate?.(value);}catch{}
    reject(deadlineError());return;
   }
   resolve(value);
  },error=>{
   if(settled)return;
   settled=true;deadline.signal.removeEventListener('abort',aborted);
   reject(expired(deadline)?deadlineError():error);
  });
 });
}
