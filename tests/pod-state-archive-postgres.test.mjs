import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {exportStateArchive,verifyStateArchive,restoreStateArchive} from '../integrations/pod/state-archive.mjs';
import {unseal} from '../integrations/pod/archive-codec.mjs';

test('POD state snapshot restores all ten tables atomically under restricted roles',
 {skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.POD_TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/pod_test')throw Error('DISPOSABLE_TEST_DATABASE_REQUIRED');
 const owner=new pg.Pool({connectionString:url.toString(),max:1});
 const token=crypto.randomUUID().replaceAll('-',''),role='pod_state_'+token;
 const names=['pod_state_source_'+token,'pod_state_target_'+token],pools=[],created=[];
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-state-pg-')),directory=path.join(root,'snapshot');
 const key=Buffer.alloc(32,27),env={PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false',POD_PRODUCTION_ENABLED:'false',POD_OUTBOX_ENABLED:'false'};
 const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
 const restricted=pool=>({connect:async()=>{const c=await pool.connect();try{await c.query(`SET ROLE "${role}"`);}catch(e){c.release(true);throw e;}
  return {query:(...args)=>c.query(...args),release:()=>c.release(true)};}});
 const dbFor=pool=>new PodDB({pool:restricted(pool),bridge,expiresAt:'2099-01-01T00:00:00Z'});
 let roleCreated=false;
 try{
  await owner.query(`CREATE ROLE "${role}" NOLOGIN`);roleCreated=true;
  for(const name of names){
   await owner.query(`CREATE DATABASE "${name}" TEMPLATE template0`);created.push(name);
   const destination=new URL(url);destination.pathname='/'+name;
   const pool=new pg.Pool({connectionString:destination.toString(),max:3});pools.push(pool);await migrate(pool,role);
  }
  const [sourcePool,targetPool]=pools,source=dbFor(sourcePool),target=dbFor(targetPool);
  const proof=await new ArtifactStore(source).put(Buffer.from('synthetic proof only'),'application/json');
  const concept=crypto.randomUUID(),tombstone=crypto.randomUUID(),accounts=Array.from({length:3},()=>crypto.randomUUID()),jobs=accounts.map(()=>crypto.randomUUID());
  const event=crypto.randomUUID(),lateEvent=crypto.randomUUID(),financial=crypto.randomUUID();
  await sourcePool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await sourcePool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state,permanently_unpublished) VALUES($1,'fixture',$2,'UNKNOWN',true)",[tombstone,crypto.randomUUID()]);
  for(const [i,state] of ['processing','publishing','published'].entries()){
   await sourcePool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',10)",[accounts[i]]);
   await sourcePool.query(`INSERT INTO pod_production_queue
    (id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key,state,attempt,fencing_token,lease_until,provider_id)
    VALUES($1,$2,$3,'redbubble',1,'{"synthetic":true}','{}',$4,$5,1,9007199254740993,clock_timestamp()+interval '30 minutes',$6)`,
    [jobs[i],concept,accounts[i],crypto.randomUUID(),state,i===2?'fixture-listing':null]);
  }
  await sourcePool.query("INSERT INTO pod_daily_concept_budget VALUES('fixture','2026-01-01',7)");
  await sourcePool.query(`INSERT INTO pod_market_intelligence
   (id,platform,source_url,observed_at,country,category,image_sha256,price_minor,currency,observed_rank,source_sha256,observations,rank_evidence_sha256)
   VALUES($1,'redbubble','https://example.invalid/fixture','2026-01-01T00:00:00.123456Z','US','fixture',$2,123,'USD',1,$2,'{"synthetic":true}',$2)`,[crypto.randomUUID(),proof]);
  await sourcePool.query('INSERT INTO pod_quota_reservations(job_id,attempt,account_id) VALUES($1,1,$2)',[jobs[1],accounts[1]]);
  await sourcePool.query("INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,'pod.fixture','{\"exact\":9007199254740993}')",[event,jobs[2]]);
  await sourcePool.query("INSERT INTO pod_provider_inbox(provider,account_id,provider_event_id,evidence_sha256,payload) VALUES('redbubble',$1,'fixture-event',$2,'{}')",[accounts[2],proof]);
  await sourcePool.query(`INSERT INTO pod_financial_events
   (id,job_id,provider,provider_event_id,kind,amount_minor,currency,occurred_at,evidence_sha256,authority_event_id)
   VALUES($1,$2,'redbubble','synthetic-amount','royalty',9007199254740993,'USD','2026-01-01T00:00:00.123456Z',$3,'synthetic-authority')`,[financial,jobs[2],proof]);
  // Commit a concurrent source event after the export snapshot already exists.
  let changed=false;
  const exporting={pool:{connect:async()=>{
   const client=await source.pool.connect();return {release:()=>client.release(),query:async(sql,args)=>{
    const result=await client.query(sql,args);
    if(sql.startsWith('FETCH')&&!changed){changed=true;await sourcePool.query("INSERT INTO pod_events(id,kind,payload) VALUES($1,'pod.fixture.later','{}')",[lateEvent]);}
    return result;
   }};
  }}};
  const exported=await exportStateArchive(exporting,{directory,key,env});
  assert.equal(changed,true);assert.equal(exported.records,15);
  assert.equal((await verifyStateArchive({directory,key})).records,15);
  const catalog=JSON.parse(unseal(await fs.readFile(path.join(directory,'catalog.pod')),key,'pod:state-catalog:v1'));
  const last=catalog.items.at(-1),file=path.join(directory,String(last.index).padStart(5,'0')+'.pod');
  const original=await fs.readFile(file),corrupt=Buffer.from(original);corrupt[40]^=1;
  const assertEmpty=async()=>{for(const table of catalog.tables)assert.equal((await targetPool.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n,0,table);};
  // Corrupt after initial offline verification, once earlier rows were inserted.
  let mutated=false;
  const racing={tx:fn=>target.tx(c=>fn({query:async(sql,args)=>{
   const result=await c.query(sql,args);
   if(sql.startsWith('INSERT INTO public.pod_artifacts')&&!mutated){mutated=true;await fs.writeFile(file,corrupt);}
   return result;
  }}))};
  await assert.rejects(restoreStateArchive(racing,{directory,key,env}),/ARCHIVE_AUTH_FAILED/);
  assert.equal(mutated,true);await assertEmpty();await fs.writeFile(file,original);
  // Never merge an old snapshot into an existing operational database.
  await targetPool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'existing',$2,'PASS')",[concept,crypto.randomUUID()]);
  await assert.rejects(restoreStateArchive(target,{directory,key,env}),/STATE_ARCHIVE_TARGET_NOT_EMPTY/);
  assert.equal((await targetPool.query('SELECT business_id FROM pod_concepts WHERE id=$1',[concept])).rows[0].business_id,'existing');
  await targetPool.query('DELETE FROM pod_concepts WHERE id=$1',[concept]);
  await targetPool.query('ALTER TABLE pod_accounts ADD COLUMN unexpected text');
  await assert.rejects(restoreStateArchive(target,{directory,key,env}),/STATE_ARCHIVE_SCHEMA_MISMATCH/);
  await targetPool.query('ALTER TABLE pod_accounts DROP COLUMN unexpected');await assertEmpty();
  const restored=await restoreStateArchive(target,{directory,key,env});
  assert.equal(restored.accounts_disabled,3);assert.equal(restored.production_held,1);assert.equal(restored.publishing_ambiguous,1);
  assert.equal(restored.archive_sha256,exported.archive_sha256);
  assert.equal((await targetPool.query('SELECT count(*)::int AS n FROM pod_accounts WHERE state=\'DISABLED\'')).rows[0].n,3);
  const states=(await targetPool.query('SELECT id,state,fencing_token,reason_code FROM pod_production_queue ORDER BY id')).rows;
  assert.deepEqual(states.find(j=>j.id===jobs[0]),{id:jobs[0],state:'blocked',fencing_token:'9007199254740994',reason_code:'PRODUCTION_LEASE_EXPIRED'});
  assert.deepEqual(states.find(j=>j.id===jobs[1]),{id:jobs[1],state:'ambiguous',fencing_token:'9007199254740994',reason_code:'RECOVERY_RECONCILIATION_REQUIRED'});
  assert.equal(states.find(j=>j.id===jobs[2]).state,'published');
  for(const table of ['pod_artifacts','pod_concepts','pod_daily_concept_budget','pod_market_intelligence','pod_quota_reservations','pod_provider_inbox','pod_financial_events']){
   const query=`SELECT row_to_json(t)::text AS record FROM public.${table} t ORDER BY row_to_json(t)::text`;
   assert.deepEqual((await targetPool.query(query)).rows,(await sourcePool.query(query)).rows,table+' exact restored values');
  }
  assert.equal((await targetPool.query('SELECT payload::text AS payload FROM pod_events WHERE id=$1',[event])).rows[0].payload,'{"exact": 9007199254740993}');
  assert.equal((await targetPool.query('SELECT id FROM pod_events WHERE id=$1',[lateEvent])).rowCount,0);
  assert.equal((await targetPool.query("SELECT count(*)::int AS n FROM pod_events WHERE kind='pod.recovery.restored'")).rows[0].n,1);
  await assert.rejects(targetPool.query('UPDATE pod_financial_events SET amount_minor=1 WHERE id=$1',[financial]),/POD_APPEND_ONLY/);
  await assert.rejects(targetPool.query("UPDATE pod_concepts SET rights_state='PASS',permanently_unpublished=false WHERE id=$1",[tombstone]),/POD_PERMANENTLY_UNPUBLISHED/);
  await assert.rejects(restoreStateArchive(target,{directory,key,env}),/STATE_ARCHIVE_TARGET_NOT_EMPTY/);
  // Reconnect: success must not be an uncommitted in-memory fixture.
  await Promise.all(pools.map(p=>p.end()));pools.length=0;
  const reopenedURL=new URL(url);reopenedURL.pathname='/'+names[1];const reopened=new pg.Pool({connectionString:reopenedURL.toString(),max:1});pools.push(reopened);
  assert.equal((await reopened.query('SELECT amount_minor::text AS amount FROM pod_financial_events WHERE id=$1',[financial])).rows[0].amount,'9007199254740993');
  assert.equal((await reopened.query('SELECT count(*)::int AS n FROM pod_production_queue')).rows[0].n,3);
 }finally{
  await Promise.all(pools.map(p=>p.end()));
  for(const name of created.reverse())await owner.query(`DROP DATABASE "${name}"`);
  if(roleCreated)await owner.query(`DROP ROLE "${role}"`);
  await owner.end();await fs.rm(root,{recursive:true,force:true});
 }
});
