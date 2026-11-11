import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {productionActivity} from '../integrations/pod/capacity.mjs';
import {metrics} from '../integrations/pod/metrics.mjs';

// Creates/drops only its own uniquely named DB on existing local disposable CI
// PostgreSQL. Never point POD_TEST_DATABASE_URL at a production connection.
test('PostgreSQL activity windows and metrics ignore temporary/search-path aliases',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
  const url=new URL(process.env.POD_TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','postgres'].includes(url.hostname));
  assert.ok(['/pod_test','/pod_bridge_test'].includes(url.pathname));
  const {default:pg}=await import('pg');
  const name='pod_monitor_'+randomUUID().replaceAll('-','');
  assert.match(name,/^pod_monitor_[a-f0-9]{32}$/);
  const admin=new pg.Client({connectionString:url.href,connectionTimeoutMillis:5000});
  let client,created=false;
  await admin.connect();
  try{
   await admin.query(`CREATE DATABASE "${name}"`);created=true;
   url.pathname='/'+name;
   client=new pg.Client({connectionString:url.href,connectionTimeoutMillis:5000});
   await client.connect();
   await client.query('CREATE TABLE public.pod_concepts(created_at timestamptz)');
   await client.query('CREATE TABLE public.pod_production_queue(id uuid,concept_id uuid,platform text,state text,reason_code text,lease_until timestamptz)');
   await client.query('CREATE TABLE public.pod_events(kind text,payload jsonb,job_id uuid,created_at timestamptz,delivered_at timestamptz)');
   await client.query('CREATE TABLE public.pod_artifacts(body bytea)');
   await client.query('CREATE TABLE public.pod_financial_events(currency text,amount_minor bigint)');
   await client.query(`INSERT INTO public.pod_concepts VALUES ('2026-11-10T12:00:00.123Z')`);
   await client.query(`INSERT INTO public.pod_production_queue VALUES
    ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','kdp','raw',NULL,NULL)`);
   await client.query(`INSERT INTO public.pod_events VALUES
    ('pod.production.review_required',jsonb_build_object('package_sha256',repeat('a',64)),
     '10000000-0000-4000-8000-000000000001','2026-11-11T12:00:00.123Z','2026-11-11T12:00:00.123Z')`);
   await client.query(`INSERT INTO public.pod_artifacts VALUES (decode('01','hex'))`);
   await client.query(`INSERT INTO public.pod_financial_events VALUES ('USD',7)`);
   // Deliberately misleading session-local aliases, including a search_path
   // that excludes public entirely. Qualified diagnostics must still read it.
   for(const table of ['pod_concepts','pod_production_queue','pod_events','pod_artifacts','pod_financial_events'])
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table})`);
   await client.query(`INSERT INTO pg_temp.pod_concepts SELECT '2026-11-11T00:00:00Z'::timestamptz FROM generate_series(1,9)`);
   await client.query(`INSERT INTO pg_temp.pod_artifacts VALUES (decode(repeat('ff',99),'hex'))`);
   await client.query(`INSERT INTO pg_temp.pod_financial_events VALUES ('USD',999)`);
   await client.query('SET search_path=pg_temp');
   let remainder,released=0;
   const query=async sql=>{
    if(sql.startsWith('WITH')){
     // Deterministic microsecond source proves the precision defect without
     // relying on server clock timing; all window arithmetic executes in PG.
     const instrumented=sql.replaceAll('transaction_timestamp()',"TIMESTAMPTZ '2026-11-11T12:00:00.123456Z'")
      .replace('(SELECT start FROM observation_window) AS window_start,',
       `(SELECT start FROM observation_window) AS window_start,
        (SELECT (extract(microseconds FROM finish)::bigint%1000)::int FROM observation_window) AS test_remainder,`);
     const result=await client.query(instrumented);remainder=result.rows[0].test_remainder;return result;
    }
    return client.query(sql);
   };
   const db={expiresAt:Date.parse('2026-12-01T00:00:00Z'),pool:{connect:async()=>({query,release:()=>{released++;}})}};
   const report=await productionActivity(db);
   assert.equal(remainder,0);
   assert.equal(report.window.start,'2026-11-10T12:00:00.123Z');
   assert.equal(report.window.end,'2026-11-11T12:00:00.123Z');
   assert.equal(report.counts.registered_concept_records,'1','public start included; temp9 ignored');
   assert.equal(report.counts.generated_jobs,'0','public end excluded');
   assert.equal(report.capacity_verified,false);assert.equal(report.acceptance_verified,false);
   assert.equal(report.publication_enabled,false);
   const observed=await metrics(db,{clock:()=>Date.parse('2026-11-11T12:00:00Z')});
   assert.deepEqual(observed.queues,[{platform:'kdp',state:'raw',count:'1'}]);
   assert.equal(observed.artifact_bytes,'1','not shadow99');
   assert.deepEqual(observed.financials,[{currency:'USD',verified_net_recorded_minor:'7',evidence_count:'1'}]);
   assert.equal(observed.health.acceptance_verified,false);assert.equal(observed.publication_enabled,false);
   assert.equal(released,2);
  }finally{
   try{if(client)await client.end();}
   finally{try{if(created)await admin.query(`DROP DATABASE "${name}"`);}finally{await admin.end();}}
  }
 });
