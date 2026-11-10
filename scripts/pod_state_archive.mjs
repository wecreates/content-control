import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool,PodDB} from '../pod-db-bridge.js';
import {preflight} from './pod_preflight.mjs';
import {assertStateArchiveDisabled,exportStateArchive,verifyStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';
import {readBridgeFile} from '../integrations/pod/bridge-file.mjs';
import {runArchiveSession} from '../integrations/pod/archive-session.mjs';

export async function stateArchiveCLI(args,env=process.env,{connect=createPodPool,signal,timeoutMs}={}){
 if(args.length!==2||!['export','verify','restore'].includes(args[0])||!path.isAbsolute(args[1])||
  !/^[a-f0-9]{64}$/.test(env.POD_ARCHIVE_KEY||'')||env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('STATE_ARCHIVE_CLI_CONFIG_INVALID');
 const budgetBytes=artifactBudgetBytes(env);
 const restoring=args[0]==='restore';
 const result=await runArchiveSession(async({signal,openPool})=>{
  if(restoring&&(env.POD_STATE_RESTORE_CONFIRM!=='EMPTY_POD_DATABASE_RECOVERY'||
   env.POD_PRODUCTION_ENABLED!=='false'||env.POD_OUTBOX_ENABLED!=='false'||
   (await preflight({env,signal,connect})).status!=='CONFIGURATION_VERIFIED'))throw Error('STATE_ARCHIVE_RESTORE_NOT_AUTHORIZED');
  const options={directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),signal,env,budgetBytes};
  if(args[0]==='verify')return verifyStateArchive(options);
  const pool=await openPool(env);
  const db=args[0]==='export'?{pool}:new PodDB({pool,bridge:await readBridgeFile(env.POD_BRIDGE_PATH,{signal}),
   upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
  return (args[0]==='export'?exportStateArchive:restoreStateArchive)(db,options);
 },{connect,signal,timeoutMs});
 assertStateArchiveDisabled(env,restoring);
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await stateArchiveCLI(process.argv.slice(2))));}
 catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_STATE_ARCHIVE_FAILED'}));process.exitCode=1;}
}
