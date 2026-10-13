import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';

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
  assert.equal((await pool.query("SELECT has_table_privilege('pod_test_runtime','cyzor_social_vault','UPDATE') AS granted")).rows[0].granted,false);
  assert.deepEqual((await pool.query("SELECT envelope FROM cyzor_social_vault WHERE id='owner'")).rows[0].envelope,{preserve:true});
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
  await assert.rejects(db.completeProduction(claimed,manifest,qa),/LEASE_LOST/);
  const events=(await pool.query("SELECT kind,payload FROM pod_events WHERE job_id=$1",[job])).rows;
  assert.equal(events.length,1);assert.equal(events[0].kind,'pod.production.qa_passed');
  assert.equal(events[0].payload.publication_enabled,false);
  await assert.rejects(db.finish(claims.find(Boolean),'published'),/INVALID_FINISH/);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
  await assert.rejects(pool.query("UPDATE pod_concepts SET rights_state='PASS',permanently_unpublished=false WHERE id=$1",[concept]),/POD_PERMANENTLY_UNPUBLISHED/);
 }finally{await pool.end();}
});
