import test from 'node:test';
import assert from 'node:assert/strict';
import {productionActivity} from '../integrations/pod/capacity.mjs';

// Only the workflow's disposable database, with session-local temporary tables.
// Never configure POD_TEST_DATABASE_URL with a production connection.
test('PostgreSQL activity boundaries match the returned millisecond receipt',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:process.env.POD_TEST_DATABASE_URL});
  await client.connect();
  try{
   await client.query('CREATE TEMP TABLE pod_concepts(created_at timestamptz)');
   await client.query('CREATE TEMP TABLE pod_production_queue(id uuid,concept_id uuid,platform text)');
   await client.query('CREATE TEMP TABLE pod_events(kind text,payload jsonb,job_id uuid,created_at timestamptz)');
   let remainder,released=0;
   const query=async sql=>{
    if(sql.startsWith('BEGIN ')){
     const result=await client.query(sql);
     // Temporary-table writes are permitted in this read-only transaction.
     // The included concept is exactly at the reported start; the excluded
     // event is exactly at its end. No wall-clock sleeps or real POD rows.
     await client.query(`INSERT INTO pg_temp.pod_concepts VALUES
      (date_trunc('milliseconds',transaction_timestamp())-interval '24 hours')`);
     await client.query(`INSERT INTO pg_temp.pod_production_queue VALUES
      ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','kdp')`);
     await client.query(`INSERT INTO pg_temp.pod_events VALUES
      ('pod.production.review_required',jsonb_build_object('package_sha256',repeat('a',64)),
       '10000000-0000-4000-8000-000000000001',date_trunc('milliseconds',transaction_timestamp()))`);
     return result;
    }
    if(sql.startsWith('WITH')){
     const instrumented=sql.replace('(SELECT start FROM observation_window) AS window_start,',
      `(SELECT start FROM observation_window) AS window_start,
       (SELECT (extract(microseconds FROM finish)::bigint%1000)::int FROM observation_window) AS test_remainder,`);
     assert.notEqual(instrumented,sql);
     const result=await client.query(instrumented);
     remainder=result.rows[0].test_remainder;
     return result;
    }
    return client.query(sql);
   };
   const report=await productionActivity({pool:{connect:async()=>({query,release:()=>{released++;}})}});
   assert.equal(remainder,0,'SQL must not count against a finer timestamp than the receipt');
   assert.equal(report.counts.registered_concept_records,'1','start is included');
   assert.equal(report.counts.generated_jobs,'0','end is excluded');
   assert.equal(report.capacity_verified,false);assert.equal(report.acceptance_verified,false);
   assert.equal(report.publication_enabled,false);assert.equal(released,1);
  }finally{await client.end();}
 });
