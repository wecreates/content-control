import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {publishOnce} from '../scripts/pod_stealth_publisher.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

test('real contradictory release claim preserves its lease without downstream callbacks',
 {skip:!process.env.POD_TEST_DATABASE_URL,timeout:60000},async()=>{
 const url=new URL(process.env.POD_TEST_DATABASE_URL);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
 assert.ok(['/pod_test','/pod_bridge_test'].includes(url.pathname),'disposable workflow database only');
 assert.equal(process.env.PUBLICATION_ENABLED,'false');
 assert.equal(process.env.POD_PUBLICATION_ENABLED,'false');
 const {default:pg}=await import('pg'),{migrate}=await import('../scripts/pod_storage_init.mjs');
 const admin=new pg.Pool({connectionString:url.toString(),max:1});
 const token=crypto.randomBytes(12).toString('hex'),name='pod_release_claim_'+token,role='pod_claim_'+token;
 let pool,created=false,roleCreated=false;
 try{
  await admin.query(`CREATE ROLE "${role}" NOLOGIN`);roleCreated=true;
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);created=true;
  const destination=new URL(url);destination.pathname='/'+name;
  pool=new pg.Pool({connectionString:destination.toString(),max:2});await migrate(pool,role);
  const key='release-claim-fixture-only-'.repeat(3),id=crypto.randomUUID(),account=crypto.randomUUID(),concept=crypto.randomUUID();
  const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?
   '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
  const manifest={schema_version:1,platform:'redbubble',publication_enabled:false,
   package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),
   files:{'art-mask.png':'c'.repeat(64),'print.png':'d'.repeat(64),'text-mask.png':'e'.repeat(64)}};
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
   expires_at_ms:Date.now()+300000,verdict:'PASS',...manifest,
   checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source',
    'text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details'].map(k=>[k,true]))});
  const qa={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const brief={id,account_id:account,business_id:'fixture',platform:'redbubble',destination_platform:'kdp',mode:'PRELAUNCH'};
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  await pool.query("INSERT INTO pod_accounts(id,platform,state,daily_cap) VALUES($1,'redbubble','ACTIVE',10)",[account]);
  await pool.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,
   idempotency_key,state,manifest,qa_envelope) VALUES($1,$2,$3,'redbubble',1,$4,'{}',$5,'qa_passed',$6,$7)`,
   [id,concept,account,brief,crypto.randomUUID(),manifest,qa]);
  await pool.query("INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,'pod.production.qa_passed',$3)",
   [crypto.randomUUID(),id,{manifest_sha256:crypto.createHash('sha256').update(canonical(manifest)).digest('hex'),publication_enabled:false}]);
  const restricted={connect:async()=>{
   const c=await pool.connect();try{await c.query(`SET ROLE "${role}"`);}catch(e){c.release(true);throw e;}
   return {query:(...args)=>c.query(...args),release:()=>c.release(true)};
  }};
  const db=new PodDB({pool:restricted,qaKey:key,expiresAt:new Date(Date.now()+86400000*7).toISOString(),
   bridge:{producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}}});
  let calls=0;const record=async()=>{calls++;return {};};
  db.finish=record;db.assertPublishable=record;
  // Enabled values are isolated function inputs only; the service stays off.
  await assert.rejects(publishOnce({db,accountId:account,
   env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},upstreamKey:key,qaKey:key,
   resolveGrant:record,verifyArtifacts:record,adapters:{redbubble:{authorized:true,submit:record}}}),
   /^Error: RELEASE_SETTLEMENT_UNCERTAIN$/);
  assert.equal(calls,0);
  assert.deepEqual((await pool.query(`SELECT state,attempt,fencing_token,reason_code,
   isfinite(lease_until) AS finite FROM pod_production_queue WHERE id=$1`,[id])).rows,
   [{state:'publishing',attempt:1,fencing_token:'1',reason_code:null,finite:true}]);
  assert.equal((await pool.query('SELECT job_id FROM pod_quota_reservations WHERE job_id=$1',[id])).rowCount,1);
  assert.deepEqual((await pool.query('SELECT kind FROM pod_events WHERE job_id=$1',[id])).rows,
   [{kind:'pod.production.qa_passed'}]);
 }finally{
  if(pool)await pool.end();
  if(created)await admin.query(`DROP DATABASE "${name}"`);
  if(roleCreated)await admin.query(`DROP ROLE "${role}"`);
  await admin.end();
 }
});
