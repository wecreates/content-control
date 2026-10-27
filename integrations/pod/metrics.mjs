import {operationalHealth} from './operational-health.mjs';

export async function metrics(db,{env=process.env,clock=Date.now}={}){
 // Unlike writes, authenticated diagnostics must remain available while the
 // database approaches expiry. PostgreSQL enforces this transaction read-only.
 const client=await db.pool.connect();let bad=false,began=false,beginAttempted=false,commitPending=false;
 try{
  beginAttempted=true;await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');began=true;
  await client.query("SET LOCAL lock_timeout='2s'");await client.query("SET LOCAL statement_timeout='5s'");
  const states=await client.query("SELECT platform,CASE WHEN state='qa_failed' AND reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE state END AS state,count(*)::text AS count FROM pod_production_queue GROUP BY platform,2 ORDER BY platform,2");
  const failures=await client.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('blocked','qa_failed','ambiguous') AND NOT (state='qa_failed' AND reason_code IS NOT DISTINCT FROM 'REVIEW_REQUIRED')");
  const storage=await client.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts');
  const financials=await client.query(`SELECT currency,sum(amount_minor)::text AS verified_net_recorded_minor,count(*)::text AS evidence_count
   FROM pod_financial_events GROUP BY currency ORDER BY currency`);
  const leases=await client.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('processing','publishing') AND lease_until<=clock_timestamp()");
  const events=await client.query(`SELECT count(*)::text AS count,
   COALESCE(GREATEST(0,FLOOR(EXTRACT(EPOCH FROM clock_timestamp()-min(created_at)))),0)::bigint::text AS oldest_seconds
   FROM pod_events WHERE delivered_at IS NULL`);
  const health=operationalHealth({expiresAt:db.expiresAt,artifactBytes:storage.rows[0].bytes,
   expiredLeases:leases.rows[0].count,pendingEvents:events.rows[0].count,oldestEventSeconds:events.rows[0].oldest_seconds,now:clock(),env});
  commitPending=true;await client.query('COMMIT');commitPending=false;began=false;beginAttempted=false;
  return {queues:states.rows,incident_count:failures.rows[0].count,artifact_bytes:storage.rows[0].bytes,
   financials:financials.rows,health,publication_enabled:false};
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
