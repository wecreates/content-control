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
 const db=new PodDB({pool,bridge,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
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
  await db.failProduction(claims.find(Boolean),'TEST');
  await assert.rejects(db.finish(claims.find(Boolean),'published'),/INVALID_FINISH/);
  await pool.query("UPDATE pod_concepts SET rights_state='UNKNOWN',permanently_unpublished=true WHERE id=$1",[concept]);
  await assert.rejects(pool.query("UPDATE pod_concepts SET rights_state='PASS',permanently_unpublished=false WHERE id=$1",[concept]),/POD_PERMANENTLY_UNPUBLISHED/);
 }finally{await pool.end();}
});
