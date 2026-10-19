import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
import {publishOnce} from '../scripts/pod_stealth_publisher.mjs';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';
import {economicsFixture} from './pod-economics-fixture.mjs';

const key='synthetic-release-freshness-key-'.repeat(2);
const sign=p=>{const payload=JSON.stringify(p);return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
function fixture(now=Date.now(),platform='redbubble',editorial){
 const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),release_checks_passed:true};
 const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',platform,
  destination_platform:platform,mode:'LAUNCH',package_sha256:manifest.package_sha256};
 const common={schema_version:1,issued_at_ms:now-1,expires_at_ms:now+60000};
 const release={...common,audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,
  platform:brief.platform,max_mode:'LAUNCH',launch_content_allowed:true,publication_permission:true,revoked:false,package_sha256:manifest.package_sha256,...economicsFixture(brief,now)};
 const qa=sign({...common,expires_at_ms:now+899000,audience:'content-control:pod:qa',verdict:'PASS',...manifest,
  checks:{...Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight'].map(k=>[k,true])),editorial}});
 const job={id:brief.id,platform:brief.platform,brief,manifest,qa_envelope:qa,idempotency_key:'fixture-idempotency'};
 const events=[];
 // These enabled flags exercise an in-memory fake adapter only; no live env,
 // marketplace calls, credentials, listings or revenue are involved.
 const options={env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},accountId:brief.account_id,
  upstreamKey:key,qaKey:key,db:{claimPublish:async()=>job,assertPublishable:async()=>true,finish:async(_j,state)=>events.push(state)},
  verifyArtifacts:async()=>manifest,resolveGrant:async()=>sign(release),
  adapters:{[platform]:{authorized:true,submit:async()=>{events.push('submit');return {id:'fixture-receipt'};}}}};
 return {options,events,release,manifest};
}
test('KDP release rejects legacy technical-only QA before any adapter call',async()=>{
 for(const editorial of [undefined,false,1,'true']){
  const f=fixture(Date.now(),'kdp',editorial);
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
 const f=fixture(Date.now(),'kdp',true);
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');assert.deepEqual(f.events,['submit','submitted']);
});

test('revocation during artifact verification is observed before submission',async()=>{
 const f=fixture();let revoked=false;
 f.options.resolveGrant=async()=>{f.events.push('grant');return sign({...f.release,revoked});};
 f.options.verifyArtifacts=async()=>{f.events.push('artifacts');revoked=true;return f.manifest;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['artifacts','grant','blocked']);
});

test('grant that expires during artifact verification cannot reach adapter',async t=>{
 let now=2000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(now);
 f.options.verifyArtifacts=async()=>{now+=61000;return f.manifest;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('current grant is fetched after verified artifacts and submission uses same scoped bytes',async()=>{
 const f=fixture();
 f.options.resolveGrant=async(_job,{signal}={})=>{assert.equal(signal,f.options.signal);f.events.push('grant');return sign(f.release);};
 f.options.verifyArtifacts=async()=>{f.events.push('artifacts');return f.manifest;};
 f.options.signal=new AbortController().signal;
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['artifacts','grant','submit','submitted']);
});

test('cancellation during artifact verification never fetches a release grant or submits',async()=>{
 const f=fixture(),controller=new AbortController();f.options.signal=controller.signal;
 f.options.verifyArtifacts=async()=>{controller.abort();return f.manifest;};
 f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('expired lease or revoked local eligibility during grant fetch cannot submit',async()=>{
 for(const reason of ['LEASE_EXPIRED','ACCOUNT_DISABLED','RIGHTS_BLOCKED','FENCING_CHANGED']){
  const f=fixture();let eligible=true;
  f.options.resolveGrant=async()=>{eligible=false;return sign(f.release);};
  f.options.db.assertPublishable=async()=>{if(!eligible)throw Error(reason);return true;};
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(f.events,['blocked']);
 }
});
test('unverified or missing local eligibility result fails closed',async()=>{
 for(const result of [undefined,false,null,'true']){
  const f=fixture();f.options.db.assertPublishable=async()=>result;
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
 const f=fixture();delete f.options.db.assertPublishable;
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
});
test('grant expiry while waiting for local database validation cannot submit',async t=>{
 let now=3000000;t.mock.method(Date,'now',()=>now);
 const f=fixture(now);f.options.db.assertPublishable=async()=>{now+=61000;return true;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
});
test('local eligibility is checked after grant resolution and before submission',async()=>{
 const f=fixture();f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
 f.options.db.assertPublishable=async()=>{f.events.push('eligibility');return true;};
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['grant','eligibility','submit','submitted']);
});
test('cancellation and kill switches are rechecked after local database validation',async()=>{
 for(const mode of ['abort','disable']){
  const f=fixture(),controller=new AbortController();f.options.signal=controller.signal;
  f.options.db.assertPublishable=async()=>{
   if(mode==='abort')controller.abort();else f.options.env.POD_PUBLICATION_ENABLED='false';
   return true;
  };
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
});

test('missing or inadequate economics never reaches an adapter despite valid QA and authority',async()=>{
 for(const edit of [r=>delete r.economics,r=>r.economics.variable_cost_minor=601,
  r=>r.economics.package_sha256='c'.repeat(64),r=>r.price.amount_minor=1999,
  r=>r.economics.all_variable_costs_included=false]){
  const f=fixture();edit(f.release);
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
 }
});
test('economics expires during final database wait even while release grant and QA remain valid',async t=>{
 let now=4000000;t.mock.method(Date,'now',()=>now);const f=fixture(now);
 f.release.economics.valid_until_ms=now+1000;
 f.options.db.assertPublishable=async()=>{now+=1000;return true;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');assert.deepEqual(f.events,['blocked']);
});
test('adapter receives only validated economics and exact calculated contribution',async()=>{
 const f=fixture();f.release.economics.contribution_minor=999999;
 f.options.adapters.redbubble.submit=async({brief})=>{
  assert.equal(brief.economics.contribution_minor,400);
  assert.equal(brief.economics.evidence_event_id,'fixture-economics');return {id:'fixture-receipt'};
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
});

test('blank and oversized provider receipts are ambiguous after exactly one submission',async()=>{
 for(const platform of ['redbubble','kdp'])for(const id of [' ', '\t\r\n', 'x'.repeat(257)]){
  const f=fixture(Date.now(),platform,true),finishes=[];let calls=0;
  f.options.adapters[platform].submit=async()=>{calls++;return {id};};
  f.options.db.finish=async(_job,state,receipt,reason)=>finishes.push({state,receipt,reason});
  assert.equal((await publishOnce(f.options)).status,'AMBIGUOUS');
  assert.equal(calls,1);
  assert.deepEqual(finishes,[{state:'ambiguous',receipt:{},reason:'SUBMISSION_UNCERTAIN'}]);
 }
});
test('missing and non-string provider receipts remain ambiguous',async()=>{
 for(const receipt of [null,{}, {id:''},{id:['listing']},{id:42},{id:{}}]){
  const f=fixture(),finishes=[];let calls=0;
  f.options.adapters.redbubble.submit=async()=>{calls++;return receipt;};
  f.options.db.finish=async(_job,state,value)=>finishes.push({state,value});
  assert.equal((await publishOnce(f.options)).status,'AMBIGUOUS');assert.equal(calls,1);
  assert.deepEqual(finishes,[{state:'ambiguous',value:{}}]);
 }
});
test('valid opaque receipt IDs retain exact case, spacing and 256-character boundary',async()=>{
 for(const id of ['Provider/Case-A?part=1',' leading-and-trailing ', 'é'.repeat(256)]){
  const f=fixture(),finishes=[];
  f.options.adapters.redbubble.submit=async()=>({id});
  f.options.db.finish=async(_job,state,value)=>finishes.push({state,value});
  assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
  assert.deepEqual(finishes,[{state:'submitted',value:{id}}]);
 }
});
test('malformed receipt can reconcile from synthetic signed readback without submitting again',async()=>{
 const f=fixture(),proof='c'.repeat(64),providerId='verified-readback-listing';let calls=0,state='publishing',savedId=null;
 f.options.adapters.redbubble.submit=async()=>{calls++;return {id:' '};};
 f.options.db.finish=async(_job,next,receipt)=>{state=next;savedId=receipt.id??null;};
 assert.equal((await publishOnce(f.options)).status,'AMBIGUOUS');
 const observation={schema_version:1,audience:'content-control:pod:listing-observation',issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,job_id:'fixture-job',account_id:'fixture-account',platform:'redbubble',
  package_sha256:f.manifest.package_sha256,status:'LIVE',provider_verified:true,
  provider_id:providerId,provider_event_id:'fixture-observation',evidence_sha256:proof};
 const writes=[];
 const db={tx:async fn=>fn({query:async(sql,args)=>{
  if(sql.startsWith('SELECT * FROM pod_production_queue'))return {rows:[{account_id:observation.account_id,
   platform:observation.platform,manifest:f.manifest,state,provider_id:savedId}]};
  if(sql.includes('FROM pod_artifacts'))return {rows:[{sha256:proof,body_sha256:proof}]};
  if(sql.includes('FROM pod_provider_inbox'))return {rowCount:0,rows:[]};
  writes.push(sql);
  if(sql.startsWith('UPDATE pod_production_queue')){state='published';savedId=args[1];}
  return {rowCount:1};
 }})};
 assert.deepEqual(await reconcilePublication(db,sign(observation),key),{published:true});
 assert.equal(state,'published');assert.equal(savedId,providerId);assert.equal(calls,1);assert.equal(writes.length,3);
});

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
test('direct submitted transition rejects malformed listing IDs before database access',async()=>{
 const db=new PodDB({bridge,pool:{connect:async()=>assert.fail('malformed receipt reached database')},expiresAt:'2099-01-01T00:00:00Z'});
 for(const id of [undefined,null,'',' ', '\t\n','x'.repeat(257),['listing'],42,{}])
  await assert.rejects(db.finish({id:'fixture-job',fencing_token:'1'},'submitted',{id}),/RECEIPT_INVALID/);
});
test('direct submitted transition preserves a valid opaque listing ID',async()=>{
 const queries=[],id=' Provider/Case-A ';
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>({
  query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.startsWith('UPDATE')?[{id:'fixture-job'}]:[]};},release(){}
 })}});
 await db.finish({id:'fixture-job',fencing_token:'1'},'submitted',{id});
 assert.equal(queries.find(q=>q.sql.startsWith('UPDATE')).args[1],id);
 assert.equal(queries.at(-1).sql,'COMMIT');
});
