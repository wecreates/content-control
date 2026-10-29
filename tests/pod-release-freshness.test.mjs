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
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
 value&&typeof value==='object'?`{${Object.keys(value).sort().map(name=>`${JSON.stringify(name)}:${canonical(value[name])}`).join(',')}}`:
 JSON.stringify(value);
const storedManifest=(platform='redbubble')=>{
 const names=['art-mask.png','print.png','text-mask.png',...(platform==='kdp'?['cover.pdf','interior.pdf','interior.receipt.json']:[])];
 const files=Object.fromEntries(names.map(name=>[name,'a'.repeat(64)]));
 const value={schema_version:1,platform,publication_enabled:false,files};
 return {...value,package_sha256:crypto.createHash('sha256').update(canonical(value)).digest('hex')};
};
const storedIdentity=manifest=>crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
const validPng=()=>{
 const body=Buffer.alloc(45);
 Buffer.from('89504e470d0a1a0a','hex').copy(body);
 body.writeUInt32BE(13,8);body.write('IHDR',12,'ascii');
 body.writeUInt32BE(0,33);body.write('IEND',37,'ascii');
 return body;
};
function fixture(now=Date.now(),platform='redbubble',editorial){
 const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64),release_checks_passed:true};
 const brief={id:'fixture-job',account_id:'fixture-account',business_id:'fixture-business',platform,
  destination_platform:platform,mode:'LAUNCH',package_sha256:manifest.package_sha256};
 const common={schema_version:1,issued_at_ms:now-1,expires_at_ms:now+60000};
 const release={...common,audience:'content-control:pod',job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,
  platform:brief.platform,max_mode:'LAUNCH',launch_content_allowed:true,publication_permission:true,revoked:false,package_sha256:manifest.package_sha256,...economicsFixture(brief,now)};
 const qa=sign({...common,expires_at_ms:now+899000,audience:'content-control:pod:qa',verdict:'PASS',...manifest,
  list_price:{marketplace:'amazon.com',currency:'USD',amount_minor:2000},checks:{...Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance','manuscript_provenance','source_font','font_rights','book_details','regional_rights'].map(k=>[k,true])),editorial}});
 const job={id:brief.id,account_id:brief.account_id,platform:brief.platform,fencing_token:'1',brief,manifest,qa_envelope:qa,idempotency_key:'fixture-idempotency'};
 const events=[];
 // These enabled flags exercise an in-memory fake adapter only; no live env,
 // marketplace calls, credentials, listings or revenue are involved.
 const options={env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},accountId:brief.account_id,
  upstreamKey:key,qaKey:key,db:{claimPublish:async()=>job,assertPublishable:async()=>true,finish:async(_j,state)=>events.push(state)},
  verifyArtifacts:async()=>manifest,resolveGrant:async()=>sign(release),
  adapters:{[platform]:{authorized:true,submit:async()=>{events.push('submit');return {id:'fixture-receipt'};}}}};
 return {options,events,release,manifest,qa};
}
test('an already-aborted publisher performs no dry-run read or enabled claim',async()=>{
 for(const enabled of [false,true]){
  const controller=new AbortController();controller.abort();let touched=0;
  const result=await publishOnce({signal:controller.signal,
   env:{PUBLICATION_ENABLED:String(enabled),POD_PUBLICATION_ENABLED:String(enabled)},
   db:{listReady:async()=>{touched++;return [];},claimPublish:async()=>{touched++;return null;}},
   resolveGrant:async()=>assert.fail('grant resolver reached'),
   verifyArtifacts:async()=>assert.fail('artifact verifier reached'),log:()=>{}});
  assert.deepEqual(result,{status:'STOPPED'});assert.equal(touched,0);
 }
});
test('cancellation during a dry-run queue read reports stopped without logging success',async()=>{
 const controller=new AbortController(),logs=[];
 const result=await publishOnce({signal:controller.signal,
  env:{PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
  db:{listReady:async()=>{controller.abort();return [{id:'cancelled-fixture'}];}},
  log:value=>logs.push(value)});
 assert.deepEqual(result,{status:'STOPPED'});assert.deepEqual(logs,[]);
});
test('cancellation during a publishing claim settles without artifact work',async()=>{
 const f=fixture(),controller=new AbortController();let artifactChecks=0;
 f.options.signal=controller.signal;
 const claim=f.options.db.claimPublish;
 f.options.db.claimPublish=async()=>{controller.abort();return claim();};
 f.options.verifyArtifacts=async()=>{artifactChecks++;return f.manifest;};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.equal(artifactChecks,0);assert.deepEqual(f.events,['blocked']);
});
test('cancellation during an empty publishing claim reports stopped',async()=>{
 const controller=new AbortController();let settled=0;
 const result=await publishOnce({signal:controller.signal,
  env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},accountId:'fixture-account',
  db:{claimPublish:async()=>{controller.abort();return null;},finish:async()=>{settled++;}},
  resolveGrant:async()=>assert.fail('grant resolver reached'),
  verifyArtifacts:async()=>assert.fail('artifact verifier reached')});
 assert.deepEqual(result,{status:'STOPPED'});assert.equal(settled,0);
});
test('publication disable during a publishing claim settles before artifact work',async()=>{
 for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
  const f=fixture(),artifactChecks=[];
  const claim=f.options.db.claimPublish;
  f.options.db.claimPublish=async()=>{f.options.env[flag]='false';return claim();};
  f.options.verifyArtifacts=async()=>{artifactChecks.push(flag);return f.manifest;};
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(artifactChecks,[]);assert.deepEqual(f.events,['blocked']);
 }
});
test('publication disable during an empty publishing claim reports stopped',async()=>{
 for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
  const env={PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'};
  const result=await publishOnce({env,accountId:'fixture-account',
   db:{claimPublish:async()=>{env[flag]='false';return null;}},
   resolveGrant:async()=>assert.fail('grant resolver reached'),
   verifyArtifacts:async()=>assert.fail('artifact verifier reached')});
  assert.deepEqual(result,{status:'STOPPED'});
 }
});
test('submission uses the durable settlement endpoint captured before the publishing claim wait',async()=>{
 const f=fixture(),durableFinish=f.options.db.finish;let durableSettlements=0;
 f.options.db.finish=async(...args)=>{durableSettlements++;return Reflect.apply(durableFinish,f.options.db,args);};
 const claim=f.options.db.claimPublish;
 f.options.db.claimPublish=async(...args)=>{
  const job=await Reflect.apply(claim,f.options.db,args);
  f.options.db.finish=async()=>{};
  return job;
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.equal(durableSettlements,1);
 assert.deepEqual(f.events,['submit','submitted']);
});

test('submission uses the local eligibility guard captured before the publishing claim wait',async()=>{
 const f=fixture();let originalGuardCalls=0;
 f.options.db.assertPublishable=async()=>{originalGuardCalls++;return false;};
 const claim=f.options.db.claimPublish;
 f.options.db.claimPublish=async(...args)=>{
  const job=await Reflect.apply(claim,f.options.db,args);
  f.options.db.assertPublishable=async()=>true;
  return job;
 };
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.equal(originalGuardCalls,1);
 assert.deepEqual(f.events,['blocked']);
});

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

test('release grant snapshot rejects resolver-owned mutation during local database validation',async()=>{
 const f=fixture(),envelope=sign({...f.release,revoked:true}),authorized=sign(f.release);
 f.options.resolveGrant=async()=>envelope;
 f.options.db.assertPublishable=async()=>{Object.assign(envelope,authorized);return true;};
 f.options.adapters.redbubble.submit=async()=>assert.fail('adapter reached');
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('submission uses the exact local eligibility guard captured before caller-owned waits',async()=>{
 const f=fixture();
 f.options.db.assertPublishable=async()=>false;
 f.options.resolveGrant=async()=>{
  f.options.db.assertPublishable=async()=>true;
  return sign(f.release);
 };
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('submission uses the exact durable settlement endpoint captured before caller-owned waits',async()=>{
 const f=fixture(),durableFinish=f.options.db.finish;let durableSettlements=0;
 f.options.db.finish=async(...args)=>{
  durableSettlements++;
  return Reflect.apply(durableFinish,f.options.db,args);
 };
 f.options.resolveGrant=async()=>{
  f.options.db.finish=async()=>{};
  return sign(f.release);
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.equal(durableSettlements,1);
 assert.deepEqual(f.events,['submit','submitted']);
});

test('adapter revocation or registry replacement during caller-owned waits blocks the captured endpoint',async()=>{
 const results=[];
 for(const mode of ['revoke','replace']){
  const f=fixture(),adapter=f.options.adapters.redbubble;
  f.options.resolveGrant=async()=>{
   if(mode==='revoke')adapter.authorized=false;
   else f.options.adapters.redbubble={authorized:true,submit:async()=>assert.fail('replacement endpoint reached')};
   return sign(f.release);
  };
  results.push([mode,(await publishOnce(f.options)).status,[...f.events]]);
 }
 assert.deepEqual(results,[
  ['revoke','BLOCKED',['blocked']],
  ['replace','BLOCKED',['blocked']]
 ]);
});

test('adapter authorization contract rejects accessors and proxies without invoking traps',async()=>{
 for(const {name,wrap} of [
  {name:'accessor',wrap:(submit,reads)=>{
   const adapter={};
   Object.defineProperties(adapter,{
    authorized:{enumerable:true,get(){reads.count++;return true;}},
    submit:{enumerable:true,get(){reads.count++;return submit;}}
   });
   return adapter;
  }},
  {name:'proxy',wrap:(submit,reads)=>new Proxy({authorized:true,submit},{
   get(target,key,receiver){reads.count++;return Reflect.get(target,key,receiver);}
  })}
 ]){
  const f=fixture(),reads={count:0},submit=async()=>{f.events.push('submit');return {id:'fixture-receipt'};};
  f.options.adapters.redbubble=wrap(submit,reads);
  assert.equal((await publishOnce(f.options)).status,'BLOCKED',name);
  assert.equal(reads.count,0,name);
  assert.deepEqual(f.events,['blocked'],name);
 }
});

test('submission uses the exact adapter endpoint authorized before caller-owned waits',async()=>{
 const f=fixture(),adapter=f.options.adapters.redbubble;
 f.options.db.assertPublishable=async()=>{
  adapter.submit=async()=>assert.fail('replacement adapter endpoint reached');
  return true;
 };
 adapter.submit=async()=>({id:'fixture-receipt'});
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['submitted']);
});

test('submission preserves claimed idempotency identity across local eligibility mutation',async()=>{
 const f=fixture(),original='fixture-idempotency';
 f.options.db.assertPublishable=async job=>{job.idempotency_key='eligibility-mutated-idempotency';return true;};
 f.options.adapters.redbubble.submit=async({idempotencyKey})=>{
  assert.equal(idempotencyKey,original);
  return {id:'fixture-receipt'};
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['submitted']);
});

test('submission preserves claimed idempotency identity across resolver mutation',async()=>{
 const f=fixture(),claimed=f.options.db.claimPublish,original='fixture-idempotency';
 let claimedJob;
 f.options.db.claimPublish=async(...args)=>{claimedJob=await claimed(...args);return claimedJob;};
 f.options.resolveGrant=async job=>{
  assert.equal(job,claimedJob);
  job.idempotency_key='resolver-mutated-idempotency';
  return sign(f.release);
 };
 f.options.adapters.redbubble.submit=async({idempotencyKey})=>{
  assert.equal(idempotencyKey,original);
  return {id:'fixture-receipt'};
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
 assert.deepEqual(f.events,['submitted']);
});

test('submission uses the exact manifest snapshot returned by artifact verification',async()=>{
 const f=fixture(),verifiedFileHash='d'.repeat(64),changedFileHash='e'.repeat(64);
 f.manifest.files={'print.png':verifiedFileHash};
 f.options.verifyArtifacts=async()=>f.manifest;
 f.options.resolveGrant=async()=>{
  f.manifest.files['print.png']=changedFileHash;
  return sign(f.release);
 };
 f.options.adapters.redbubble.submit=async({manifest})=>{
  assert.equal(manifest.files['print.png'],verifiedFileHash);
  return {id:'fixture-receipt'};
 };
 assert.equal((await publishOnce(f.options)).status,'SUBMITTED');
});

test('manifest snapshot rejects accessors and proxies without invoking traps',async()=>{
 for(const {name,wrap} of [
  {name:'accessor',wrap:(manifest,reads)=>{const value={...manifest};Object.defineProperty(value,'package_sha256',{
   enumerable:true,get(){reads.count++;return manifest.package_sha256;}});return value;}},
  {name:'proxy',wrap:(manifest,reads)=>new Proxy(manifest,{get(target,key,receiver){
   if(key!=='then')reads.count++;
   return Reflect.get(target,key,receiver);
  }})}
 ]){
  const f=fixture(),reads={count:0};
  f.options.verifyArtifacts=async()=>wrap(f.manifest,reads);
  f.options.resolveGrant=async()=>assert.fail('grant resolver reached');
  f.options.adapters.redbubble.submit=async()=>assert.fail('adapter reached');
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.equal(reads.count,0,name);
  assert.deepEqual(f.events,['blocked']);
 }
});

test('cancellation during artifact verification never fetches a release grant or submits',async()=>{
 const f=fixture(),controller=new AbortController();f.options.signal=controller.signal;
 f.options.verifyArtifacts=async()=>{controller.abort();return f.manifest;};
 f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
 assert.equal((await publishOnce(f.options)).status,'BLOCKED');
 assert.deepEqual(f.events,['blocked']);
});

test('publication disable during artifact verification never fetches a release grant',async()=>{
 for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
  const f=fixture();
  f.options.verifyArtifacts=async()=>{f.options.env[flag]='false';return f.manifest;};
  f.options.resolveGrant=async()=>{f.events.push('grant');return sign(f.release);};
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(f.events,['blocked']);
 }
});

test('publication disable during grant resolution never enters local eligibility',async()=>{
 for(const flag of ['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']){
  const f=fixture();
  f.options.resolveGrant=async()=>{f.events.push('grant');f.options.env[flag]='false';return sign(f.release);};
  f.options.db.assertPublishable=async()=>{f.events.push('eligibility');return true;};
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(f.events,['grant','blocked']);
 }
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

test('KDP list price must match the signed Money Factory price before any adapter call',async()=>{
 for(const edit of [
  q=>delete q.list_price,
  q=>q.list_price.amount_minor=1999,
  q=>q.list_price.currency='EUR',
  q=>q.list_price.marketplace='amazon.co.uk',
  q=>q.list_price.extra=true,
  q=>q.list_price.amount_minor=25001]){
  const f=fixture(Date.now(),'kdp',true),payload=JSON.parse(f.qa.payload);
  edit(payload);Object.assign(f.qa,sign(payload));
  assert.equal((await publishOnce(f.options)).status,'BLOCKED');
  assert.deepEqual(f.events,['blocked']);
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
 for(const receipt of [null,{}, {id:''},{id:'listing\0id'},{id:'\ud800'},{id:'\ud801'},{id:['listing']},{id:42},{id:{}}]){
  const f=fixture(),finishes=[];let calls=0;
  f.options.adapters.redbubble.submit=async()=>{calls++;return receipt;};
  f.options.db.finish=async(_job,state,value)=>finishes.push({state,value});
  assert.equal((await publishOnce(f.options)).status,'AMBIGUOUS');assert.equal(calls,1);
  assert.deepEqual(finishes,[{state:'ambiguous',value:{}}]);
 }
});
test('provider receipt identity cannot change between validation and settlement',async()=>{
 for(const makeReceipt of [
  reads=>{const receipt={};Object.defineProperty(receipt,'id',{enumerable:true,get(){reads.count++;return reads.count===1?'validated-listing':'changed-listing';}});return receipt;},
  reads=>new Proxy({id:'validated-listing'},{get(target,key,receiver){if(key==='id')reads.count++;return Reflect.get(target,key,receiver);}})
 ]){
  const f=fixture(),finishes=[],reads={count:0};
  f.options.adapters.redbubble.submit=async()=>makeReceipt(reads);
  f.options.db.finish=async(_job,state,value,reason)=>finishes.push({state,value,reason});
  assert.equal((await publishOnce(f.options)).status,'AMBIGUOUS');
  assert.equal(reads.count,0);
  assert.deepEqual(finishes,[{state:'ambiguous',value:{},reason:'SUBMISSION_UNCERTAIN'}]);
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
test('failed submitted settlement stops without a second transition or private database error',async()=>{
 const f=fixture(),finishes=[],privateError=Error('postgres://private:secret@host/database');
 f.options.db.finish=async(_job,state,receipt,reason)=>{
  finishes.push({state,receipt,reason});
  if(state==='submitted')throw privateError;
  assert.fail('uncertain submitted settlement attempted a second transition');
 };
 await assert.rejects(publishOnce(f.options),error=>
  error?.message==='SUBMISSION_SETTLEMENT_UNCERTAIN'&&!String(error).includes('private'));
 assert.deepEqual(finishes,[{state:'submitted',receipt:{id:'fixture-receipt'},reason:undefined}]);
});
test('failed fallback settlement exposes only a fixed recovery code',async()=>{
 for(const submitted of [false,true]){
  const f=fixture(),finishes=[],privateError=Error('postgres://private:secret@host/database');
  if(submitted)f.options.adapters.redbubble.submit=async()=>{throw Error('provider timeout');};
  else f.options.adapters={};
  f.options.db.finish=async(_job,state,receipt,reason)=>{
   finishes.push({state,receipt,reason});
   throw privateError;
  };
  const code=submitted?'SUBMISSION_SETTLEMENT_UNCERTAIN':'RELEASE_SETTLEMENT_UNCERTAIN';
  await assert.rejects(publishOnce(f.options),error=>
   error?.message===code&&!String(error).includes('private'));
  assert.deepEqual(finishes,[submitted?
   {state:'ambiguous',receipt:{},reason:'SUBMISSION_UNCERTAIN'}:
   {state:'blocked',receipt:{},reason:'RELEASE_BLOCKED'}]);
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
 const db={active(){},tx:async fn=>fn({query:async(sql,args)=>{
  if(sql.startsWith('SELECT * FROM pod_production_queue'))return {rows:[{account_id:observation.account_id,
   platform:observation.platform,manifest:f.manifest,state,provider_id:savedId}]};
  if(sql.includes('FROM pod_artifacts'))return {rows:[{sha256:proof,media_type:'application/json',body_sha256:proof}]};
  if(sql.includes('FROM pod_provider_inbox'))return {rowCount:0,rows:[]};
  writes.push(sql);
  if(sql.startsWith('UPDATE pod_production_queue')){state='published';savedId=args[1];}
  return {rowCount:1};
 }})};
 assert.deepEqual(await reconcilePublication(db,sign(observation),key),{published:true});
 assert.equal(state,'published');assert.equal(savedId,providerId);assert.equal(calls,1);assert.equal(writes.length,3);
});

const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const readPool=query=>({connect:async()=>({query,release(){}})});
test('operations list retains revoked review records without advertising preview access',async()=>{
 const pool=readPool(async sql=>{
  const text=typeof sql==='string'?sql:sql.text;
  const rightsBound=text.includes('JOIN pod_concepts p ON p.id=q.concept_id')&&
   text.includes("p.rights_state='PASS'")&&text.includes('NOT p.permanently_unpublished');
  return {rows:[{id:'fixture-job',platform:'redbubble',state:'review_required',reason_code:null,
   attempt:1,created_at:new Date(0),can_preview:rightsBound?false:true}]};
 });
 const db=new PodDB({bridge,pool,expiresAt:'2099-01-01T00:00:00Z'});
 const rows=await db.listOperationsJobs();
 assert.equal(rows.length,1);assert.equal(rows[0].id,'fixture-job');assert.equal(rows[0].can_preview,false);
});
test('operations list advertises previews only for the exact durable review hold',async()=>{
 const pool=readPool(async sql=>{
  const text=typeof sql==='string'?sql:sql.text;
  const exactHold=text.includes("q.manifest IS NOT NULL AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'");
  return {rows:[{id:'fixture-job',platform:'redbubble',state:'qa_passed',reason_code:null,
   attempt:1,created_at:new Date(0),can_preview:exactHold?false:true}]};
 });
 const db=new PodDB({bridge,pool,expiresAt:'2099-01-01T00:00:00Z'});
 const rows=await db.listOperationsJobs('qa_passed');
 assert.equal(rows.length,1);assert.equal(rows[0].id,'fixture-job');assert.equal(rows[0].can_preview,false);
});
test('operations list does not advertise an invalid stored review package',async()=>{
 const manifest=storedManifest();manifest.package_sha256='invalid';
 const pool=readPool(async sql=>{
  const text=typeof sql==='string'?sql:sql.text;
  const row={id:'fixture-job',platform:'redbubble',state:'review_required',reason_code:'REVIEW_REQUIRED',
   attempt:1,created_at:new Date(0),can_preview:true};
  if(text.includes('q.reason_code,q.attempt,q.created_at,q.manifest,')){
   row.manifest=manifest;row.manifest_sha256=storedIdentity(manifest);
  }
  return {rows:[row]};
 });
 const db=new PodDB({bridge,pool,expiresAt:'2099-01-01T00:00:00Z'});
 const rows=await db.listOperationsJobs();
 assert.equal(rows.length,1);assert.equal(rows[0].can_preview,false);
 assert.deepEqual(Object.keys(rows[0]).sort(),
  ['id','platform','state','reason_code','attempt','created_at','can_preview'].sort());
});
test('stored review package rejects a queue and manifest marketplace mismatch',async()=>{
 const row={id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',
  manifest:storedManifest('etsy')};
 row.manifest_sha256=storedIdentity(row.manifest);
 const db=new PodDB({bridge,pool:readPool(async()=>({rows:[row]})),expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.reviewPackage(row.id),/PACKAGE_UNAVAILABLE/);
 row.manifest=storedManifest();row.manifest_sha256=storedIdentity(row.manifest);
 assert.equal((await db.reviewPackage(row.id)).platform,'redbubble');
});
test('stored review package requires an exact review hold state',async()=>{
 const row={id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',manifest:storedManifest()};
 row.manifest_sha256=storedIdentity(row.manifest);
 const db=new PodDB({bridge,pool:readPool(async()=>({rows:[row]})),expiresAt:'2099-01-01T00:00:00Z'});
 for(const [state,reason] of [['qa_passed',null],['submitted',null],['qa_failed','QA_FAILED'],['qa_failed',null]]){
  row.state=state;row.reason_code=reason;
  await assert.rejects(db.reviewPackage(row.id),/PACKAGE_UNAVAILABLE/);
 }
 row.state='qa_failed';row.reason_code='REVIEW_REQUIRED';
 assert.equal((await db.reviewPackage(row.id)).reason_code,'REVIEW_REQUIRED');
});
test('stored review package rejects invalid manifest acceptance claims and identity',async()=>{
 const row={id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',manifest:storedManifest()};
 row.manifest_sha256=storedIdentity(row.manifest);
 const db=new PodDB({bridge,pool:readPool(async()=>({rows:[row]})),expiresAt:'2099-01-01T00:00:00Z'});
 for(const mutate of [
  manifest=>manifest.schema_version=2,
  manifest=>manifest.publication_enabled=true,
  manifest=>manifest.package_sha256='invalid',
  manifest=>manifest.package_sha256='c'.repeat(64),
  manifest=>manifest.files={'print.png':'invalid'},
  manifest=>delete manifest.files['art-mask.png'],
  manifest=>manifest.files['debug.txt']='a'.repeat(64),
 ]){
  row.manifest=storedManifest();row.manifest_sha256=storedIdentity(row.manifest);mutate(row.manifest);
  await assert.rejects(db.reviewPackage(row.id),/PACKAGE_UNAVAILABLE/);
 }
 row.platform='kdp';row.manifest=storedManifest('kdp');row.manifest_sha256=storedIdentity(row.manifest);delete row.manifest.files['cover.pdf'];
 await assert.rejects(db.reviewPackage(row.id),/PACKAGE_UNAVAILABLE/);
 row.manifest=storedManifest('kdp');row.manifest_sha256=storedIdentity(row.manifest);
 assert.equal((await db.reviewPackage(row.id)).platform,'kdp');
 row.manifest=storedManifest();row.manifest_sha256=storedIdentity(row.manifest);
 row.platform='redbubble';
 assert.equal((await db.reviewPackage(row.id)).manifest.package_sha256,row.manifest.package_sha256);
});
test('stored review artifacts require the exact held job and manifest membership',async()=>{
 const body=validPng(),sha=crypto.createHash('sha256').update(body).digest('hex');
 const manifest=storedManifest();for(const name of Object.keys(manifest.files))manifest.files[name]=sha;
 const row={id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',
  manifest,manifest_sha256:storedIdentity(manifest),body,media_type:'image/png'};
 const db=new PodDB({bridge,pool:readPool(async()=>({rows:[row]})),expiresAt:'2099-01-01T00:00:00Z'});
 await assert.rejects(db.reviewArtifact('other-job',sha),/ARTIFACT_UNAVAILABLE/);
 await assert.rejects(db.reviewArtifact(row.id,'b'.repeat(64)),/ARTIFACT_UNAVAILABLE/);
 assert.deepEqual(await db.reviewArtifact(row.id,sha),{body,media_type:'image/png'});
 row.media_type='application/pdf';
 await assert.rejects(db.reviewArtifact(row.id,sha),/ARTIFACT_UNAVAILABLE/);
 row.media_type='image/png';
 const malformed=Buffer.from('not a png'),malformedSha=crypto.createHash('sha256').update(malformed).digest('hex');
 row.body=malformed;for(const name of Object.keys(manifest.files))manifest.files[name]=malformedSha;
 row.manifest_sha256=storedIdentity(manifest);
 await assert.rejects(db.reviewArtifact(row.id,malformedSha),/ARTIFACT_UNAVAILABLE/);
 row.platform='kdp';row.manifest=storedManifest('kdp');row.manifest.files['cover.pdf']=sha;
 const pdf=Buffer.from('%PDF-1.7\n%%EOF'),pdfSha=crypto.createHash('sha256').update(pdf).digest('hex');
 row.manifest.files['cover.pdf']=pdfSha;row.body=pdf;
 row.manifest_sha256=storedIdentity(row.manifest);row.media_type='application/pdf';
 assert.deepEqual(await db.reviewArtifact(row.id,pdfSha),{body:pdf,media_type:'application/pdf'});
 row.manifest.files['print.png']=pdfSha;row.manifest_sha256=storedIdentity(row.manifest);
 await assert.rejects(db.reviewArtifact(row.id,pdfSha),/ARTIFACT_UNAVAILABLE/);
 row.manifest=storedManifest('kdp');const receipt=Buffer.from('{}'),receiptSha=crypto.createHash('sha256').update(receipt).digest('hex');
 row.manifest.files['interior.receipt.json']=receiptSha;row.manifest_sha256=storedIdentity(row.manifest);
 row.body=receipt;row.media_type='application/json';
 assert.deepEqual(await db.reviewArtifact(row.id,receiptSha),{body:receipt,media_type:'application/json'});
 const malformedReceipt=Buffer.from('{"a":1,"a":2}'),malformedReceiptSha=crypto.createHash('sha256').update(malformedReceipt).digest('hex');
 row.manifest.files['interior.receipt.json']=malformedReceiptSha;row.manifest_sha256=storedIdentity(row.manifest);row.body=malformedReceipt;
 await assert.rejects(db.reviewArtifact(row.id,malformedReceiptSha),/ARTIFACT_UNAVAILABLE/);
 row.platform='redbubble';row.manifest=manifest;row.manifest_sha256=storedIdentity(manifest);row.media_type='image/png';
 row.state='qa_passed';row.reason_code=null;
 await assert.rejects(db.reviewArtifact(row.id,malformedSha),/ARTIFACT_UNAVAILABLE/);
});
test('current rights revocation hides held review packages and artifacts',async()=>{
 const body=validPng(),sha=crypto.createHash('sha256').update(body).digest('hex');
 const manifest=storedManifest();for(const name of Object.keys(manifest.files))manifest.files[name]=sha;
 const row={id:'fixture-job',platform:'redbubble',state:'qa_failed',reason_code:'REVIEW_REQUIRED',
  manifest,manifest_sha256:storedIdentity(manifest),body,media_type:'image/png'};
 for(const rights of [{rights_state:'UNKNOWN',permanently_unpublished:true},
  {rights_state:'FAIL',permanently_unpublished:false},{rights_state:'PASS',permanently_unpublished:true}]){
  const pool=readPool(async sql=>{
   const text=typeof sql==='string'?sql:sql.text;
   if(text.includes('FROM pod_production_queue q')){
    const rightsBound=text.includes("p.rights_state='PASS'")&&text.includes('NOT p.permanently_unpublished');
    return {rows:rightsBound?[]:[{...row,...rights}]};
   }
   return {rows:[]};
  });
  const db=new PodDB({bridge,pool,expiresAt:'2099-01-01T00:00:00Z'});
  await assert.rejects(db.reviewPackage(row.id),/PACKAGE_UNAVAILABLE/);
  await assert.rejects(db.reviewArtifact(row.id,sha),/ARTIFACT_UNAVAILABLE/);
 }
});
test('direct submitted transition rejects malformed listing IDs before database access',async()=>{
 const db=new PodDB({bridge,pool:{connect:async()=>assert.fail('malformed receipt reached database')},expiresAt:'2099-01-01T00:00:00Z'});
 for(const id of [undefined,null,'',' ', '\t\n','x'.repeat(257),'listing\0id','\ud800','\ud801',['listing'],42,{}])
  await assert.rejects(db.finish({id:'fixture-job',fencing_token:'1'},'submitted',{id}),/RECEIPT_INVALID/);
});
test('direct submitted transition preserves a valid opaque listing ID',async()=>{
 const queries=[],id=' Provider/Case-A ';
 const db=new PodDB({bridge,expiresAt:'2099-01-01T00:00:00Z',pool:{connect:async()=>({
  query:async(sql,args)=>{if(typeof sql!=='string'){args=sql.values??args;sql=sql.text;}queries.push({sql,args});
   if(sql.includes("state='publishing' FOR UPDATE"))return {rows:[{id:'fixture-job'}]};
   if(sql.startsWith('SELECT lease_until>clock_timestamp()'))return {rows:[{valid:true}]};
   return {rows:sql.startsWith('UPDATE')?[{id:'fixture-job'}]:[]};},release(){}
 })}});
 await db.finish({id:'fixture-job',fencing_token:'1'},'submitted',{id});
 assert.equal(queries.find(q=>q.sql.startsWith('UPDATE')).args[1],id);
 assert.equal(queries.at(-2).sql,'COMMIT');
});

