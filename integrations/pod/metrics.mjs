import {financialTotals} from './finance.mjs';
export async function metrics(db){
 db.active();
 const states=await db.pool.query("SELECT platform,CASE WHEN state='qa_failed' AND reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE state END AS state,count(*)::text AS count FROM pod_production_queue GROUP BY platform,2 ORDER BY platform,2");
 const failures=await db.pool.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('blocked','qa_failed','ambiguous') AND NOT (state='qa_failed' AND reason_code IS NOT DISTINCT FROM 'REVIEW_REQUIRED')");
 const storage=await db.pool.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts');
 return {queues:states.rows,incident_count:failures.rows[0].count,artifact_bytes:storage.rows[0].bytes,financials:await financialTotals(db),publication_enabled:false};
}
