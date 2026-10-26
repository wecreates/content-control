import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool} from '../pod-db-bridge.js';
import {metrics} from '../integrations/pod/metrics.mjs';
import {parseStorageExpiry} from '../integrations/pod/storage-expiry.mjs';

// Manual read-only diagnostics remain usable when service startup/preflight is
// blocked. This does not mount a router, start workers, migrate or change flags.
export async function operationsSnapshot({env=process.env,connect=createPodPool,clock=Date.now}={}){
 const pool=await connect(env);
 try{return await metrics({pool,expiresAt:parseStorageExpiry(env.POD_STORAGE_EXPIRES_AT)},{env,clock});}
 finally{await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==2)throw Error('UNEXPECTED_ARGUMENTS');
  console.log(JSON.stringify(await operationsSnapshot()));
 }catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_OPERATIONS_SNAPSHOT_UNAVAILABLE'}));process.exitCode=1;}
}
