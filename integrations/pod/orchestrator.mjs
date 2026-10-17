import {setTimeout as pause} from 'node:timers/promises';
// One loop per process; PostgreSQL leases coordinate multiple processes.
export async function runPodWorker({db,produce,publish,signal,pollMs=15000,onError=()=>{},onCycle=()=>{},shouldContinue=()=>true}){
 if(!Number.isInteger(pollMs)||pollMs<1000||typeof produce!=='function'||typeof publish!=='function'||typeof shouldContinue!=='function')throw Error('WORKER_CONFIG_INVALID');
 const active=()=>!signal.aborted&&shouldContinue()===true;
 while(active()){
  try{onCycle({phase:'started'});if(!active())break;await db.recover();if(!active())break;
   const result=await produce();if(!active())break;
   await publish();if(!active())break;
   onCycle({phase:'completed',result});
  }catch{if(active())onError({code:'POD_WORKER_CYCLE_FAILED'});}
  if(!active())break;
  try{await pause(pollMs,undefined,{signal});}catch(e){if(e.name!=='AbortError')throw e;}
 }
}

