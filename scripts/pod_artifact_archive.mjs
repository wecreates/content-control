import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool,PodDB} from '../pod-db-bridge.js';
import {preflight} from './pod_preflight.mjs';
import {exportArtifactLibrary,restoreArtifactLibrary,verifyArtifactLibrary} from '../integrations/pod/artifact-archive.mjs';

export async function archiveCLI(args,env=process.env){
 if(args.length!==2||!['export','restore','verify'].includes(args[0])||!path.isAbsolute(args[1])||
  !/^[a-f0-9]{64}$/.test(env.POD_ARCHIVE_KEY||'')||env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('ARCHIVE_CLI_CONFIG_INVALID');
 if(args[0]==='restore'&&(env.POD_ARCHIVE_RESTORE_CONFIRM!=='ARTIFACTS_ONLY_NO_QUEUE_RESTORE'||(await preflight({env})).status!=='CONFIGURATION_VERIFIED'))throw Error('ARCHIVE_RESTORE_NOT_AUTHORIZED');
 const controller=new AbortController();let pool;
 const timer=setTimeout(()=>controller.abort(),600000);timer.unref();
 try{
  if(args[0]==='verify')return await verifyArtifactLibrary({directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),signal:controller.signal});
  pool=await createPodPool(env);
  const db=args[0]==='export'?{pool}:new PodDB({pool,bridge:JSON.parse(await fs.readFile(env.POD_BRIDGE_PATH,'utf8')),
   upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
  return await (args[0]==='export'?exportArtifactLibrary:restoreArtifactLibrary)(db,
   {directory:args[1],key:Buffer.from(env.POD_ARCHIVE_KEY,'hex'),env,signal:controller.signal});
 }finally{clearTimeout(timer);if(pool)await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await archiveCLI(process.argv.slice(2))));}
 catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_ARCHIVE_FAILED'}));process.exitCode=1;}
}

