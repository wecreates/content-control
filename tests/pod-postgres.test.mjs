import test from 'node:test';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {preflight} from '../scripts/pod_preflight.mjs';
import {deployDatabase} from '../scripts/pod_deploy_database.mjs';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';
import {recordMarketObservation} from '../integrations/pod/market.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {verifyStoredEvidence} from './pod-stored-evidence-postgres.mjs';
import {verifyAuthorityExpiry} from './pod-authority-expiry-postgres.mjs';
import {verifyEvidenceExpiry} from './pod-evidence-expiry-postgres.mjs';
import {verifyProductionGuard} from './pod-production-guard-postgres.mjs';
import {verifyEditorialGate} from './pod-editorial-postgres.mjs';
import {verifyFailureReasons} from './pod-failure-reasons-postgres.mjs';
import {verifyArtifactBatch} from './pod-artifact-batch-postgres.mjs';
import {verifyProductionRecovery} from './pod-production-recovery-postgres.mjs';
import {verifyOperationsListing} from './pod-operations-postgres.mjs';
import {verifyPublishClock} from './pod-publish-clock-postgres.mjs';
import {verifyProductionClock} from './pod-production-clock-postgres.mjs';
import {verifyMonitoring} from './pod-monitoring-postgres.mjs';
import {verifyCapacity} from './pod-capacity-postgres.mjs';
import {verifyConceptBudget} from './pod-concept-budget-postgres.mjs';
import {verifyKdpWeeklySubmission} from './pod-kdp-weekly-submission-postgres.mjs';

const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:
 JSON.stringify(value);

test('PostgreSQL migration isolation, artifact durability and concurrent claims',{skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL,max:4});
 const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
 const qaKey='q'.repeat(48);
 const db=new PodDB({pool,bridge,qaKey,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
 try{
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pod_test_runtime') THEN CREATE ROLE pod_test_runtime; END IF; END $$");
  await pool.query('CREATE TABLE IF NOT EXISTS cyzor_social_vault(id text PRIMARY KEY,envelope jsonb NOT NULL)');
  await pool.query(`INSERT INTO cyzor_social_vault VALUES('owner','{"preserve":true}') ON CONFLICT DO NOTHING`);
  await Promise.all([migrate(pool,'pod_test_runtime'),migrate(pool,'pod_test_runtime')]);
  const deployed=await deployDatabase({apply:true,env:{PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',
   POD_STORAGE_EXPIRES_AT:'2099-01-01T00:00:00Z',DATABASE_RUNTIME_USER:'pod_test_runtime',
   DATABASE_MIGRATION_URL:'postgresql://owner:fixture@localhost/pod_test',
   POD_DATABASE_URL:'postgresql://pod_test_runtime:fixture@localhost/pod_test'},
   connect:async()=>({connect:()=>pool.connect(),end:async()=>{}}),
   inspect:async()=>({checks:[]})});
  assert.equal(deployed.migration_requested,true);
  assert.equal(deployed.status,'BLOCKED'); // Migration alone never proves runtime readiness.
  assert.equal((await pool.query("SELECT has_table_privilege('pod_test_runtime','cyzor_social_vault','UPDATE') AS granted")).rows[0].granted,false);
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  const report=await preflight({env:{POD_DATABASE_URL:'test-injected',POD_BRIDGE_PATH:'test-bridge',
   POD_UPSTREAM_KEY:'u'.repeat(32),POD_QA_KEY:qaKey,INTERNAL_OPERATIONS_KEY:'o'.repeat(32),
   POD_STORAGE_EXPIRES_AT:new Date(Date.now()+7*86400000).toISOString()},
   readFile:async (p,encoding)=>p==='test-bridge'?JSON.stringify(bridge):(await import('node:fs/promises')).readFile(p,encoding),
   connect:async()=>({connect:async()=>{
    const c=await pool.connect();await c.query('SET ROLE pod_test_runtime');
    return {query:(...args)=>c.query(...args),release:()=>c.release(true)};
   },end:async()=>{}})});
  assert.equal(report.checks.find(c=>c.code==='DATABASE_READABLE').status,'PASS');
  assert.equal(report.checks.find(c=>c.code==='POD_TABLE_PRIVILEGES').status,'PASS');
  assert.equal(report.checks.find(c=>c.code==='SOCIAL_VAULT_ISOLATED').status,'PASS');
  assert.equal(report.checks.find(c=>c.code==='SCHEMA_CHECKSUMS').status,'PASS');
  // Disposable CI PostgreSQL has no TLS; production must still reject that configuration.
  assert.equal(report.checks.find(c=>c.code==='DATABASE_TLS').status,'BLOCKED');
  await assert.rejects(db.read("UPDATE cyzor_social_vault SET envelope='{}' WHERE id='owner'"),error=>error.code==='25006');
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.read("SELECT 1; UPDATE cyzor_social_vault SET envelope='{}' WHERE id='owner'"),error=>error.code==='42601');
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.read('/* guarded read transaction escape */ COMMIT'),/POD_TRANSACTION_CONTROL_FORBIDDEN/);
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.tx(client=>client.query("SELECT 1; UPDATE cyzor_social_vault SET envelope='{}' WHERE id='owner'")),error=>error.code==='42601');
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.tx(async client=>{
   await client.query("UPDATE cyzor_social_vault SET envelope='{}' WHERE id='owner'");
   await client.query('/* callback transaction escape */ COMMIT');
  }),/POD_TRANSACTION_CONTROL_FORBIDDEN/);
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.tx(async client=>{
   await client.query("UPDATE cyzor_social_vault SET envelope='{}' WHERE id='owner'");
   client.release();
  }),/POD_TRANSACTION_CLIENT_CONTROL_FORBIDDEN/);
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  await assert.rejects(db.tx(client=>{
   void client.query('SELECT * FROM pod_missing_unawaited_fixture').catch(()=>{});
   return 'must not commit';
  }),error=>error.code==='42P01');
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
  const sessionPool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL,max:1});
  const sessionDB=new PodDB({pool:sessionPool,bridge,qaKey,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
  try{
   const baselineSearchPath=(await sessionPool.query('SHOW search_path')).rows[0].search_path;
   await sessionDB.tx(client=>client.query("SELECT set_config('application_name','pod_transaction_poison',false)"));
   assert.notEqual((await sessionPool.query("SELECT current_setting('application_name') AS value")).rows[0].value,'pod_transaction_poison');
   await sessionDB.read("SELECT set_config('application_name','pod_read_poison',false)");
   assert.notEqual((await sessionPool.query("SELECT current_setting('application_name') AS value")).rows[0].value,'pod_read_poison');
   assert.equal((await sessionPool.query('SHOW search_path')).rows[0].search_path,baselineSearchPath);
  }finally{await sessionPool.end();}
  await verifyMonitoring(pool,bridge);
  await verifyCapacity(pool);
  await verifyConceptBudget(pool,bridge);
  await verifyKdpWeeklySubmission(pool,bridge,qaKey);
  const store=new ArtifactStore(db,{budgetBytes:100});const content=Buffer.from('durable bytes');
  const hash=await store.put(content,'application/json');assert.deepEqual((await store.get(hash)).body,content);
  assert.equal(await store.put(content,'application/json'),hash);
  await assert.rejects(store.put(Buffer.alloc(101),'image/png'),/ARTIFACT_BUDGET_EXHAUSTED/);
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),job=crypto.randomUUID();
  await pool.query("INSERT INTO pod_concepts VALUES($1,'business',$2,'PASS',false,now())",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',10)",[account]);
  await pool.query("INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key) VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4)",[job,concept,account,crypto.randomUUID()]);
  const claims=await Promise.all([db.claimProduction(),db.claimProduction()]);
  assert.equal(claims.filter(Boolean).length,1);assert.equal(claims.find(Boolean).id,job);
  const claimed=claims.find(Boolean),manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
   package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),files:{
    'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
   expires_at_ms:Date.now()+60000,verdict:'PASS',...manifest,
   checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details'].map(k=>[k,true]))});
  const qa={payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')};
  assert.deepEqual(await db.completeProduction(claimed,manifest,qa),{pass:true});
  await verifyProductionRecovery(pool,bridge);
  await verifyOperationsListing(pool,db);
  await verifyPublishClock(pool,bridge,qaKey);
  await verifyProductionClock(pool,bridge);
  // Real row-lock waits must not let a transaction-start clock authorize a
  // production write after expiry. A database barrier avoids timing guesses.
  const leaseConcept=crypto.randomUUID(),leaseAccount=crypto.randomUUID();
  await pool.query("INSERT INTO pod_concepts VALUES($1,'lease-fixture',$2,'PASS',false,now())",[leaseConcept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[leaseAccount]);
  // A signed QA decision must not promote a review row whose durable hold
  // event is absent or names different manifest bytes.
  for(const [index,eventIdentity] of [null,'f'.repeat(64)].entries()){
   const reviewJob=crypto.randomUUID();
   await pool.query(`INSERT INTO pod_production_queue
    (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest,reason_code)
    VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,'qa_failed',$6,'REVIEW_REQUIRED')`,
    [reviewJob,leaseConcept,leaseAccount,index+20,crypto.randomUUID(),manifest]);
   if(eventIdentity)await pool.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',
    [crypto.randomUUID(),reviewJob,'pod.production.review_required',
     {package_sha256:manifest.package_sha256,manifest_sha256:eventIdentity,publication_enabled:false}]);
   await assert.rejects(db.acceptReview(reviewJob,qa),/PACKAGE_UNAVAILABLE/);
   assert.deepEqual((await pool.query('SELECT state,reason_code,qa_envelope FROM pod_production_queue WHERE id=$1',[reviewJob])).rows[0],
    {state:'qa_failed',reason_code:'REVIEW_REQUIRED',qa_envelope:null});
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.production.qa_passed'",[reviewJob])).rows[0].n,0);
   await pool.query('DELETE FROM pod_events WHERE job_id=$1',[reviewJob]);
   await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[reviewJob]);
  }
  const failedPayload=JSON.stringify({...JSON.parse(payload),verdict:'FAIL'});
  const failedQA={payload:failedPayload,signature:crypto.createHmac('sha256',qaKey).update(failedPayload).digest('hex')};
  for(const [index,action] of [
   (target,j)=>target.failProduction(j,'FIXTURE_FAILURE'),
   (target,j)=>target.holdProduction(j,manifest),
   (target,j)=>target.completeProduction(j,manifest,qa),
   (target,j)=>target.completeProduction(j,manifest,failedQA)
  ].entries()){
   const leaseJob={id:crypto.randomUUID(),fencing_token:1,platform:'redbubble'};
   await pool.query(`INSERT INTO pod_production_queue
    (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,fencing_token,lease_until)
    VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,'processing',1,clock_timestamp()+interval '1 minute')`,
    [leaseJob.id,leaseConcept,leaseAccount,index+1,crypto.randomUUID()]);
   const blocker=await pool.connect();let pending,workerPid;
   const waitingDB=new PodDB({pool:{connect:async()=>{
    const client=await pool.connect();workerPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return client;
   }},bridge,qaKey,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
   try{
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM pod_production_queue WHERE id=$1 FOR UPDATE',[leaseJob.id]);
    pending=action(waitingDB,leaseJob).then(value=>({value}),error=>({error}));
    let waiting=false;
    for(let attempt=0;attempt<100;attempt++){
     if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
     if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'production write reached the held row lock');
    await blocker.query("UPDATE pod_production_queue SET lease_until=clock_timestamp()+interval '50 milliseconds' WHERE id=$1",[leaseJob.id]);
    await blocker.query('SELECT pg_sleep(0.15)');await blocker.query('COMMIT');
    const outcome=await pending;assert.equal(outcome.error?.message,'LEASE_LOST');
    const unchanged=(await pool.query('SELECT state,manifest,qa_envelope,fencing_token,reason_code FROM pod_production_queue WHERE id=$1',[leaseJob.id])).rows[0];
    assert.deepEqual(unchanged,{state:'processing',manifest:null,qa_envelope:null,fencing_token:'1',reason_code:null});
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1',[leaseJob.id])).rows[0].n,0);
    await db.recover();
    await assert.rejects(action(db,leaseJob),/LEASE_LOST/);
    assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[leaseJob.id])).rows[0].state,'blocked');
    // Remove only this disposable case so later e2e metrics are not polluted
    // by deliberately expired leases from an earlier workflow step.
    await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[leaseJob.id]);
   }finally{await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;}
  }
  // A signed QA envelope must remain current after waiting for the rights row,
  // even when the worker lease remains valid. Advance only the application clock
  // once PostgreSQL confirms the wait; do not depend on short real-time sleeps.
  for(const [index,review] of [true,false].entries()){
   const qaJob={id:crypto.randomUUID(),fencing_token:1,platform:'redbubble'};
   const state=review?'qa_failed':'processing',reason=review?'REVIEW_REQUIRED':null;
   await pool.query(`INSERT INTO pod_production_queue
    (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,fencing_token,lease_until,manifest,reason_code)
    VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,$6,1,clock_timestamp()+interval '1 minute',$7,$8)`,
    [qaJob.id,leaseConcept,leaseAccount,index+5,crypto.randomUUID(),state,manifest,reason]);
   if(review)await pool.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4)',
    [crypto.randomUUID(),qaJob.id,'pod.production.review_required',
     {package_sha256:manifest.package_sha256,
      manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex'),publication_enabled:false}]);
   const blocker=await pool.connect(),originalNow=Date.now,issued=originalNow();let now=issued,pending,workerPid;
   Date.now=()=>now;
   const shortPayload=JSON.stringify({...JSON.parse(payload),issued_at_ms:issued-1,expires_at_ms:issued+1000});
   const shortQA={payload:shortPayload,signature:crypto.createHmac('sha256',qaKey).update(shortPayload).digest('hex')};
   const waitingDB=new PodDB({pool:{connect:async()=>{
    const client=await pool.connect();workerPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return client;
   }},bridge,qaKey,expiresAt:new Date(issued+7*86400000).toISOString()});
   try{
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM pod_concepts WHERE id=$1 FOR UPDATE',[leaseConcept]);
    pending=(review?waitingDB.acceptReview(qaJob.id,shortQA):waitingDB.completeProduction(qaJob,manifest,shortQA))
     .then(value=>({value}),error=>({error}));
    let waiting=false;
    for(let attempt=0;attempt<100;attempt++){
     if(workerPid)waiting=(await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting',[workerPid])).rows[0].waiting;
     if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'QA acceptance reached the held rights lock');
    now=issued+1000;await blocker.query('COMMIT');
    assert.equal((await pending).error?.message,'ENVELOPE_EXPIRED_OR_INVALID');
    const unchanged=(await pool.query('SELECT state,manifest,qa_envelope,reason_code FROM pod_production_queue WHERE id=$1',[qaJob.id])).rows[0];
    assert.deepEqual(unchanged,{state,manifest,qa_envelope:null,reason_code:reason});
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1',[qaJob.id])).rows[0].n,review?1:0);
    await pool.query('DELETE FROM pod_events WHERE job_id=$1',[qaJob.id]);
    await pool.query('DELETE FROM pod_production_queue WHERE id=$1',[qaJob.id]);
   }finally{Date.now=originalNow;await blocker.query('ROLLBACK');blocker.release();if(pending)await pending;}
  }
  assert.ok((await db.listReady()).some(row=>row.id===job));
  await assert.rejects(db.completeProduction(claimed,manifest,qa),/LEASE_LOST/);
  const events=(await pool.query("SELECT kind,payload FROM pod_events WHERE job_id=$1",[job])).rows;
  assert.equal(events.length,1);assert.equal(events[0].kind,'pod.production.qa_passed');
  assert.equal(events[0].payload.publication_enabled,false);
  const delivery=await deliverOutbox(db,{url:'https://authority.example/events',key:'e'.repeat(32),continueOnError:true,
   fetchImpl:async(_url,options)=>new Response(JSON.stringify({accepted_event_id:options.headers['idempotency-key']}),
    {headers:{'content-type':'application/json'}})});
  assert.equal(delivery.failed,0);assert.equal(delivery.delivered,1);
  assert.equal((await pool.query('SELECT delivered_at IS NOT NULL AS delivered FROM pod_events WHERE job_id=$1',[job])).rows[0].delivered,true);
  // pg's default timestamptz parser drops microseconds. Twenty rejected rows
  // sharing an instant must not trap the cursor ahead of later pending events.
  const pageIds=Array.from({length:45},()=>crypto.randomUUID());
  await pool.query(`INSERT INTO pod_events(id,kind,payload,created_at)
   SELECT id,'pod.test.pagination','{}',CASE WHEN n<=40
    THEN '2026-01-01T00:00:00.000123Z'::timestamptz
    ELSE '2026-01-01T00:00:00.000456Z'::timestamptz END
   FROM unnest($1::uuid[]) WITH ORDINALITY AS fixture(id,n)`,[pageIds]);
  const ordered=(await pool.query('SELECT id,created_at::text AS stamp FROM pod_events WHERE id=ANY($1::uuid[]) ORDER BY created_at,id',[pageIds])).rows;
  const rejected=new Set(ordered.slice(0,20).map(row=>row.id)),pageObserved=[];
  const deliveryOptions={url:'https://authority.example/events',key:'e'.repeat(32),continueOnError:true,
   fetchImpl:async(_url,options)=>{
    const event=JSON.parse(JSON.parse(options.body).payload).event;pageObserved.push(event.id);
    assert.equal(Object.hasOwn(event,'cursor_created_at'),false);
    return rejected.has(event.id)?new Response('',{status:503}):new Response(JSON.stringify({accepted_event_id:event.id}),
     {headers:{'content-type':'application/json'}});
   }};
  const firstPage=await deliverOutbox(db,deliveryOptions);
  assert.equal(firstPage.failed,20);assert.equal(firstPage.delivered,0);
  assert.deepEqual(firstPage.nextCursor,{id:ordered[19].id,created_at:ordered[19].stamp});
  const secondPage=await deliverOutbox(db,{...deliveryOptions,cursor:firstPage.nextCursor});
  assert.equal(secondPage.delivered,20);assert.equal(secondPage.failed,0);
  const thirdPage=await deliverOutbox(db,{...deliveryOptions,cursor:secondPage.nextCursor});
  assert.equal(thirdPage.delivered,5);assert.equal(thirdPage.failed,0);assert.equal(thirdPage.nextCursor,null);
  assert.deepEqual(pageObserved,ordered.map(row=>row.id));
  const wrappedPage=await deliverOutbox(db,{...deliveryOptions,cursor:thirdPage.nextCursor});
  assert.equal(wrappedPage.failed,20);assert.equal(wrappedPage.delivered,0);
  assert.deepEqual(pageObserved.slice(45),ordered.slice(0,20).map(row=>row.id));
  const pending=(await pool.query('SELECT id FROM pod_events WHERE id=ANY($1::uuid[]) AND delivered_at IS NULL',[pageIds])).rows;
  assert.deepEqual(new Set(pending.map(row=>row.id)),rejected);
  await pool.query('DELETE FROM pod_events WHERE id=ANY($1::uuid[])',[pageIds]);
  await assert.rejects(db.finish(claims.find(Boolean),'published'),/INVALID_FINISH/);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
  assert.ok(!(await db.listReady()).some(row=>row.id===job));
  await pool.query("UPDATE pod_production_queue SET state='processing',lease_until=now()+interval '5 minutes' WHERE id=$1",[job]);
  await assert.rejects(db.completeProduction(claimed,manifest,qa),/RIGHTS_BLOCKED/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[job])).rows[0].state,'processing');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1',[job])).rows[0].n,1);
  await pool.query("UPDATE pod_production_queue SET state='qa_failed',reason_code='REVIEW_REQUIRED' WHERE id=$1",[job]);
  await assert.rejects(db.acceptReview(job,qa),/REVIEW_NOT_PENDING/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[job])).rows[0].state,'qa_failed');
  await assert.rejects(pool.query("UPDATE pod_concepts SET rights_state='PASS',permanently_unpublished=false WHERE id=$1",[concept]),/POD_PERMANENTLY_UNPUBLISHED/);
  // Synthetic provider observations test database reconciliation only. They are
  // not actual listings, provider authorization, or production acceptance.
  const listingJobs=[crypto.randomUUID(),crypto.randomUUID()],providerKey='provider-test-'.repeat(4);
  for(const [index,id] of listingJobs.entries())await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
   VALUES($1,$2,$3,'redbubble',$4,'{}','{}',$5,'submitted',$6)`,[id,concept,account,index+2,crypto.randomUUID(),manifest]);
  const observed={job_id:listingJobs[0],account_id:account,platform:'redbubble',provider_id:'fixture-listing',provider_event_id:crypto.randomUUID(),
   package_sha256:manifest.package_sha256,evidence_sha256:hash,status:'LIVE',provider_verified:true};
  const signedObservation=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:listing-observation',
   issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
   return {payload,signature:crypto.createHmac('sha256',providerKey).update(payload).digest('hex')};};
  await assert.rejects(reconcilePublication(db,signedObservation({...observed,private_token:'must-not-persist'}),providerKey),/LISTING_EVIDENCE_REQUIRED/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[listingJobs[0]])).rows[0].state,'submitted');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE provider_event_id=$1',[observed.provider_event_id])).rows[0].n,0);
  assert.deepEqual(await reconcilePublication(db,signedObservation(observed),providerKey),{published:true});
  assert.deepEqual(await reconcilePublication(db,signedObservation(observed),providerKey),{duplicate:true});
  await assert.rejects(reconcilePublication(db,signedObservation({...observed,job_id:listingJobs[1]}),providerKey),/LISTING_REPLAY_CONFLICT/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[listingJobs[1]])).rows[0].state,'submitted');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=ANY($1::uuid[])',[listingJobs])).rows[0].n,1);
  const malformedPublished=crypto.randomUUID(),malformedEvent=crypto.randomUUID();
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
   VALUES($1,$2,$3,'redbubble',5,'{}','{}',$4,'published',$5)`,[malformedPublished,concept,account,crypto.randomUUID(),manifest]);
  await assert.rejects(reconcilePublication(db,signedObservation({...observed,job_id:malformedPublished,
   provider_id:'missing-durable-provider-id',provider_event_id:malformedEvent}),providerKey),/LISTING_SCOPE_INVALID/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE provider_event_id=$1',[malformedEvent])).rows[0].n,0);
  // Distinct provider observations retain each proof but emit one state transition.
  const readbacks=Array.from({length:4},()=>({...observed,provider_event_id:crypto.randomUUID()}));
  const repeated=await Promise.all(readbacks.map(o=>reconcilePublication(db,signedObservation(o),providerKey)));
  assert.ok(repeated.every(r=>r.published&&r.already_published));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.published'",[listingJobs[0]])).rows[0].n,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE account_id=$1',[account])).rows[0].n,5);
  const reassigned={...observed,job_id:listingJobs[1],provider_event_id:crypto.randomUUID()};
  await assert.rejects(reconcilePublication(db,signedObservation(reassigned),providerKey),error=>error.code==='23505');
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[listingJobs[1]])).rows[0].state,'submitted');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE provider_event_id=$1',[reassigned.provider_event_id])).rows[0].n,0);
  // Different jobs racing to claim one listing: the losing inbox insert rolls back.
  const raceJob=crypto.randomUUID();
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
   VALUES($1,$2,$3,'redbubble',4,'{}','{}',$4,'submitted',$5)`,[raceJob,concept,account,crypto.randomUUID(),manifest]);
  const racing=[listingJobs[1],raceJob].map(id=>({...observed,job_id:id,provider_id:'fixture-race-listing',provider_event_id:crypto.randomUUID()}));
  const races=await Promise.allSettled(racing.map(o=>reconcilePublication(db,signedObservation(o),providerKey)));
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(races.filter(r=>r.status==='rejected'&&r.reason.code==='23505').length,1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=ANY($1::uuid[]) AND kind='pod.published'",[[listingJobs[1],raceJob]])).rows[0].n,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_provider_inbox WHERE provider_event_id=ANY($1::text[])',[racing.map(o=>o.provider_event_id)])).rows[0].n,1);
  // Provider IDs are account-scoped, not a global text blacklist.
  const otherAccount=crypto.randomUUID(),otherJob=crypto.randomUUID();
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[otherAccount]);
  await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,manifest)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'submitted',$5)`,[otherJob,concept,otherAccount,crypto.randomUUID(),manifest]);
  assert.deepEqual(await reconcilePublication(db,signedObservation({...observed,job_id:otherJob,account_id:otherAccount}),providerKey),{published:true});
  // Re-screening an existing concept must atomically revoke its readiness, keep
  // the unique-concept budget unchanged and emit one durable denial event.
  const intakeKey='intake-test-key-'.repeat(4),business=crypto.randomUUID(),fingerprint=crypto.randomUUID(),canonicalId=crypto.randomUUID();
  const intake=(state,id=canonicalId,businessId=business)=>{
   const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',issued_at_ms:Date.now()-1,
    expires_at_ms:Date.now()+60000,concept_id:id,business_id:businessId,fingerprint,rights_state:state});
   return {id,businessId,intakeKey,envelope:{payload,signature:crypto.createHmac('sha256',intakeKey).update(payload).digest('hex')}};
  };
  await db.registerIntake(intake('PASS'));
  const readyId=crypto.randomUUID();
  await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'qa_passed')`,[readyId,canonicalId,account,crypto.randomUUID()]);
  assert.ok((await db.listReady()).some(row=>row.id===readyId));
  await Promise.all(Array.from({length:4},()=>db.registerIntake(intake('UNKNOWN',crypto.randomUUID()))));
  assert.deepEqual((await pool.query('SELECT rights_state,permanently_unpublished FROM pod_concepts WHERE id=$1',[canonicalId])).rows[0],
   {rights_state:'UNKNOWN',permanently_unpublished:true});
  assert.ok(!(await db.listReady()).some(row=>row.id===readyId));
  assert.equal(await db.claimPublish(account,45),null);
  assert.deepEqual(await db.registerIntake(intake('PASS',crypto.randomUUID())),{id:canonicalId});
  assert.deepEqual(await db.registerIntake(intake('FAIL',crypto.randomUUID())),{id:canonicalId});
  await assert.rejects(db.registerIntake(intake('UNKNOWN',crypto.randomUUID(),'different-business')),/INTAKE_FINGERPRINT_CONFLICT/);
  assert.equal((await pool.query('SELECT used FROM pod_daily_concept_budget WHERE business_id=$1',[business])).rows[0].used,1);
  const denied=(await pool.query("SELECT payload FROM pod_events WHERE kind='pod.concept.rights_blocked' AND payload->>'concept_id'=$1",[canonicalId])).rows;
  assert.equal(denied.length,1);assert.equal(denied[0].payload.rights_state,'UNKNOWN');
  assert.equal(denied[0].payload.publication_enabled,false);assert.match(denied[0].payload.intake_sha256,/^[a-f0-9]{64}$/);
  await verifyAuthorityExpiry(pool,bridge);
  await verifyProductionGuard(pool,bridge);
  await verifyEditorialGate(pool,bridge);
  await verifyFailureReasons(pool,bridge);
  await verifyArtifactBatch(pool,db);
  await verifyStoredEvidence(pool,db);
  await verifyEvidenceExpiry(pool,bridge,hash);
  // Synthetic permitted-source fixtures exercise durability and contention,
  // not actual marketplace trends, rank claims or source authorization.
  const marketStore=new ArtifactStore(db),marketKey='synthetic-market-key-'.repeat(3);
  const proofs=await Promise.all(['source','image','rank'].map(kind=>marketStore.put(Buffer.from(JSON.stringify({fixture:kind,id:crypto.randomUUID()})),'application/json')));
  const observation={platform:'redbubble',source_url:`https://example.org/fixture/${crypto.randomUUID()}`,
   country:'US',category:'shirt',observed_at:new Date().toISOString(),collection_authorized:true,
   source_sha256:proofs[0],image_sha256:proofs[1],rank_evidence_sha256:proofs[2],
   observed_rank:2,price_minor:1200,currency:'USD',observations:{tags:['synthetic'],layout:{color:'blue'}}};
  const signedMarket=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:market',
   issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
   return {payload,signature:crypto.createHmac('sha256',marketKey).update(payload).digest('hex')};};
  const observations=await Promise.all(Array.from({length:4},()=>recordMarketObservation(db,signedMarket(observation),marketKey)));
  assert.equal(observations.filter(r=>r.inserted).length,1);
  assert.equal(new Set(observations.map(r=>r.id)).size,1);
  const marketId=observations[0].id;
  assert.equal((await pool.query('SELECT rank_evidence_sha256 FROM pod_market_intelligence WHERE id=$1',[marketId])).rows[0].rank_evidence_sha256,proofs[2]);
  for(const change of [{price_minor:999},{country:'CA'},{rank_evidence_sha256:proofs[0]},{observations:{tags:['changed']}}]){
   await assert.rejects(recordMarketObservation(db,signedMarket({...observation,...change}),marketKey),/MARKET_REPLAY_CONFLICT/);
  }
  await assert.rejects(recordMarketObservation(db,signedMarket({...observation,source_sha256:'f'.repeat(64)}),marketKey),/MARKET_EVIDENCE_MISSING/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_market_intelligence WHERE source_url=$1',[observation.source_url])).rows[0].n,1);
  await assert.rejects(pool.query("UPDATE pod_market_intelligence SET observed_rank=1 WHERE id=$1",[marketId]),/POD_APPEND_ONLY/);
  await assert.rejects(pool.query('DELETE FROM pod_market_intelligence WHERE id=$1',[marketId]),/POD_APPEND_ONLY/);
  // Re-applying all checksum-guarded migrations preserves the immutable record.
  await migrate(pool,'pod_test_runtime');
  assert.equal((await pool.query('SELECT observed_rank FROM pod_market_intelligence WHERE id=$1',[marketId])).rows[0].observed_rank,2);
  // Final local release checks use current durable state after remote waits.
  // No real publishing is enabled and no adapter is called by this database test.
  const releaseConcept=crypto.randomUUID(),releaseAccount=crypto.randomUUID(),releaseJob=crypto.randomUUID();
  await pool.query("INSERT INTO pod_concepts VALUES($1,'release-fixture',$2,'PASS',false,now())",[releaseConcept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',1)",[releaseAccount]);
  const releaseManifestIdentity=crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
  const releaseClaim=(await pool.query(`INSERT INTO pod_production_queue
   (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,fencing_token,lease_until,manifest,qa_envelope)
   VALUES($1,$2,$3,'redbubble',1,'{}','{}',$4,'publishing',1,now()+interval '5 minutes',$5,$6) RETURNING *`,
   [releaseJob,releaseConcept,releaseAccount,crypto.randomUUID(),manifest,qa])).rows[0];
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,'pod.production.qa_passed',$3)",
   [crypto.randomUUID(),releaseJob,{manifest_sha256:releaseManifestIdentity,publication_enabled:false}]);
  assert.equal(await db.assertPublishable(releaseClaim),true);
  const changedQaPayload=JSON.stringify({...JSON.parse(qa.payload),issued_at_ms:Date.now()-2});
  const changedQa={payload:changedQaPayload,signature:crypto.createHmac('sha256',qaKey).update(changedQaPayload).digest('hex')};
  await pool.query('UPDATE pod_production_queue SET qa_envelope=$2 WHERE id=$1',[releaseJob,changedQa]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  await pool.query('UPDATE pod_production_queue SET qa_envelope=$2 WHERE id=$1',[releaseJob,qa]);
  const changedReleaseManifest={...manifest,files:{...manifest.files,'print.png':'f'.repeat(64)}};
  const changedReleaseIdentity=crypto.createHash('sha256').update(canonical(changedReleaseManifest)).digest('hex');
  await pool.query('UPDATE pod_production_queue SET manifest=$2 WHERE id=$1',[releaseJob,changedReleaseManifest]);
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload,created_at) VALUES($1,$2,'pod.production.qa_passed',$3,clock_timestamp()+interval '1 second')",
   [crypto.randomUUID(),releaseJob,{manifest_sha256:changedReleaseIdentity,publication_enabled:false}]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  await pool.query('UPDATE pod_production_queue SET manifest=$2 WHERE id=$1',[releaseJob,manifest]);
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload,created_at) VALUES($1,$2,'pod.production.qa_passed',$3,clock_timestamp()+interval '2 seconds')",
   [crypto.randomUUID(),releaseJob,{manifest_sha256:releaseManifestIdentity,publication_enabled:false}]);
  assert.equal(await db.assertPublishable(releaseClaim),true);
  for(const change of [{fencing_token:'2'},{account_id:account},{platform:'kdp'}]){
   await assert.rejects(db.assertPublishable({...releaseClaim,...change}),/LOCAL_RELEASE_BLOCKED/);
  }
  await pool.query("UPDATE pod_accounts SET state='DISABLED' WHERE id=$1",[releaseAccount]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  await pool.query("UPDATE pod_accounts SET state='ACTIVE' WHERE id=$1",[releaseAccount]);
  await pool.query("UPDATE pod_production_queue SET state='ambiguous' WHERE id=$1",[releaseJob]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  await pool.query("UPDATE pod_production_queue SET state='publishing',lease_until=now()-interval '1 second' WHERE id=$1",[releaseJob]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  await assert.rejects(db.finish(releaseClaim,'submitted',{id:'stale-provider-listing'}),/LEASE_LOST/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[releaseJob])).rows[0].state,'publishing');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.submitted'",[releaseJob])).rows[0].n,0);
  await pool.query("UPDATE pod_production_queue SET lease_until=now()+interval '5 minutes' WHERE id=$1",[releaseJob]);
  assert.equal(await db.assertPublishable(releaseClaim),true);
  await assert.rejects(db.finish(releaseClaim,'submitted',{id:'provider-listing',private_token:'must-not-persist'}),/RECEIPT_INVALID/);
  await assert.rejects(db.finish(releaseClaim,'blocked',{},'postgres://private:secret@host/db'),/SETTLEMENT_INVALID/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[releaseJob])).rows[0].state,'publishing');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind LIKE 'pod.%'",[releaseJob])).rows[0].n,0);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[releaseConcept]);
  await assert.rejects(db.assertPublishable(releaseClaim),/LOCAL_RELEASE_BLOCKED/);
  // Synthetic ledger evidence verifies replay accounting only, never real income.
  const financeKey='synthetic-finance-key-'.repeat(3);
  const financial={verified:true,job_id:releaseJob,provider:'redbubble',provider_event_id:crypto.randomUUID(),
   authority_event_id:crypto.randomUUID(),kind:'royalty',amount_minor:1234,currency:'USD',
   occurred_at:'2026-01-01T00:00:00.123456Z',evidence_sha256:proofs[0]};
  const signedFinancial=value=>{const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:finance',
   issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
   return {payload,signature:crypto.createHmac('sha256',financeKey).update(payload).digest('hex')};};
  const receipts=await Promise.all(Array.from({length:4},()=>recordFinancialEvent(db,signedFinancial(financial),financeKey)));
  assert.equal(receipts.filter(r=>!r.duplicate).length,1);assert.equal(new Set(receipts.map(r=>r.id)).size,1);
  // The pg Date decoder truncates microseconds; replay identity must not.
  assert.deepEqual(await recordFinancialEvent(db,signedFinancial({...financial,occurred_at:'2025-12-31T19:00:00.123456-05:00'}),financeKey),{id:receipts[0].id,duplicate:true});
  for(const occurred_at of ['2026-01-01T00:00:00.123457Z','2026-01-01T00:00:00.123Z']){
   await assert.rejects(recordFinancialEvent(db,signedFinancial({...financial,occurred_at}),financeKey),/FINANCIAL_REPLAY_CONFLICT/);
  }
  const storedOccurrence=(await pool.query("SELECT to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') AS precise FROM pod_financial_events WHERE id=$1",[receipts[0].id])).rows[0].precise;
  assert.equal(storedOccurrence,'2026-01-01 00:00:00.123456');
  const reattributions=await Promise.allSettled(Array.from({length:4},()=>recordFinancialEvent(db,
   signedFinancial({...financial,provider_event_id:crypto.randomUUID()}),financeKey)));
  assert.ok(reattributions.every(r=>r.status==='rejected'&&r.reason.message==='FINANCIAL_REPLAY_CONFLICT'));
  for(const change of [{provider:'teepublic',provider_event_id:crypto.randomUUID()},
   {authority_event_id:crypto.randomUUID()},{job_id:job,provider_event_id:crypto.randomUUID()}]){
   await assert.rejects(recordFinancialEvent(db,signedFinancial({...financial,...change}),financeKey),/FINANCIAL_REPLAY_CONFLICT/);
  }
  const fee={...financial,provider_event_id:crypto.randomUUID(),authority_event_id:crypto.randomUUID(),kind:'fee',amount_minor:-234};
  await recordFinancialEvent(db,signedFinancial(fee),financeKey);
  const total=(await pool.query('SELECT count(*)::int AS n,sum(amount_minor)::text AS total FROM pod_financial_events WHERE job_id=$1',[releaseJob])).rows[0];
  assert.deepEqual(total,{n:2,total:'1000'});
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pod_events WHERE job_id=$1 AND kind='pod.finance.verified'",[releaseJob])).rows[0].n,2);
  await assert.rejects(pool.query('UPDATE pod_financial_events SET amount_minor=99999 WHERE id=$1',[receipts[0].id]),/POD_APPEND_ONLY/);
  // A legacy duplicate set must cause the additive index migration to fail,
  // not silently discard history. Use a temporary table, never production data.
  const historical=await pool.connect();
  try{
   await historical.query('BEGIN');
   await historical.query('CREATE TEMP TABLE pod_financial_events(authority_event_id text) ON COMMIT DROP');
   await historical.query("INSERT INTO pod_financial_events VALUES('same-fixture'),('same-fixture')");
   const sql=await (await import('node:fs/promises')).readFile(new URL('../migrations/004_pod.sql',import.meta.url),'utf8');
   await assert.rejects(historical.query(sql),error=>error.code==='23505');
  }finally{await historical.query('ROLLBACK');historical.release();}
  const legacyListings=await pool.connect();
  try{
   await legacyListings.query('BEGIN');
   await legacyListings.query('CREATE TEMP TABLE pod_production_queue(platform text,account_id uuid,provider_id text) ON COMMIT DROP');
   await legacyListings.query("INSERT INTO pod_production_queue VALUES('redbubble',$1,'duplicate'),('redbubble',$1,'duplicate')",[account]);
   const sql=await (await import('node:fs/promises')).readFile(new URL('../migrations/005_pod.sql',import.meta.url),'utf8');
   await assert.rejects(legacyListings.query(sql),error=>error.code==='23505');
  }finally{await legacyListings.query('ROLLBACK');legacyListings.release();}
 }finally{await pool.end();}
});




