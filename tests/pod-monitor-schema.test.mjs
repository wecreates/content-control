import test from 'node:test';
import assert from 'node:assert/strict';
import {productionActivity} from '../integrations/pod/capacity.mjs';
import {metrics} from '../integrations/pod/metrics.mjs';

for(const kind of ['activity','metrics'])test(kind+' diagnostics bind all POD reads to public tables',async()=>{
 const queries=[];
 const row={window_start:'2026-11-10T00:00:00Z',window_end:'2026-11-11T00:00:00Z',
  registered_concept_records:'0',generated_concept_records:'0',generated_jobs:'0',
  generated_package_hashes:'0',jobs_with_pass_event:'0',jobs_with_fail_event:'0'};
 const db={expiresAt:Date.parse('2026-12-01T00:00:00Z'),pool:{connect:async()=>({
  release(){},query:async sql=>{
   queries.push(sql);
   if(sql.startsWith('BEGIN '))return {command:'BEGIN'};
   if(sql==='COMMIT')return {command:'COMMIT'};
   if(sql==='ROLLBACK')return {command:'ROLLBACK'};
   if(sql.startsWith('WITH'))return {rows:[row]};
   if(sql.includes('GROUP BY'))return {rows:[]};
   if(sql.includes('pod_artifacts'))return {rows:[{bytes:'0'}]};
   if(sql.includes('AS unverified_count'))return {rows:[{count:'0',unverified_count:'0'}]};
   if(sql.includes('pod_events'))return {rows:[{count:'0',oldest_seconds:'0'}]};
   return {rows:sql.startsWith('SELECT')?[{count:'0'}]:[]};
  }
 })}};
 const report=kind==='activity'?await productionActivity(db):await metrics(db,{clock:()=>Date.parse('2026-11-11T00:00:00Z')});
 assert.equal(report.publication_enabled,false);
 const tables=queries.flatMap(sql=>[...sql.matchAll(/\b(?:FROM|JOIN)\s+((?:public\.)?pod_[a-z_]+)/g)].map(match=>match[1]));
 assert.ok(tables.length>=3);
 assert.deepEqual(tables.filter(table=>!table.startsWith('public.')),[],'temporary/search-path aliases must not redirect reads');
});
