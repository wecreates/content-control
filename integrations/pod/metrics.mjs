import {types as utilTypes} from 'node:util';
import {operationalHealth} from './operational-health.mjs';
import {PLATFORMS} from './policy.mjs';

const QUEUE_STATES=Object.freeze(['review_required','raw','processing','qa_failed','qa_passed','blocked',
 'publishing','ambiguous','submitted','published']);
const queueStates=new Set(QUEUE_STATES),platforms=new Set(PLATFORMS);
const STATE_FIELDS=Object.freeze(['platform','state','count']);
const COUNT_FIELDS=Object.freeze(['count']);
const STORAGE_FIELDS=Object.freeze(['bytes']);
const FINANCIAL_FIELDS=Object.freeze(['currency','verified_net_recorded_minor','evidence_count']);
const EVENT_FIELDS=Object.freeze(['count','oldest_seconds']);
const canonicalUnsigned=value=>typeof value==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(value);
const canonicalSignedTotal=value=>typeof value==='string'&&/^(0|-?[1-9][0-9]{0,38})$/.test(value);
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  const descriptor=Object.getOwnPropertyDescriptor(target,key);
  return descriptor&&Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
 }catch{return {valid:false};}
}
function ordinaryRecord(value){
 try{
  return value!==null&&(typeof value==='object'||typeof value==='function')&&!utilTypes.isProxy(value)&&
   [Object.prototype,null].includes(Object.getPrototypeOf(value));
 }catch{return false;}
}
function snapshotRows(result,fields,{maxRows,exactRows}={}){
 if(result===null||(typeof result!=='object'&&typeof result!=='function')||utilTypes.isProxy(result))throw Error('POD_METRICS_QUERY_UNVERIFIED');
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('POD_METRICS_QUERY_UNVERIFIED');
 let length;
 try{
  const descriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isInteger(descriptor.value)||descriptor.value<0||
   (Number.isInteger(maxRows)&&descriptor.value>maxRows)||(Number.isInteger(exactRows)&&descriptor.value!==exactRows))throw Error();
  length=descriptor.value;
 }catch{throw Error('POD_METRICS_QUERY_UNVERIFIED');}
 const snapshots=[];
 for(let index=0;index<length;index++){
  let element;
  try{element=Object.getOwnPropertyDescriptor(rows.value,String(index));}
  catch{throw Error('POD_METRICS_QUERY_UNVERIFIED');}
  if(!element||!Object.hasOwn(element,'value')||!ordinaryRecord(element.value))throw Error('POD_METRICS_QUERY_UNVERIFIED');
  const snapshot={};
  for(const field of fields){
   const capability=dataProperty(element.value,field);
   if(!capability.valid||typeof capability.value!=='string')throw Error('POD_METRICS_QUERY_UNVERIFIED');
   snapshot[field]=capability.value;
  }
  snapshots.push(Object.freeze(snapshot));
 }
 return Object.freeze(snapshots);
}
function validStateRows(rows){
 const identities=new Set();
 return rows.every(row=>platforms.has(row.platform)&&queueStates.has(row.state)&&canonicalUnsigned(row.count)&&
  !identities.has(`${row.platform}\0${row.state}`)&&identities.add(`${row.platform}\0${row.state}`));
}
function validFinancialRows(rows){
 const currencies=new Set();
 return rows.every(row=>/^[A-Z]{3}$/.test(row.currency)&&canonicalSignedTotal(row.verified_net_recorded_minor)&&
  canonicalUnsigned(row.evidence_count)&&row.evidence_count!=='0'&&!currencies.has(row.currency)&&currencies.add(row.currency));
}

export async function metrics(db,{env=process.env,clock=Date.now}={}){
 // Unlike writes, authenticated diagnostics must remain available while the
 // database approaches expiry. PostgreSQL enforces this transaction read-only.
 const client=await db.pool.connect();let bad=false,began=false,beginAttempted=false,commitPending=false;
 try{
  beginAttempted=true;await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');began=true;
  await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  const states=snapshotRows(await client.query("SELECT platform,CASE WHEN state='qa_failed' AND reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE state END AS state,count(*)::text AS count FROM pod_production_queue GROUP BY platform,2 ORDER BY platform,2"),STATE_FIELDS,{maxRows:PLATFORMS.length*QUEUE_STATES.length});
  const failures=snapshotRows(await client.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('blocked','qa_failed','ambiguous') AND NOT (state='qa_failed' AND reason_code IS NOT DISTINCT FROM 'REVIEW_REQUIRED')"),COUNT_FIELDS,{exactRows:1});
  const storage=snapshotRows(await client.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts'),STORAGE_FIELDS,{exactRows:1});
  const financials=snapshotRows(await client.query(`SELECT currency,sum(amount_minor)::text AS verified_net_recorded_minor,count(*)::text AS evidence_count
   FROM pod_financial_events GROUP BY currency ORDER BY currency`),FINANCIAL_FIELDS,{maxRows:26**3});
  const leases=snapshotRows(await client.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('processing','publishing') AND lease_until<=clock_timestamp()"),COUNT_FIELDS,{exactRows:1});
  const events=snapshotRows(await client.query(`SELECT count(*)::text AS count,
   COALESCE(GREATEST(0,FLOOR(EXTRACT(EPOCH FROM clock_timestamp()-min(created_at)))),0)::bigint::text AS oldest_seconds
   FROM pod_events WHERE delivered_at IS NULL`),EVENT_FIELDS,{exactRows:1});
  if(!validStateRows(states)||!canonicalUnsigned(failures[0].count)||!canonicalUnsigned(storage[0].bytes)||
   !validFinancialRows(financials)||!canonicalUnsigned(leases[0].count)||!canonicalUnsigned(events[0].count)||
   !canonicalUnsigned(events[0].oldest_seconds))throw Error('POD_METRICS_QUERY_UNVERIFIED');
  const health=operationalHealth({expiresAt:db.expiresAt,artifactBytes:storage[0].bytes,
   expiredLeases:leases[0].count,pendingEvents:events[0].count,oldestEventSeconds:events[0].oldest_seconds,now:clock(),env});
  commitPending=true;await client.query('COMMIT');commitPending=false;began=false;beginAttempted=false;
  return {queues:states,incident_count:failures[0].count,artifact_bytes:storage[0].bytes,
   financials,health,publication_enabled:false};
 }catch(error){
  // A rejected BEGIN leaves transport/protocol state uncertain and there is
  // no confirmed transaction to roll back. Destroy that pooled client rather
  // than issuing cleanup SQL on it or returning it for unrelated work.
  if(commitPending)bad=true;
  else if(began)try{await client.query('ROLLBACK');}catch{bad=true;}
  else if(beginAttempted)bad=true;
  throw error;
 }finally{client.release(bad);}
}
