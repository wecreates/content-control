import test from 'node:test';
import assert from 'node:assert/strict';
import {productionActivity} from '../integrations/pod/capacity.mjs';
function fixture(patch={}){
 const row={window_start:'2026-10-15T00:00:00Z',window_end:'2026-10-16T00:00:00Z',
  registered_concept_records:'1000',generated_concept_records:'1000',generated_jobs:'4000',
  generated_package_hashes:'3000',jobs_with_pass_event:'1500',jobs_with_fail_event:'20',...patch};
 const queries=[],released=[];
 const db={active(){throw Error('POD_STORAGE_EXPIRING');},pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);return {rows:sql.startsWith('WITH')?[row]:[]};},release:bad=>released.push(bad)
 })}};
 return {db,queries,released};
}
test('meeting numeric targets never manufactures measured capacity or launch acceptance',async()=>{
 const f=fixture({generated_jobs:'9007199254740993'}),r=await productionActivity(f.db);
 assert.equal(r.counts.generated_jobs,'9007199254740993');assert.equal(r.counts.generated_concept_records,'1000');
 assert.equal(r.capacity_verified,false);assert.equal(r.acceptance_verified,false);assert.equal(r.publication_enabled,false);
 assert.equal(r.window.hours,24);assert.ok(r.evidence_limitations.includes('concept_records_do_not_prove_unique_artwork'));
 assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1),'COMMIT');
 assert.deepEqual(f.released,[false]);
});
test('malformed counts and observation windows fail closed',async()=>{
 for(const patch of [{generated_jobs:5},{generated_jobs:'-1'},{generated_jobs:'1e3'},
  {window_start:'invalid'},{window_end:'2026-10-17T00:00:00Z'}]){
  const f=fixture(patch);await assert.rejects(productionActivity(f.db),/CAPACITY_REPORT_INVALID/);
  assert.equal(f.queries.at(-1),'ROLLBACK');assert.deepEqual(f.released,[false]);
 }
});
test('failed rollback discards the connection and preserves the original failure',async()=>{
 const releases=[];
 const db={pool:{connect:async()=>({query:async sql=>{if(sql.startsWith('WITH'))throw Error('original');if(sql==='ROLLBACK')throw Error('rollback');return {rows:[]};},release:bad=>releases.push(bad)})}};
 await assert.rejects(productionActivity(db),/^Error: original$/);assert.deepEqual(releases,[true]);
});
test('capacity reporting discards an uncertain connection when transaction open fails',async()=>{
 const original=Error('BEGIN_FAILURE'),queries=[],releases=[];
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);throw original;},
  release:bad=>releases.push(bad),
 })}};
 await assert.rejects(productionActivity(db),error=>error===original);
 assert.deepEqual(queries,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);
 assert.deepEqual(releases,[true]);
});
test('capacity reporting discards an uncertain connection when commit fails',async()=>{
 const original=Error('COMMIT_FAILURE'),queries=[],releases=[];
 const row={window_start:'2026-10-15T00:00:00Z',window_end:'2026-10-16T00:00:00Z',
  registered_concept_records:'1',generated_concept_records:'1',generated_jobs:'1',generated_package_hashes:'1',
  jobs_with_pass_event:'1',jobs_with_fail_event:'0'};
 const db={pool:{connect:async()=>({query:async sql=>{queries.push(sql);if(sql==='COMMIT')throw original;
  return {rows:sql.startsWith('WITH')?[row]:[]};},release:bad=>releases.push(bad)})}};
 await assert.rejects(productionActivity(db),error=>error===original);
 assert.equal(queries.at(-1),'COMMIT');assert.equal(queries.includes('ROLLBACK'),false);
 assert.deepEqual(releases,[true]);
});
