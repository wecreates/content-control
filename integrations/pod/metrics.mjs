import {financialTotals} from './finance.mjs';
export async function metrics(db){
 db.active();
 const states=await db.pool.query('SELECT platform,state,count(*)::text AS count FROM pod_production_queue GROUP BY platform,state ORDER BY platform,state');
 const failures=await db.pool.query("SELECT count(*)::text AS count FROM pod_production_queue WHERE state IN ('blocked','qa_failed','ambiguous')");
 const storage=await db.pool.query('SELECT COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts');
 return {queues:states.rows,incident_count:failures.rows[0].count,artifact_bytes:storage.rows[0].bytes,financials:await financialTotals(db),publication_enabled:false};
}
