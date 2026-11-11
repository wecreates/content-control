import {performance} from 'node:perf_hooks';
import {types as utilTypes} from 'node:util';
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;
const signalAborted=signal=>Reflect.apply(nativeAborted,signal,[]);

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

function snapshotDeadline(deadline){
 if(deadline===null||typeof deadline!=='object'||utilTypes.isProxy(deadline))throw deadlineError();
 const signal=Object.getOwnPropertyDescriptor(deadline,'signal'),expires=Object.getOwnPropertyDescriptor(deadline,'expiresAt');
 if(!Object.hasOwn(signal||{},'value')||!Object.hasOwn(expires||{},'value')||
  !Number.isFinite(expires.value)||utilTypes.isProxy(signal.value))throw deadlineError();
 // Validate native state without invoking public members. Retain the admitted
 // primitive deadline, not an object the operation can extend during I/O.
 signalAborted(signal.value);
 return {signal:signal.value,expiresAt:expires.value};
}

function expired(deadline){
 const now=performance.now();
 return signalAborted(deadline.signal)||!Number.isFinite(deadline.expiresAt)||!Number.isFinite(now)||now>=deadline.expiresAt;
}

// The operation thunk prevents an already-expired deadline from acquiring a
// client or issuing another query. A late acquisition is destroyed rather
// than leaked back into the pool; late query settlement is consumed here.
export function diagnosticStep(operation,deadline,{onLate}={}){
 try{deadline=snapshotDeadline(deadline);}catch{return Promise.reject(deadlineError());}
 if(expired(deadline))return Promise.reject(deadlineError());
 return new Promise((resolve,reject)=>{
  let settled=false;
  const remove=()=>{try{Reflect.apply(removeAbortListener,deadline.signal,['abort',aborted]);}catch{}};
  const aborted=()=>{if(signalAborted(deadline.signal)&&!settled){settled=true;remove();reject(deadlineError());}};
  try{Reflect.apply(addAbortListener,deadline.signal,['abort',aborted]);}
  catch{settled=true;reject(deadlineError());return;}
  // Recheck native state before acquisition/query work. Synthetic events must
  // not consume the listener for genuine cancellation.
  if(settled)return;
  if(expired(deadline)){settled=true;remove();reject(deadlineError());return;}
  let pending;
  try{pending=Promise.resolve(operation());}
  catch(error){settled=true;remove();reject(expired(deadline)?deadlineError():error);return;}
  pending.then(value=>{
   if(settled){try{onLate?.(value);}catch{}return;}
   settled=true;remove();
   if(expired(deadline)){
    try{onLate?.(value);}catch{}
    reject(deadlineError());return;
   }
   resolve(value);
  },error=>{
   if(settled)return;
   settled=true;remove();
   reject(expired(deadline)?deadlineError():error);
  });
 });
}
