import {setTimeout as pause} from 'node:timers/promises';
import {types as utilTypes} from 'node:util';
import {deliverOutbox} from './outbox.mjs';

const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;
const signalAborted=signal=>Reflect.apply(nativeAborted,signal,[]);
async function waitForNextBatch(wait,delay,signal){
 // Delivery receives the lifecycle signal, so its public members are not
 // trusted by either lifecycle checks or the timer API.
 const controller=new AbortController(),abort=()=>{if(signalAborted(signal))controller.abort();};
 Reflect.apply(addAbortListener,signal,['abort',abort]);
 try{
  if(signalAborted(signal))abort();
  await wait(delay,undefined,{signal:controller.signal});
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

function snapshotDeliveryResult(result){
 const delivered=dataProperty(result,'delivered'),failed=dataProperty(result,'failed'),
  cursor=dataProperty(result,'nextCursor');
 if(!delivered.valid||!failed.valid||!cursor.valid)throw Error('OUTBOX_RESULT_UNVERIFIED');
 const failures=failed.value===undefined?0:failed.value;
 // deliverOutbox reads at most twenty events. Never coerce a result into
 // monitoring totals or advance its cursor before both counts are verified.
 const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=20&&!Object.is(value,-0);
 if(!count(delivered.value)||!count(failures)||delivered.value+failures>20)
  throw Error('OUTBOX_RESULT_UNVERIFIED');
 return {delivered:delivered.value,failed:failures,nextCursor:cursor.value||null};
}

// Internal business feedback only; this runtime never calls a marketplace.
export function startOutboxRuntime(options={}){
 const dbCapability=dataProperty(options,'db'),envCapability=dataProperty(options,'env'),
  deliverCapability=dataProperty(options,'deliver'),waitCapability=dataProperty(options,'wait'),
  clockCapability=dataProperty(options,'clock');
 if([dbCapability,envCapability,deliverCapability,waitCapability,clockCapability]
  .some(capability=>!capability.valid))throw Error('OUTBOX_RUNTIME_OPTIONS_UNVERIFIED');
 const db=dbCapability.value,env=envCapability.value===undefined?process.env:envCapability.value,
  deliver=deliverCapability.value===undefined?deliverOutbox:deliverCapability.value,
  wait=waitCapability.value===undefined?pause:waitCapability.value,
  clock=clockCapability.value===undefined?Date.now:clockCapability.value;
 const controller=new AbortController();
 const enabled=()=>{const capability=dataProperty(env,'POD_OUTBOX_ENABLED');return capability.valid&&capability.value==='true';};
 const stopped=()=>signalAborted(controller.signal)||!enabled();
 let loop=Promise.resolve(),status='DISABLED',delivered=0,failures=0,lastSuccessAt=null;
 const enabledCapability=dataProperty(env,'POD_OUTBOX_ENABLED');
 if(!enabledCapability.valid){status='BLOCKED_OUTBOX_CONFIGURATION';}
 else if(enabledCapability.value==='true'){
  const urlCapability=dataProperty(env,'POD_OUTBOX_URL'),keyCapability=dataProperty(env,'POD_OUTBOX_KEY'),
   pollCapability=dataProperty(env,'POD_OUTBOX_POLL_MS');
  let valid=false,url,key,pollMs;
  if(urlCapability.valid&&keyCapability.valid&&pollCapability.valid&&
   typeof urlCapability.value==='string'&&
   (pollCapability.value===undefined||typeof pollCapability.value==='string'||typeof pollCapability.value==='number')){
   url=urlCapability.value;key=keyCapability.value;pollMs=Number(pollCapability.value||15000);
   try{const parsed=new URL(url);valid=parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash;}catch{}
  }
  if(!db||!valid||typeof key!=='string'||Buffer.byteLength(key)<32||
   !Number.isInteger(pollMs)||pollMs<1000||pollMs>300000||typeof deliver!=='function'||
   typeof wait!=='function'||typeof clock!=='function'){status='BLOCKED_OUTBOX_CONFIGURATION';}
  else{
   status='RUNNING';
   loop=(async()=>{
    let consecutiveFailures=0,cursor=null;
    while(!stopped()){
     try{
      const result=snapshotDeliveryResult(await deliver(db,{url,key,signal:controller.signal,continueOnError:true,cursor}));
      cursor=result.nextCursor;
      delivered+=result.delivered;failures+=result.failed;
      // A drained batch may have committed acknowledgements before shutdown.
      // Retain those counts without turning cancellation into a healthy cycle.
      if(stopped())break;
      if(result.failed){consecutiveFailures++;status='RETRYING';}
      else{consecutiveFailures=0;status='RUNNING';lastSuccessAt=new Date(clock()).toISOString();}
     }catch{
      if(stopped())break;
      failures++;consecutiveFailures++;status='RETRYING';
     }
     try{await waitForNextBatch(wait,Math.min(300000,pollMs*2**Math.min(consecutiveFailures,5)),controller.signal);}
     catch{if(!stopped())throw Error('OUTBOX_WAIT_FAILED');}
    }
    status='STOPPED';
   })().catch(()=>{status='FAILED';});
  }
 }
 return {status:()=>({status,delivered,failures,last_success_at:lastSuccessAt}),
  stop:async()=>{controller.abort();await loop;if(['RUNNING','RETRYING'].includes(status))status='STOPPED';}};
}
