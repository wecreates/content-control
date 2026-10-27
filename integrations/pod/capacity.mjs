// Historical activity is not proof of unique artwork, sustained throughput,
// current QA readiness, publication permission or production acceptance.
export async function productionActivity(db){
 const client=await db.pool.connect();let bad=false,began=false,beginAttempted=false,commitPending=false;
 try{
  beginAttempted=true;await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');began=true;
  await client.query("SET LOCAL lock_timeout='2s'");
  await client.query("SET LOCAL statement_timeout='5s'");
  const {rows}=await client.query(`WITH observation_window AS (
   SELECT transaction_timestamp() AS finish,transaction_timestamp()-interval '24 hours' AS start
  ), events AS (
   SELECT e.kind,e.payload,q.id AS job_id,q.concept_id FROM pod_events e
   JOIN pod_production_queue q ON q.id=e.job_id CROSS JOIN observation_window w
   WHERE e.created_at>=w.start AND e.created_at<w.finish
   AND q.platform IN ('kdp','redbubble','teepublic','zazzle','spreadshirt')
   AND e.payload->>'package_sha256' ~ '^[a-f0-9]{64}$'
  ), generated AS (
   SELECT * FROM events WHERE kind='pod.production.review_required'
   OR (kind IN ('pod.production.qa_passed','pod.production.qa_failed')
       AND payload->>'fencing_token' ~ '^[0-9]+$')
  ) SELECT
   (SELECT start FROM observation_window) AS window_start,(SELECT finish FROM observation_window) AS window_end,
   (SELECT count(*)::text FROM pod_concepts c CROSS JOIN observation_window w WHERE c.created_at>=w.start AND c.created_at<w.finish) AS registered_concept_records,
   (SELECT count(DISTINCT concept_id)::text FROM generated) AS generated_concept_records,
   (SELECT count(DISTINCT job_id)::text FROM generated) AS generated_jobs,
   (SELECT count(DISTINCT (payload->>'package_sha256'))::text FROM generated) AS generated_package_hashes,
   (SELECT count(DISTINCT job_id)::text FROM events WHERE kind='pod.production.qa_passed') AS jobs_with_pass_event,
   (SELECT count(DISTINCT job_id)::text FROM events WHERE kind='pod.production.qa_failed') AS jobs_with_fail_event`);
  const row=rows[0],counts={};
  for(const field of ['registered_concept_records','generated_concept_records','generated_jobs',
   'generated_package_hashes','jobs_with_pass_event','jobs_with_fail_event']){
   if(typeof row?.[field]!=='string'||!/^(0|[1-9][0-9]*)$/.test(row[field]))throw Error('CAPACITY_REPORT_INVALID');
   counts[field]=row[field];
  }
  const start=new Date(row.window_start),end=new Date(row.window_end);
  if(!Number.isFinite(start.getTime())||end-start!==86400000)throw Error('CAPACITY_REPORT_INVALID');
  commitPending=true;await client.query('COMMIT');commitPending=false;began=false;beginAttempted=false;
  return {schema_version:1,scope:'recorded_production_activity',window:{start:start.toISOString(),end:end.toISOString(),hours:24},
   counts,targets:{baseline_unique_concepts_per_day:100,scale_unique_concepts_per_day:1000},
   evidence_limitations:['concept_records_do_not_prove_unique_artwork','jobs_include_variants_and_revisions',
    'history_does_not_prove_continuous_observation','qa_events_are_not_current_readiness'],
   capacity_verified:false,acceptance_verified:false,publication_enabled:false};
 }catch(error){
  if(commitPending)bad=true;
  else if(began)try{await client.query('ROLLBACK');}catch{bad=true;}
  else if(beginAttempted)bad=true;
  throw error;
 }finally{client.release(bad);}
}
