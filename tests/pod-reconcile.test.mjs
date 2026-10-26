import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {reconcilePublication} from '../integrations/pod/reconcile.mjs';
const key='provider-test-key-'.repeat(3);
const observation={job_id:'job-a',account_id:'account-a',platform:'redbubble',status:'LIVE',provider_verified:true,
 provider_id:'listing-a',provider_event_id:'event-a',package_sha256:'a'.repeat(64),evidence_sha256:'b'.repeat(64)};
function sign(value){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:listing-observation',
 issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...value});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};}
function database(value,seen,state='submitted',corrupt=false,jobProviderId=value.provider_id){
 const writes=[];
 return {writes,active(){},tx:async fn=>fn({query:async(sql,args)=>{
  if(sql.startsWith('SELECT * FROM pod_production_queue'))return {rows:[{id:value.job_id,account_id:value.account_id,
   platform:value.platform,state,provider_id:jobProviderId,manifest:{package_sha256:value.package_sha256}}]};
  if(sql.includes('FROM pod_artifacts'))return {rowCount:1,rows:[{sha256:value.evidence_sha256,media_type:'application/json',body_sha256:corrupt?'0'.repeat(64):value.evidence_sha256}]};
  if(sql.includes('FROM pod_provider_inbox'))return {rowCount:seen?1:0,rows:seen?[seen]:[]};
  writes.push({sql,args});return {rowCount:1};
 }})};
}
test('provider event replay cannot be acknowledged for another job sharing evidence',async()=>{
 const changed={...observation,job_id:'job-b'};
 const db=database(changed,{evidence_sha256:observation.evidence_sha256,payload:observation});
 await assert.rejects(reconcilePublication(db,sign(changed),key),/LISTING_REPLAY_CONFLICT/);
 assert.equal(db.writes.length,0);
});
test('corrupt listing evidence cannot publish, replay or add a published observation',async()=>{
 for(const [state,replay] of [['submitted',false],['published',true],['published',false]]){
  const seen=replay?{evidence_sha256:observation.evidence_sha256,payload:observation}:null;
  const db=database(observation,seen,state,true);
  await assert.rejects(reconcilePublication(db,sign(observation),key),/EVIDENCE_ARTIFACT_CORRUPT/);
  assert.equal(db.writes.length,0);
 }
});
test('exact replay ignores refreshed envelope times and never mutates state',async()=>{
 const db=database(observation,{evidence_sha256:observation.evidence_sha256,payload:{...observation,issued_at_ms:1,expires_at_ms:2}});
 assert.deepEqual(await reconcilePublication(db,sign(observation),key),{duplicate:true});assert.equal(db.writes.length,0);
});
test('replays bind all listing identity and proof fields, not only the evidence hash',async()=>{
 for(const field of ['job_id','account_id','platform','package_sha256','provider_id','provider_event_id','status','provider_verified']){
  const saved={...observation,[field]:'different'};
  const db=database(observation,{evidence_sha256:observation.evidence_sha256,payload:saved});
  await assert.rejects(reconcilePublication(db,sign(observation),key),/LISTING_REPLAY_CONFLICT/,field);
  assert.equal(db.writes.length,0);
 }
});
test('missing package hash and non-string identities fail before any database access',async()=>{
 for(const change of [{package_sha256:undefined},{package_sha256:'bad'},{provider_id:{}},{provider_event_id:[]},{job_id:''},
  {provider_id:'listing\0id'},{provider_id:'\ud800'},{provider_event_id:'event\0id'},{provider_event_id:'\ud801'}]){
  await assert.rejects(reconcilePublication({tx(){throw Error('unexpected database access');}},sign({...observation,...change}),key),/LISTING_EVIDENCE_REQUIRED/);
 }
});
test('signed listing observations reject extra fields and unknown platforms before database access',async()=>{
 for(const change of [{private_token:'must-not-persist'},{platform:'etsy'}]){
  await assert.rejects(reconcilePublication({tx(){assert.fail('unexpected database access');}},
   sign({...observation,...change}),key),/LISTING_EVIDENCE_REQUIRED/);
 }
});
test('new scoped observation records inbox, listing state and outbox atomically',async()=>{
 const db=database(observation,null);
 assert.deepEqual(await reconcilePublication(db,sign(observation),key),{published:true});
 assert.equal(db.writes.length,3);
 assert.match(db.writes[0].sql,/INSERT INTO pod_provider_inbox/);
 assert.deepEqual(db.writes[0].args[4],observation);
 assert.match(db.writes[1].sql,/UPDATE pod_production_queue/);
 assert.match(db.writes[2].sql,/INSERT INTO pod_events/);
});
test('a new readback event for a published listing retains proof without publishing again',async()=>{
 const next={...observation,provider_event_id:'later-event',evidence_sha256:'c'.repeat(64)};
 const db=database(next,null,'published');
 assert.deepEqual(await reconcilePublication(db,sign(next),key),{published:true,already_published:true});
 assert.equal(db.writes.length,1);assert.match(db.writes[0].sql,/INSERT INTO pod_provider_inbox/);
});
test('published rows require their durable provider identity before accepting more evidence',async()=>{
 const next={...observation,provider_event_id:'later-event',evidence_sha256:'c'.repeat(64)};
 const db=database(next,null,'published',false,null);
 await assert.rejects(reconcilePublication(db,sign(next),key),/LISTING_SCOPE_INVALID/);
 assert.equal(db.writes.length,0);
});
test('oversized listing identities fail before database access',async()=>{
 await assert.rejects(reconcilePublication({tx(){assert.fail('unexpected database access');}},
  sign({...observation,provider_id:'x'.repeat(257)}),key),/LISTING_EVIDENCE_REQUIRED/);
});

