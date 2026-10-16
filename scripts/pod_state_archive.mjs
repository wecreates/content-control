import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool,PodDB} from '../pod-db-bridge.js';
import {preflight} from './pod_preflight.mjs';
import {exportStateArchive,verifyStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';

export async function stateArchiveCLI(args,env=process.env){
 if(args.length!==2||!['export','verify','restore'].includes(args[0])||!path.isAbsolute(args[1])||
  !/^[a-f0-9]{64}$/.test(env.POD_ARCHIVE_KEY||'')||env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('STATE_ARCHIVE_CLI_CONFIG_INVALID');
 const budgetBytes=artifactBudgetBytes(env);
 if(args[0]==='restore'&&(env.POD_STATE_RESTORE_CONFIRM!=='EMPTY_POD_DATABASE_RECOVERY'||
  env.POD_PRODUCTION_ENABLED!=='false'||env.POD_OUTBOX_ENABLED!=='false'||
  (await preflight({env})).status!=='CONFIGURATION_VERIFIED'))throw Error('STATE_ARCHIVE_RESTORE_NOT_AUTHORIZED');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);timer.unref();let pool;
 try{
  const options={directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),signal:controller.signal,env,budgetBytes};
  if(args[0]==='verify')return await verifyStateArchive(options);
  pool=await createPodPool(env);
  const db=args[0]==='export'?{pool}:new PodDB({pool,bridge:JSON.parse(await fs.readFile(env.POD_BRIDGE_PATH,'utf8')),
   upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
  return await (args[0]==='export'?exportStateArchive:restoreStateArchive)(db,options);
 }finally{clearTimeout(timer);if(pool)await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await stateArchiveCLI(process.argv.slice(2))));}
 catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_STATE_ARCHIVE_FAILED'}));process.exitCode=1;}
}
