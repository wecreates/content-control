import {setTimeout as pause} from 'node:timers/promises';
// One loop per process; PostgreSQL leases coordinate multiple processes.
export async function runPodWorker({db,produce,publish,signal,pollMs=15000,onError=()=>{}}){
 if(!Number.isInteger(pollMs)||pollMs<1000||typeof produce!=='function'||typeof publish!=='function')throw Error('WORKER_CONFIG_INVALID');
 while(!signal.aborted){
  try{await db.recover();if(signal.aborted)break;await produce();if(!signal.aborted)await publish();}catch{onError({code:'POD_WORKER_CYCLE_FAILED'});}
  try{await pause(pollMs,undefined,{signal});}catch(e){if(e.name!=='AbortError')throw e;}
 }
}
