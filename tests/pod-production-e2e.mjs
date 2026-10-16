import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {migrate} from '../scripts/pod_storage_init.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {createStoredTaskResolvers} from '../integrations/pod/task-resolver.mjs';
import {metrics} from '../integrations/pod/metrics.mjs';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
const key='fixture-key-only-'.repeat(4);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sign=p=>{const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+300000,...p});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
test('stored task -> real Python production -> durable review hold -> signed QA acceptance',{skip:!process.env.POD_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.POD_TEST_DATABASE_URL});
 const db=new PodDB({pool,bridge:{producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}},upstreamKey:key,qaKey:key,expiresAt:new Date(Date.now()+7*86400000).toISOString()});
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pod-e2e-'));
 // Independent synthetic authority snapshots exercise current grant resolution;
 // the queued envelope is never used as the execution authorization fallback.
 const approvals=new Map();
 const approve=(id,envelope)=>{const {issued_at_ms,expires_at_ms,...scope}=JSON.parse(envelope.payload);approvals.set(id,scope);};
 const resolvers=()=>createStoredTaskResolvers(db,{env:{POD_GRANT_URL:'https://authority.invalid/grant',
  POD_GRANT_AUTH_KEY:'fixture-auth-only-'.repeat(4),POD_UPSTREAM_KEY:key},fetchImpl:async(_url,options)=>{
   const scope=approvals.get(JSON.parse(options.body).job_id);
   return scope?new Response(JSON.stringify(sign(scope))):new Response('',{status:503});
  }});
 try{
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pod_test_runtime') THEN CREATE ROLE pod_test_runtime; END IF; END $$");
  await migrate(pool,'pod_test_runtime');
  const image=path.join(tmp,'source.png');
  await promisify(execFile)('python3',['-c',"from PIL import Image; import sys; Image.new('RGB',(600,600),'white').save(sys.argv[1])",image]);
  const source=await fs.readFile(image),store=new ArtifactStore(db);
  const template={platform:'redbubble',dpi:300,size_inches:[2,2],art_box_px:[100,100,400,400],safe_box_px:[50,50,500,500]};
  // These scoped approvals are synthetic test records, not official product specs.
  const templateScope={product:'fixture-shirt',country:'US'};
  const templateRecord={audience:'pod:template',...templateScope,official_source_verified:true,
   source_url:'https://example.org/fixture-template',source_sha256:'a'.repeat(64),observed_at:new Date().toISOString(),template};
  const inputs={'source.png':source,'layers.json':Buffer.from('[]'),
   'template.json':Buffer.from(JSON.stringify(sign(templateRecord))),
   'rights.json':Buffer.from(JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',source_sha256:hash(source),text_layers_sha256:hash('[]')})))};
  const files={};for(const [name,bytes] of Object.entries(inputs))files[name]=await store.put(bytes,name.endsWith('.png')?'image/png':'application/json');
  const task={schema_version:1,templateScope,files,source:'source.png',reference:'source.png',template:'template.json',textLayers:'layers.json',assetRights:'rights.json'};
  const taskHash=await store.put(Buffer.from(JSON.stringify(task)),'application/json');
  const concept=crypto.randomUUID(),account=crypto.randomUUID(),id=crypto.randomUUID();
  await pool.query("INSERT INTO pod_accounts(id,platform) VALUES($1,'redbubble')",[account]);
  await pool.query("INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state) VALUES($1,'fixture',$2,'PASS')",[concept,crypto.randomUUID()]);
  const job={id,account_id:account,business_id:'fixture',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH',task_sha256:taskHash};
  const grant=sign({audience:'content-control:pod',job_id:id,account_id:account,business_id:'fixture',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,task_sha256:taskHash});
  await db.enqueue({job,upstream:grant,conceptId:concept,revision:1});
  approve(id,grant);
  const result=await produceOnce({db,...resolvers(),upstreamKey:key,root:process.cwd(),env:{...process.env,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_RIGHTS_KEY:key}});
  assert.equal(result.status,'REVIEW_REQUIRED');
  const saved=await db.reviewPackage(id);assert.equal(saved.reason_code,'REVIEW_REQUIRED');
  const summary=await metrics(db);assert.equal(summary.incident_count,'0');assert.ok(summary.queues.some(q=>q.state==='review_required')); 
  for(const sha of Object.values(saved.manifest.files))assert.equal(hash((await store.get(sha)).body),sha);
  const qa=sign({audience:'content-control:pod:qa',verdict:'PASS',package_sha256:saved.manifest.package_sha256,template_sha256:saved.manifest.template_sha256,checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight'].map(k=>[k,true]))});
  await assert.rejects(db.acceptReview(id,sign({...JSON.parse(qa.payload),package_sha256:'0'.repeat(64)})),/QA_BLOCKED/);
  assert.equal((await db.acceptReview(id,qa)).publication_enabled,false);
  await assert.rejects(db.acceptReview(id,qa),/REVIEW_NOT_PENDING/);
  assert.equal((await db.reviewPackage(id)).state,'qa_passed');
  // Real stored inputs and signed grants must not bypass provenance or scope.
  for(const [index,change] of [{official_source_verified:false},{country:'CA'}].entries()){
   const badTemplate=await store.put(Buffer.from(JSON.stringify(sign({...templateRecord,...change}))),'application/json');
   const badTask={...task,files:{...files,'template.json':badTemplate}};
   const badTaskHash=await store.put(Buffer.from(JSON.stringify(badTask)),'application/json');
   const blockedId=crypto.randomUUID();
   const blockedJob={...job,id:blockedId,task_sha256:badTaskHash};
   const blockedGrant=sign({...JSON.parse(grant.payload),job_id:blockedId,task_sha256:badTaskHash});
   await db.enqueue({job:blockedJob,upstream:blockedGrant,conceptId:concept,revision:index+2});
   approve(blockedId,blockedGrant);
   const before=(await pool.query('SELECT count(*)::int AS n FROM pod_artifacts')).rows[0].n;
   const blocked=await produceOnce({db,...resolvers(),upstreamKey:key,root:process.cwd(),
    env:{...process.env,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_RIGHTS_KEY:key}});
   assert.equal(blocked.status,'BLOCKED');
   const state=(await pool.query('SELECT state,manifest,reason_code FROM pod_production_queue WHERE id=$1',[blockedId])).rows[0];
   assert.equal(blocked.reason_code,'TEMPLATE_PROVENANCE_REQUIRED');
   assert.deepEqual(state,{state:'qa_failed',manifest:null,reason_code:'TEMPLATE_PROVENANCE_REQUIRED'});
   assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_artifacts')).rows[0].n,before);
  }
  // A real failed Python stage supplies only its allowlisted JSON diagnostic.
  await promisify(execFile)('python3',['-c',"from PIL import Image; import sys; Image.new('RGB',(60,60),'white').save(sys.argv[1])",image]);
  const small=await fs.readFile(image);
  const smallFiles={...files,'source.png':await store.put(small,'image/png'),
   'rights.json':await store.put(Buffer.from(JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',
    source_sha256:hash(small),text_layers_sha256:hash('[]')}))),'application/json')};
  const smallHash=await store.put(Buffer.from(JSON.stringify({...task,files:smallFiles})),'application/json');
  const smallId=crypto.randomUUID(),smallGrant=sign({...JSON.parse(grant.payload),job_id:smallId,task_sha256:smallHash});
  await db.enqueue({job:{...job,id:smallId,task_sha256:smallHash},upstream:smallGrant,conceptId:concept,revision:4});
  approve(smallId,smallGrant);
  const before=(await pool.query('SELECT count(*)::int AS n FROM pod_artifacts')).rows[0].n;
  const tooSmall=await produceOnce({db,...resolvers(),upstreamKey:key,root:process.cwd(),
   env:{...process.env,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_RIGHTS_KEY:key}});
  assert.deepEqual(tooSmall,{status:'BLOCKED',job_id:smallId,reason_code:'NATIVE_RESOLUTION_INSUFFICIENT'});
  assert.deepEqual((await pool.query('SELECT state,manifest,reason_code FROM pod_production_queue WHERE id=$1',[smallId])).rows[0],
   {state:'qa_failed',manifest:null,reason_code:'NATIVE_RESOLUTION_INSUFFICIENT'});
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pod_artifacts')).rows[0].n,before);
  // Distinct valid source bytes prevent earlier output from making this a replay.
  await promisify(execFile)('python3',['-c',"from PIL import Image; import sys; Image.new('RGB',(600,600),'#222222').save(sys.argv[1])",image]);
  const budgetSource=await fs.readFile(image);
  const budgetFiles={...files,'source.png':await store.put(budgetSource,'image/png'),
   'rights.json':await store.put(Buffer.from(JSON.stringify(sign({audience:'pod:asset-rights',status:'PASS',
    source_sha256:hash(budgetSource),text_layers_sha256:hash('[]')}))),'application/json')};
  const budgetTaskHash=await store.put(Buffer.from(JSON.stringify({...task,files:budgetFiles})),'application/json');
  const budgetId=crypto.randomUUID(),budgetGrant=sign({...JSON.parse(grant.payload),job_id:budgetId,task_sha256:budgetTaskHash});
  await db.enqueue({job:{...job,id:budgetId,task_sha256:budgetTaskHash},upstream:budgetGrant,conceptId:concept,revision:5});
  approve(budgetId,budgetGrant);
  const storageSnapshot=async()=>(await pool.query('SELECT count(*)::int AS n,COALESCE(sum(octet_length(body)),0)::text AS bytes FROM pod_artifacts')).rows[0];
  const beforeBudget=await storageSnapshot();
  const budgetBlocked=await produceOnce({db,...resolvers(),upstreamKey:key,root:process.cwd(),
   env:{...process.env,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_RIGHTS_KEY:key,
    POD_ARTIFACT_BUDGET_BYTES:String(Number(beforeBudget.bytes)+1)}});
  assert.deepEqual(budgetBlocked,{status:'BLOCKED',job_id:budgetId,reason_code:'ARTIFACT_BUDGET_EXHAUSTED'});
  assert.deepEqual(await storageSnapshot(),beforeBudget);
  assert.deepEqual((await pool.query('SELECT state,manifest,reason_code FROM pod_production_queue WHERE id=$1',[budgetId])).rows[0],
   {state:'qa_failed',manifest:null,reason_code:'ARTIFACT_BUDGET_EXHAUSTED'});
  // Revoke after valid intake: the still-current queued signature cannot win.
  const revokedId=crypto.randomUUID(),revokedGrant=sign({...JSON.parse(grant.payload),job_id:revokedId});
  await db.enqueue({job:{...job,id:revokedId},upstream:revokedGrant,conceptId:concept,revision:6});
  approve(revokedId,revokedGrant);approvals.get(revokedId).revoked=true;
  const beforeRevocation=await storageSnapshot();
  const denied=await produceOnce({db,...resolvers(),upstreamKey:key,root:process.cwd(),
   env:{...process.env,POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,POD_RIGHTS_KEY:key}});
  assert.deepEqual(denied,{status:'BLOCKED',job_id:revokedId,reason_code:'APPROVAL_REVOKED'});
  assert.deepEqual(await storageSnapshot(),beforeRevocation);
  assert.deepEqual((await pool.query('SELECT state,manifest,reason_code FROM pod_production_queue WHERE id=$1',[revokedId])).rows[0],
   {state:'qa_failed',manifest:null,reason_code:'APPROVAL_REVOKED'});
 }finally{await pool.end();await fs.rm(tmp,{recursive:true,force:true});}
});


