import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool,PodDB} from '../pod-db-bridge.js';
import {preflight} from './pod_preflight.mjs';
import {assertPublicationDisabled,exportArtifactLibrary,restoreArtifactLibrary,verifyArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';
import {readBridgeFile} from '../integrations/pod/bridge-file.mjs';
import {runArchiveSession} from '../integrations/pod/archive-session.mjs';

export async function archiveCLI(args,env=process.env,{connect=createPodPool,signal,timeoutMs}={}){
 if(args.length!==2||!['export','restore','verify'].includes(args[0])||!path.isAbsolute(args[1])||
  !/^[a-f0-9]{64}$/.test(env.POD_ARCHIVE_KEY||'')||env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_CLI_CONFIG_INVALID');
 const result=await runArchiveSession(async({signal,openPool})=>{
  if(args[0]==='restore'&&(env.POD_ARCHIVE_RESTORE_CONFIRM!=='ARTIFACTS_ONLY_NO_QUEUE_RESTORE'||(await preflight({env,signal,connect})).status!=='CONFIGURATION_VERIFIED'))throw Error('ARCHIVE_RESTORE_NOT_AUTHORIZED');
  if(args[0]==='verify')return verifyArtifactLibrary({directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),signal});
  const pool=await openPool(env);
  const db=args[0]==='export'?{pool}:new PodDB({pool,bridge:await readBridgeFile(env.POD_BRIDGE_PATH,{signal}),
   upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
  return (args[0]==='export'?exportArtifactLibrary:restoreArtifactLibrary)(db,
   {directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),env,signal});
 },{connect,signal,timeoutMs});
 assertPublicationDisabled(env);
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await archiveCLI(process.argv.slice(2))));}
 catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_ARCHIVE_FAILED'}));process.exitCode=1;}
}

