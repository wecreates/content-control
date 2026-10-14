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
  const claimed=claims.find(Boolean),manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)};
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
   expires_at_ms:Date.now()+60000,verdict:'PASS',...manifest,
   checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight'].map(k=>[k,true]))});
  const qa={payload,signature:crypto.createHmac('sha256',qaKey).update(payload).digest('hex')};
  assert.deepEqual(await db.completeProduction(claimed,manifest,qa),{pass:true});
  assert.ok((await db.listReady()).some(row=>row.id===job));
  await assert.rejects(db.completeProduction(claimed,manifest,qa),/LEASE_LOST/);
  const events=(await pool.query("SELECT kind,payload FROM pod_events WHERE job_id=$1",[job])).rows;
  assert.equal(events.length,1);assert.equal(events[0].kind,'pod.production.qa_passed');
  assert.equal(events[0].payload.publication_enabled,false);
  const delivery=await deliverOutbox(db,{url:'https://authority.example/events',key:'e'.repeat(32),continueOnError:true,
   fetchImpl:async(_url,options)=>new Response(JSON.stringify({accepted_event_id:options.headers['idempotency-key']}))});
  assert.equal(delivery.failed,0);assert.equal(delivery.delivered,1);
  assert.equal((await pool.query('SELECT delivered_at IS NOT NULL AS delivered FROM pod_events WHERE job_id=$1',[job])).rows[0].delivered,true);
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
  assert.deepEqual(await reconcilePublication(db,signedObservation(observed),providerKey),{published:true});
  assert.deepEqual(await reconcilePublication(db,signedObservation(observed),providerKey),{duplicate:true});
  await assert.rejects(reconcilePublication(db,signedObservation({...observed,job_id:listingJobs[1]}),providerKey),/LISTING_REPLAY_CONFLICT/);
  assert.equal((await pool.query('SELECT state FROM pod_production_queue WHERE id=$1',[listingJobs[1]])).rows[0].state,'submitted');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_events WHERE job_id=ANY($1::uuid[])',[listingJobs])).rows[0].n,1);
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
 }finally{await pool.end();}
});

