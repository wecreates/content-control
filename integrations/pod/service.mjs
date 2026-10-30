import {types as utilTypes} from 'node:util';
import {createPodPool,PodDB} from '../../pod-db-bridge.js';
import {readBridgeFile} from './bridge-file.mjs';
import {createPodRouter} from './router.mjs';
import {operationalAuth} from './auth.mjs';
import {requirePodRuntime} from './runtime-gate.mjs';
import {checkPodPython} from './python-runtime.mjs';
import {createStoredTaskResolvers} from './task-resolver.mjs';
import {startProductionRuntime} from './production-runtime.mjs';
import {startOutboxRuntime} from './outbox-runtime.mjs';

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

function snapshotEnvironment(env){
 try{
  if(env===null||typeof env!=='object'||utilTypes.isProxy(env))return {valid:false};
  const prototype=Object.getPrototypeOf(env);
  if(env!==process.env&&prototype!==Object.prototype&&prototype!==null)return {valid:false};
  const value=Object.create(null);
  for(const key of Reflect.ownKeys(env)){
   if(typeof key!=='string')return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(env,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value'))return {valid:false};
   Object.defineProperty(value,key,{value:descriptor.value,writable:true,enumerable:descriptor.enumerable,configurable:true});
  }
  return {valid:true,value};
 }catch{return {valid:false};}
}

export async function initializePodService(options={}){
 const envCapability=dataProperty(options,'env'),authorizeCapability=dataProperty(options,'authorize'),
  productionCapability=dataProperty(options,'production');
 if([envCapability,authorizeCapability,productionCapability].some(capability=>!capability.valid))
  throw Error('POD_SERVICE_OPTIONS_UNVERIFIED');
 const env=envCapability.value===undefined?process.env:envCapability.value,
  authorize=authorizeCapability.value,production=productionCapability.value,
  environment=snapshotEnvironment(env);
 if(!environment.valid)throw Error('POD_SERVICE_ENV_UNVERIFIED');
 // Startup consumers receive an immutable-by-convention data snapshot. The
 // worker and outbox retain the validated source object so their descriptor-safe
 // live off-switches can still stop already-running loops.
 const serviceEnv=environment.value;
 let db,pool;
 const state={status:'DISABLED',publication_enabled:false};
 if(serviceEnv.POD_SERVICE_ENABLED==='true'){
  try{
   const bridge=await readBridgeFile(serviceEnv.POD_BRIDGE_PATH);
   pool=await createPodPool(serviceEnv);
   await requirePodRuntime({pool,env:serviceEnv});
   db=new PodDB({pool,bridge,upstreamKey:serviceEnv.POD_UPSTREAM_KEY,qaKey:serviceEnv.POD_QA_KEY,
    expiresAt:serviceEnv.POD_STORAGE_EXPIRES_AT});
   db.active();
   state.status='DATABASE_CONNECTED_UNVERIFIED_ADAPTERS';
  }catch{
   if(pool)await pool.end().catch(()=>{});db=undefined;state.status='BLOCKED_CONFIGURATION';
  }
 }
 const pythonReady=serviceEnv.POD_PRODUCTION_ENABLED==='true'&&db?await checkPodPython(serviceEnv):true;
 const worker=startProductionRuntime({db,pythonReady,
  production:production||(db?createStoredTaskResolvers(db,{env:serviceEnv}):undefined),env});
 const outbox=startOutboxRuntime({db,env});
 const status=()=>({...state,database_health:pool?.podConnectionHealth?.()??null,
  production_status:worker.status(),production_health:worker.health(),outbox:outbox.status()});
 return {status,router:createPodRouter({db,authorize:authorize||operationalAuth(serviceEnv.INTERNAL_OPERATIONS_KEY),
   env:serviceEnv,status}),
  stop:async()=>{await Promise.all([worker.stop(),outbox.stop()]);if(db)await db.close();}};
}
