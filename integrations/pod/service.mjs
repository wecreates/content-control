import fs from 'node:fs/promises';
import {createPodPool,PodDB} from '../../pod-db-bridge.js';
import {createPodRouter} from './router.mjs';
import {operationalAuth} from './auth.mjs';
import crypto from 'node:crypto';
import {startProductionRuntime} from './production-runtime.mjs';
export async function initializePodService({env=process.env,authorize,production}={}){
 let db,pool;
 const state={status:'DISABLED',publication_enabled:false};
 if(env.POD_SERVICE_ENABLED==='true'){
  try{
   const bridge=JSON.parse(await fs.readFile(env.POD_BRIDGE_PATH,'utf8'));
   pool=await createPodPool(env);
   db=new PodDB({pool,bridge,upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
   db.active();
   // Do not create tables or fall back to ephemeral storage on web startup.
   for(const name of ['001_pod.sql','002_pod.sql']){
    const sql=await fs.readFile(new URL('../../migrations/'+name,import.meta.url),'utf8');
    const actual=(await pool.query('SELECT sha256 FROM pod_schema_version WHERE version=$1',[name])).rows[0]?.sha256;
    if(actual!==crypto.createHash('sha256').update(sql).digest('hex'))throw Error('POD_SCHEMA_INCOMPATIBLE');
   }
   state.status='DATABASE_CONNECTED_UNVERIFIED_ADAPTERS';
  }catch{
   if(pool)await pool.end().catch(()=>{});db=undefined;state.status='BLOCKED_CONFIGURATION';
  }
 }
 const worker=startProductionRuntime({db,production,env});
 const status=()=>({...state,production_status:worker.status()});
 return {status,router:createPodRouter({db,authorize:authorize||operationalAuth(env.INTERNAL_OPERATIONS_KEY),env,status}),
  stop:async()=>{await worker.stop();if(db)await db.close();}};
}
