import {setTimeout as pause} from 'node:timers/promises';
import {deliverOutbox} from './outbox.mjs';

// Internal business feedback only; this runtime never calls a marketplace.
export function startOutboxRuntime({db,env=process.env,deliver=deliverOutbox,wait=pause,clock=Date.now}={}){
 const controller=new AbortController();
 let loop=Promise.resolve(),status='DISABLED',delivered=0,failures=0,lastSuccessAt=null;
 const pollMs=Number(env.POD_OUTBOX_POLL_MS||15000);
 if(env.POD_OUTBOX_ENABLED==='true'){
  let valid=false;
  try{const url=new URL(env.POD_OUTBOX_URL);valid=url.protocol==='https:'&&!url.username&&!url.password&&!url.hash;}catch{}
  if(!db||!valid||typeof env.POD_OUTBOX_KEY!=='string'||Buffer.byteLength(env.POD_OUTBOX_KEY)<32||
   !Number.isInteger(pollMs)||pollMs<1000||pollMs>300000){status='BLOCKED_OUTBOX_CONFIGURATION';}
  else{
   status='RUNNING';
   loop=(async()=>{
    let consecutiveFailures=0,cursor=null;
    while(!controller.signal.aborted){
     try{
      const result=await deliver(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,
       signal:controller.signal,continueOnError:true,cursor});
      cursor=result.nextCursor||null;
      delivered+=result.delivered;failures+=result.failed||0;
      if(result.failed){consecutiveFailures++;status='RETRYING';}
      else{consecutiveFailures=0;status='RUNNING';lastSuccessAt=new Date(clock()).toISOString();}
     }catch{
      if(controller.signal.aborted)break;
      failures++;consecutiveFailures++;status='RETRYING';
     }
     try{await wait(Math.min(300000,pollMs*2**Math.min(consecutiveFailures,5)),undefined,{signal:controller.signal});}
     catch{if(!controller.signal.aborted)throw Error('OUTBOX_WAIT_FAILED');}
    }
   })().catch(()=>{status='FAILED';});
  }
 }
 return {status:()=>({status,delivered,failures,last_success_at:lastSuccessAt}),
  stop:async()=>{controller.abort();await loop;if(['RUNNING','RETRYING'].includes(status))status='STOPPED';}};
}
