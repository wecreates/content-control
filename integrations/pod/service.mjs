import fs from 'node:fs/promises';
import {createPodPool,PodDB} from '../../pod-db-bridge.js';
import {createPodRouter} from './router.mjs';
import {operationalAuth} from './auth.mjs';
import {requirePodRuntime} from './runtime-gate.mjs';
import {checkPodPython} from './python-runtime.mjs';
import {createStoredTaskResolvers} from './task-resolver.mjs';
import {startProductionRuntime} from './production-runtime.mjs';
import {startOutboxRuntime} from './outbox-runtime.mjs';
export async function initializePodService({env=process.env,authorize,production}={}){
 let db,pool;
 const state={status:'DISABLED',publication_enabled:false};
 if(env.POD_SERVICE_ENABLED==='true'){
  try{
   const bridge=JSON.parse(await fs.readFile(env.POD_BRIDGE_PATH,'utf8'));
   pool=await createPodPool(env);
   await requirePodRuntime({pool,env});
   db=new PodDB({pool,bridge,upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
   db.active();
   state.status='DATABASE_CONNECTED_UNVERIFIED_ADAPTERS';
  }catch{
   if(pool)await pool.end().catch(()=>{});db=undefined;state.status='BLOCKED_CONFIGURATION';
  }
 }
 const pythonReady=env.POD_PRODUCTION_ENABLED==='true'&&db?await checkPodPython(env):true;
 const worker=startProductionRuntime({db,pythonReady,production:production||(db?createStoredTaskResolvers(db,{env}):undefined),env});
 const outbox=startOutboxRuntime({db,env});
 const status=()=>({...state,production_status:worker.status(),production_health:worker.health(),outbox:outbox.status()});
 return {status,router:createPodRouter({db,authorize:authorize||operationalAuth(env.INTERNAL_OPERATIONS_KEY),env,status}),
  stop:async()=>{await Promise.all([worker.stop(),outbox.stop()]);if(db)await db.close();}};
}



