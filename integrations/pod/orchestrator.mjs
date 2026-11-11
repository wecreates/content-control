import {setTimeout as pause} from 'node:timers/promises';
import {types as utilTypes} from 'node:util';

const abortSignalAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')?.get;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;
function signalAborted(signal){
 try{
  if(signal===null||typeof signal!=='object'||utilTypes.isProxy(signal)||
   typeof abortSignalAborted!=='function')throw Error();
  return Reflect.apply(abortSignalAborted,signal,[]);
 }catch{throw Error('WORKER_SIGNAL_UNVERIFIED');}
}
async function waitForNextCycle(pollMs,signal){
 // Timer APIs inspect public signal properties. A recovery/production callback
 // receives this lifecycle signal and may shadow those properties. Forward its
 // native cancellation into an owned signal rather than invoking caller code.
 const controller=new AbortController(),abort=()=>{if(signalAborted(signal))controller.abort();};
 // dispatchEvent can forge an "abort" event without changing native state.
 // Do not consume the listener until genuine cancellation or wait completion.
 Reflect.apply(addAbortListener,signal,['abort',abort]);
 try{
  if(signalAborted(signal))abort();
  await pause(pollMs,undefined,{signal:controller.signal});
 }finally{Reflect.apply(removeAbortListener,signal,['abort',abort]);}
}
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  let current=target;
  while(current!==null){
   if(utilTypes.isProxy(current))return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(descriptor)return Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
   current=Object.getPrototypeOf(current);
  }
  return {valid:true,value:undefined};
 }catch{return {valid:false};}
}

// One loop per process; PostgreSQL leases coordinate multiple processes.
export async function runPodWorker(options={}){
 const dbCapability=dataProperty(options,'db'),produceCapability=dataProperty(options,'produce'),
  publishCapability=dataProperty(options,'publish'),signalCapability=dataProperty(options,'signal'),
  pollCapability=dataProperty(options,'pollMs'),errorCapability=dataProperty(options,'onError'),
  cycleCapability=dataProperty(options,'onCycle'),continueCapability=dataProperty(options,'shouldContinue');
 if([dbCapability,produceCapability,publishCapability,signalCapability,pollCapability,errorCapability,
  cycleCapability,continueCapability].some(capability=>!capability.valid))throw Error('WORKER_OPTIONS_UNVERIFIED');
 const db=dbCapability.value,produce=produceCapability.value,publish=publishCapability.value,
  signal=signalCapability.value,pollMs=pollCapability.value===undefined?15000:pollCapability.value,
  onError=errorCapability.value===undefined?()=>{}:errorCapability.value,
  onCycle=cycleCapability.value===undefined?()=>{}:cycleCapability.value,
  shouldContinue=continueCapability.value===undefined?()=>true:continueCapability.value,
  recoverCapability=dataProperty(db,'recover');
 // Node clamps delays above the signed 32-bit timer range to 1 ms.
 // Reject them before any callback or database work can start a hot loop.
 if(!Number.isInteger(pollMs)||pollMs<1000||pollMs>2147483647||typeof produce!=='function'||typeof publish!=='function'||
  typeof shouldContinue!=='function'||typeof onError!=='function'||typeof onCycle!=='function'||
  !recoverCapability.valid||typeof recoverCapability.value!=='function')throw Error('WORKER_CONFIG_INVALID');
 signalAborted(signal);
 const recover=recoverCapability.value;
 const active=()=>!signalAborted(signal)&&shouldContinue()===true;
 while(active()){
  try{onCycle({phase:'started'});if(!active())break;await Reflect.apply(recover,db,[{signal}]);if(!active())break;
   const result=await produce();if(!active())break;
   await publish();if(!active())break;
   onCycle({phase:'completed',result});
  }catch{if(active())onError({code:'POD_WORKER_CYCLE_FAILED'});}
  if(!active())break;
  try{await waitForNextCycle(pollMs,signal);}catch(e){if(e.name!=='AbortError')throw e;}
 }
}
