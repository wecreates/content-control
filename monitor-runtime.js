import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createStore,hydrateStore,serializeStore,applyCheck} from './monitor-store.js';

const STATE_FILE=process.env.MONITOR_STATE_FILE||path.resolve('state/monitor-state.json');
const BACKUP_URL=process.env.MONITOR_BACKUP_URL||'https://raw.githubusercontent.com/wecreates/content-control/main/MONITOR_STATE_BACKUP.json';

export async function loadMonitorStore(){
  try{return hydrateStore(JSON.parse(await fs.readFile(STATE_FILE,'utf8')));}catch{}
  try{
    const r=await fetch(BACKUP_URL,{headers:{'user-agent':'CYZOR-Monitor-Restore/1.0'}});
    if(r.ok) return hydrateStore(await r.json());
  }catch{}
  return createStore();
}

export async function saveMonitorStore(store){
  await fs.mkdir(path.dirname(STATE_FILE),{recursive:true});
  await fs.writeFile(STATE_FILE,serializeStore(store));
}

export async function checkMonitorStore(store){
  for(const w of store.watches.filter(x=>x.status==='active')){
    try{
      const r=await fetch(w.target_url,{redirect:'follow',headers:{'user-agent':'CYZOR-Free-Monitor/1.0'}});
      const body=Buffer.from(await r.arrayBuffer());
      const hash=crypto.createHash('sha256').update(body).digest('hex');
      applyCheck(store,w.id,{hash,checkedAt:Date.now(),status:r.status});
      delete w.last_error;
    }catch(error){
      w.last_checked_at=Date.now();
      w.last_error=String(error);
    }
  }
  await saveMonitorStore(store);
}
