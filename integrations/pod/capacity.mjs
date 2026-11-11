import {types as utilTypes} from 'node:util';
import {diagnosticDeadline,diagnosticStep,isDiagnosticDeadline} from './diagnostic-deadline.mjs';
import {assertBeginOutcome,assertCommitOutcome,assertRollbackOutcome} from './transaction-outcome.mjs';

const COUNT_FIELDS=Object.freeze(['registered_concept_records','generated_concept_records','generated_jobs',
 'generated_package_hashes','jobs_with_pass_event','jobs_with_fail_event']);
const CAPACITY_FIELDS=Object.freeze(['window_start','window_end',...COUNT_FIELDS]);
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
function snapshotTimestamp(value){
 // pg returns native Dates. String adapters must provide exact UTC seconds or
 // milliseconds; Date.parse must not normalize calendar errors or lose precision.
 if(typeof value==='string'){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw Error('CAPACITY_REPORT_INVALID');
  const millis=Date.parse(value);
  if(!Number.isFinite(millis))throw Error('CAPACITY_REPORT_INVALID');
  const canonical=new Date(millis).toISOString();
  if(value!==canonical&&value!==canonical.replace('.000Z','Z'))throw Error('CAPACITY_REPORT_INVALID');
  return canonical;
 }
 if(value===null||typeof value!=='object'||utilTypes.isProxy(value)||!utilTypes.isDate(value))
  throw Error('CAPACITY_REPORT_INVALID');
 let millis;
 try{millis=Date.prototype.getTime.call(value);}catch{throw Error('CAPACITY_REPORT_INVALID');}
 if(!Number.isFinite(millis))throw Error('CAPACITY_REPORT_INVALID');
 return new Date(millis).toISOString();
}
function snapshotCapacityRow(result){
 if(result===null||(typeof result!=='object'&&typeof result!=='function')||utilTypes.isProxy(result))
  throw Error('CAPACITY_REPORT_INVALID');
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('CAPACITY_REPORT_INVALID');
 let length,rowDescriptor;
 try{
  const lengthDescriptor=Object.getOwnPropertyDescriptor(rows.value,'length');
  if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||lengthDescriptor.value!==1)throw Error();
  length=lengthDescriptor.value;
  rowDescriptor=Object.getOwnPropertyDescriptor(rows.value,'0');
 }catch{throw Error('CAPACITY_REPORT_INVALID');}
 if(length!==1||!rowDescriptor||!Object.hasOwn(rowDescriptor,'value')||!ordinaryRecord(rowDescriptor.value))
  throw Error('CAPACITY_REPORT_INVALID');
 const snapshot={};
 for(const field of CAPACITY_FIELDS){
  const property=dataProperty(rowDescriptor.value,field);
  if(!property.valid)throw Error('CAPACITY_REPORT_INVALID');
  snapshot[field]=field.startsWith('window_')?snapshotTimestamp(property.value):property.value;
 }
 return Object.freeze(snapshot);
}

// Historical activity is not proof of unique artwork, sustained throughput,
// current QA readiness, publication permission or production acceptance.
export async function productionActivity(db,{signal}={}){
 const deadline=diagnosticDeadline(signal);
 const client=await diagnosticStep(()=>db.pool.connect(),deadline,{onLate:late=>{
  try{Promise.resolve(late.release(true)).catch(()=>{});}catch{}
 }});
 const query=(...args)=>diagnosticStep(()=>client.query(...args),deadline);
 let bad=false,began=false,beginAttempted=false,commitPending=false;
 try{
  beginAttempted=true;assertBeginOutcome(await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));began=true;
  await query("SET LOCAL lock_timeout='2s'");
  await query("SET LOCAL statement_timeout='5s'");
  const row=snapshotCapacityRow(await query(`WITH observation_window AS (
   -- pg Date values preserve milliseconds, not PostgreSQL microseconds. Count
   -- against the same exact boundaries exposed in the activity receipt.
   SELECT date_trunc('milliseconds',transaction_timestamp()) AS finish,date_trunc('milliseconds',transaction_timestamp())-interval '24 hours' AS start
  ), events AS (
   SELECT e.kind,e.payload,q.id AS job_id,q.concept_id FROM public.pod_events e
   JOIN public.pod_production_queue q ON q.id=e.job_id CROSS JOIN observation_window w
   WHERE e.created_at>=w.start AND e.created_at<w.finish
   AND q.platform IN ('kdp','redbubble','teepublic','zazzle','spreadshirt')
   AND e.payload->>'package_sha256' ~ '^[a-f0-9]{64}$'
  ), generated AS (
   SELECT * FROM events WHERE kind='pod.production.review_required'
   OR (kind IN ('pod.production.qa_passed','pod.production.qa_failed')
       AND payload->>'fencing_token' ~ '^[0-9]+$')
  ) SELECT
   (SELECT start FROM observation_window) AS window_start,(SELECT finish FROM observation_window) AS window_end,
   (SELECT count(*)::text FROM public.pod_concepts c CROSS JOIN observation_window w WHERE c.created_at>=w.start AND c.created_at<w.finish) AS registered_concept_records,
   (SELECT count(DISTINCT concept_id)::text FROM generated) AS generated_concept_records,
   (SELECT count(DISTINCT job_id)::text FROM generated) AS generated_jobs,
   (SELECT count(DISTINCT (payload->>'package_sha256'))::text FROM generated) AS generated_package_hashes,
   (SELECT count(DISTINCT job_id)::text FROM events WHERE kind='pod.production.qa_passed') AS jobs_with_pass_event,
   (SELECT count(DISTINCT job_id)::text FROM events WHERE kind='pod.production.qa_failed') AS jobs_with_fail_event`));
  const counts={};
  for(const field of COUNT_FIELDS){
   if(typeof row[field]!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(row[field]))throw Error('CAPACITY_REPORT_INVALID');
   counts[field]=row[field];
  }
  const start=new Date(row.window_start),end=new Date(row.window_end);
  if(!Number.isFinite(start.getTime())||end-start!==86400000)throw Error('CAPACITY_REPORT_INVALID');
  commitPending=true;assertCommitOutcome(await query('COMMIT'));commitPending=false;began=false;beginAttempted=false;
  return {schema_version:1,scope:'recorded_production_activity',window:{start:start.toISOString(),end:end.toISOString(),hours:24},
   counts,targets:{baseline_unique_concepts_per_day:100,scale_unique_concepts_per_day:1000},
   evidence_limitations:['concept_records_do_not_prove_unique_artwork','jobs_include_variants_and_revisions',
    'history_does_not_prove_continuous_observation','qa_events_are_not_current_readiness'],
   capacity_verified:false,acceptance_verified:false,publication_enabled:false};
 }catch(error){
  if(isDiagnosticDeadline(error)||commitPending)bad=true;
  else if(began)try{assertRollbackOutcome(await query('ROLLBACK'));}catch{bad=true;}
  else if(beginAttempted)bad=true;
  throw error;
 }finally{
  // Cleanup is part of verification, even after cancellation. Never return a
  // report while asynchronous release is failed or still unverified.
  const releasing=Promise.resolve(client.release(bad));releasing.catch(()=>{});
  await diagnosticStep(()=>releasing,deadline);
 }
}
