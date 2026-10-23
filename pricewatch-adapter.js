import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const worker = fileURLToPath(new URL('./pricewatch-transaction.py', import.meta.url));

export function recordPrice(dbPath, request, {python='python3', deadlineMs=10000}={}) {
  if (!dbPath) return Promise.reject(new Error('price_storage_not_configured'));
  const input=JSON.stringify(request);
  if(Buffer.byteLength(input)>6*2097152+4096) return Promise.reject(new Error('price_worker_input_limit'));
  return new Promise((resolve, reject) => {
    const child=spawn(python, [worker, dbPath], {stdio:['pipe','pipe','pipe']});
    let output='', size=0, settled=false;
    const finish=(error,value)=>{ if(settled)return; settled=true; clearTimeout(timer); error?reject(error):resolve(value); };
    const timer=setTimeout(()=>{ child.kill('SIGKILL'); finish(new Error('price_worker_deadline')); }, deadlineMs);
    child.on('error',()=>finish(new Error('price_worker_unavailable')));
    child.stdin.on('error',()=>finish(new Error('price_worker_input_failed')));
    child.stderr.resume();
    child.stdout.on('data', data=>{size+=data.length;if(size>65536){child.kill('SIGKILL');finish(new Error('price_worker_output_limit'));}else output+=data;});
    child.on('close',code=>{try{const result=JSON.parse(output);if(code!==0 || !['recorded','duplicate','deleted','active','inspected','capacity_blocked'].includes(result.status))throw new Error();finish(null,result);}catch{finish(new Error('price_worker_rejected'));}});
    child.stdin.end(input);
  });
}

// fetchPricePage is an explicit trusted host boundary: enforce SSRF/redirect,
// response byte/decode limits and HTTP/challenge checks before returning HTML.
// No fallback to the legacy unrestricted fetch is permitted for price watches.
const runtimeToken=crypto.randomUUID();
const epochs=new Map();
const queues=new Map();
function keyOf(w){return JSON.stringify([w.client_id,w.id]);}
function breakContinuity(key){epochs.set(key,crypto.randomUUID());}

export async function checkPriceWatch(w, options={}) {
  // Snapshot before any await; mutable objects are not authorization boundaries.
  const config=Object.freeze({client_id:w.client_id,id:w.id,target_url:w.target_url,
    price_currency:w.price_currency,price_minimum_drop:w.price_minimum_drop,
    price_minimum_drop_percent:w.price_minimum_drop_percent});
  const key=keyOf(config);
  const previous=queues.get(key)||Promise.resolve();
  const task=previous.catch(()=>{}).then(()=>performCheck(config,options,key));
  queues.set(key,task);
  try{return await task;}finally{if(queues.get(key)===task)queues.delete(key);}
}
async function performCheck(w, {priceDbPath, fetchPricePage, priceCheckId=crypto.randomUUID(),
  priceCheckedAt=new Date().toISOString(), priceWorkerOptions, priceOutboxLimits, isCurrent=()=>true}={}, key) {
  if(!epochs.has(key))breakContinuity(key);
  if(!priceDbPath || !w.price_currency || typeof fetchPricePage!=='function' || !priceCheckId){
    breakContinuity(key);
    return {ok:false,reason:'price_integration_not_configured'};
  }
  try {
    const current=await recordPrice(priceDbPath,{operation:'check_watch',scope_id:w.client_id,watch_id:w.id,outbox_limits:priceOutboxLimits,
      runtime_pid:process.pid,runtime_token:runtimeToken},priceWorkerOptions);
    if(current.status==='deleted')return {ok:false,reason:'price_watch_deleted'};
    if(current.status==='capacity_blocked'){breakContinuity(key);return {ok:false,reason:'price_outbox_capacity_reached'};}
  } catch(error){breakContinuity(key);throw error;}
  if(!isCurrent()){breakContinuity(key);return {ok:false,reason:'price_watch_changed'};}
  let observation, page;
  try {
    page=await fetchPricePage(w.target_url);
    if(!page || page.verified!==true || page.finalUrl!==w.target_url || typeof page.html!=='string' || Buffer.byteLength(page.html)>2097152)
      throw new Error('unverified');
  } catch { observation={status:'unsupported',reason:'fetch_failed'}; }
  if(!isCurrent()){breakContinuity(key);return {ok:false,reason:'price_watch_changed'};}
  try {
    const result=await recordPrice(priceDbPath, {
      scope_id:w.client_id, watch_id:w.id, currency:w.price_currency, outbox_limits:priceOutboxLimits,
      minimum_drop:w.price_minimum_drop??'0', minimum_drop_percent:w.price_minimum_drop_percent??'0',
      observation_id:priceCheckId, observed_at:priceCheckedAt, continuity_epoch:epochs.get(key), runtime_pid:process.pid, runtime_token:runtimeToken,
      ...(observation?{observation}:{html:page.html,page_url:page.finalUrl})
    },priceWorkerOptions);
    if(result.status==='deleted')return {ok:false,reason:'price_watch_deleted'};
    if(result.status==='capacity_blocked'){breakContinuity(key);return {ok:false,reason:'price_outbox_capacity_reached'};}
    return {ok:true,...result};
  } catch(error){breakContinuity(key);throw error;}
}

export async function deletePriceWatch(scopeId,watchId,{priceDbPath,priceWorkerOptions}={}) {
  const result=await recordPrice(priceDbPath,{operation:'delete_watch',scope_id:scopeId,watch_id:watchId,
    runtime_pid:process.pid,runtime_token:runtimeToken},priceWorkerOptions);
  if(result.status!=='deleted')throw new Error('price_delete_failed');
  epochs.delete(JSON.stringify([scopeId,watchId]));
  return result;
}
export async function deletedPriceWatches(scopeId,watchIds,{priceDbPath,priceWorkerOptions}={}) {
  if(!watchIds.length)return [];
  const deleted=[];
  for(let i=0;i<watchIds.length;i+=100){
    const result=await recordPrice(priceDbPath,{operation:'deleted_watches',scope_id:scopeId,watch_id:'maintenance',watch_ids:watchIds.slice(i,i+100),
      runtime_pid:process.pid,runtime_token:runtimeToken},priceWorkerOptions);
    if(result.status!=='inspected'||!Array.isArray(result.deleted_ids))throw new Error('price_delete_status_failed');
    deleted.push(...result.deleted_ids);
  }
  return deleted;
}
