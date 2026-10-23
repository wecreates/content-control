import fs from 'node:fs/promises';
import {checkPriceWatch} from './pricewatch-adapter.js';
import path from 'node:path';
import crypto from 'node:crypto';
import {createStore,hydrateStore,serializeStore,applyCheck} from './monitor-store.js';

const STATE_FILE=process.env.MONITOR_STATE_FILE||path.resolve('state/monitor-state.json');
const BACKUP_URL=process.env.MONITOR_BACKUP_URL||'https://raw.githubusercontent.com/wecreates/content-control/main/MONITOR_STATE_BACKUP.json';

export async function loadMonitorStore({stateFile=STATE_FILE,backupUrl=BACKUP_URL,fetchImpl=fetch,timeoutMs=5000}={}){
  try{return hydrateStore(JSON.parse(await fs.readFile(stateFile,'utf8')));}catch{}
  try{
    const r=await fetchImpl(backupUrl,{signal:AbortSignal.timeout(timeoutMs),headers:{'user-agent':'CYZOR-Monitor-Restore/1.0'}});
    if(r.ok) return hydrateStore(await r.json());
  }catch{}
  return createStore();
}

export async function saveMonitorStore(store){
  await fs.mkdir(path.dirname(STATE_FILE),{recursive:true});
  await fs.writeFile(STATE_FILE,serializeStore(store));
}

export async function checkWatch(store,id,{fetchImpl=fetch,persist=true,timeoutMs=10000,...priceOptions}={}){
  const w=store.watches.find(x=>x.id===String(id));
  if(!w||w.status!=='active') return {ok:false,reason:'not_found_or_inactive'};
  if(w.kind==='price'){
    const scope=w.client_id, watchId=w.id;
    const configuration=JSON.stringify([w.target_url,w.price_currency,w.price_minimum_drop,w.price_minimum_drop_percent]);
    const unchanged=()=>store.watches.includes(w)&&w.client_id===scope&&w.id===watchId&&w.status==='active'&&configuration===JSON.stringify([w.target_url,w.price_currency,w.price_minimum_drop,w.price_minimum_drop_percent]);
    let result;
    try{result=await checkPriceWatch(w,{...priceOptions,isCurrent:unchanged});}
    catch{result={ok:false,reason:'price_check_failed'};}
    if(unchanged()){
      w.price_monitoring_status=result.monitoring_status||result.reason;
      if(result.ok){w.last_checked_at=Date.parse(result.last_observed_at);w.price_last_observation=result.last_price;}
      if(persist)await saveMonitorStore(store);
    }
    return {...result,last_checked_at:w.last_checked_at};
  }
  try{
    const r=await fetchImpl(w.target_url,{signal:AbortSignal.timeout(timeoutMs),redirect:'follow',headers:{'user-agent':'CYZOR-Free-Monitor/1.0'}});
    const body=Buffer.from(await r.arrayBuffer());
    const hash=crypto.createHash('sha256').update(body).digest('hex');
    applyCheck(store,w.id,{hash,checkedAt:Date.now(),status:r.status});
    delete w.last_error;
    if(persist) await saveMonitorStore(store);
    return {ok:true,status:r.status,last_checked_at:w.last_checked_at};
  }catch(error){
    w.last_checked_at=Date.now();
    w.last_error=String(error);
    if(persist) await saveMonitorStore(store);
    return {ok:false,error:w.last_error,last_checked_at:w.last_checked_at};
  }
}

export async function checkMonitorStore(store,{saveStore=saveMonitorStore,...checkOptions}={}){
  for(const w of store.watches.filter(x=>x.status==='active')){
    await checkWatch(store,w.id,{...checkOptions,persist:false});
  }
  await saveStore(store);
}

