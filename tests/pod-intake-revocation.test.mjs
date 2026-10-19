import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';

const key='synthetic-intake-key-'.repeat(3);
function fixture({rights_state='PASS',permanently_unpublished=false}={}){
 const concept={id:'existing-concept',business_id:'business',rights_state,permanently_unpublished};
 const writes=[];
 const db=new PodDB({bridge:{producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}},
  expiresAt:new Date(Date.now()+7*86400000).toISOString()});
 db.tx=async fn=>fn({query:async(sql,params)=>{
  if(sql.startsWith('SELECT id FROM pod_concepts'))return {rows:[{id:concept.id}]};
  if(sql.includes('FROM pod_concepts WHERE fingerprint'))return {rows:[{...concept}]};
  if(sql.startsWith('UPDATE pod_concepts')){
   writes.push({sql,params});concept.rights_state=params[1];concept.permanently_unpublished=true;return {rowCount:1,rows:[]};
  }
  if(sql.startsWith('INSERT INTO pod_events')){writes.push({sql,params});return {rowCount:1,rows:[]};}
  if(sql.includes('pod_daily_concept_budget'))throw Error('duplicate must not consume budget');
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  throw Error('Unexpected query');
 }});
 const request=(state,business='business',fingerprint='same-concept-fingerprint')=>{
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   concept_id:'retry-concept',business_id:business,fingerprint,rights_state:state});
  return {id:'retry-concept',businessId:business,intakeKey:key,envelope:{payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}};
 };
 return {db,concept,writes,request};
}
for(const state of ['FAIL','UNKNOWN'])test(`duplicate ${state} evidence revokes an existing PASS concept`,async()=>{
 const f=fixture();const result=await f.db.registerIntake(f.request(state));
 assert.equal(result.id,f.concept.id);assert.equal(f.concept.rights_state,state);assert.equal(f.concept.permanently_unpublished,true);
 assert.equal(f.writes.filter(w=>w.sql.startsWith('UPDATE pod_concepts')).length,1);
 assert.equal(f.writes.filter(w=>w.sql.startsWith('INSERT INTO pod_events')).length,1);
});
test('already tombstoned concepts remain unchanged under PASS or other denial retries',async()=>{
 const f=fixture({rights_state:'UNKNOWN',permanently_unpublished:true});
 for(const state of ['PASS','UNKNOWN','FAIL'])assert.equal((await f.db.registerIntake(f.request(state))).id,f.concept.id);
 assert.equal(f.concept.rights_state,'UNKNOWN');assert.equal(f.writes.length,0);
});
test('PASS duplicate is idempotent and consumes no additional concept budget',async()=>{
 const f=fixture();assert.deepEqual(await f.db.registerIntake(f.request('PASS')),{id:f.concept.id});assert.equal(f.writes.length,0);
});
test('matching fingerprint cannot return or mutate another business concept',async()=>{
 const f=fixture();await assert.rejects(f.db.registerIntake(f.request('UNKNOWN','other-business')),/INTAKE_FINGERPRINT_CONFLICT/);
 assert.equal(f.concept.rights_state,'PASS');assert.equal(f.writes.length,0);
});

for(const [name,values] of [['non-string',[1,true,[],['fingerprint'],{},null]],['blank',['',' ','\t\n','\u2003']]]){
 test(`${name} fingerprint is rejected before database admission`,async()=>{
  const f=fixture();let calls=0;f.db.tx=async()=>{calls++;throw Error('UNEXPECTED_DATABASE_ACCESS');};
  for(const fingerprint of values)await assert.rejects(f.db.registerIntake(f.request('UNKNOWN','business',fingerprint)),/^Error: INTAKE_SCOPE_INVALID$/);
  assert.equal(calls,0);assert.equal(f.writes.length,0);assert.equal(f.concept.rights_state,'PASS');
 });
}
test('opaque string fingerprint reaches deduplication without trimming or normalization',async()=>{
 const f=fixture(),original=f.db.tx,seen=[],fingerprint='  résumé / 😀 / "opaque"  ';
 f.db.tx=fn=>original(client=>fn({query:async(sql,args)=>{
  if(sql.includes('pg_advisory_xact_lock')||sql.includes('WHERE fingerprint'))seen.push(args[0]);
  return client.query(sql,args);
 }}));
 const request=f.request('PASS','business',fingerprint);
 assert.deepEqual(await f.db.registerIntake(request),{id:f.concept.id});
 assert.deepEqual(seen,[fingerprint,fingerprint]);assert.equal(f.writes.length,0);
 assert.equal(JSON.parse(request.envelope.payload).fingerprint,fingerprint);
});
test('fingerprint admission still authenticates the original envelope first',async()=>{
 const f=fixture(),request=f.request('UNKNOWN','business',1);
 request.envelope.signature='0'.repeat(64);
 f.db.tx=async()=>assert.fail('database must not be reached');
 await assert.rejects(f.db.registerIntake(request),/^Error: SIGNATURE_INVALID$/);
});

for(const [name,values] of [
 ['unpaired surrogate',['prefix-\ud800','prefix-\udfff','prefix-\ud800x','prefix-\udfff\ud800']],
 ['NUL',['prefix-\u0000','\u0000prefix']]
])test(`${name} fingerprint is rejected before transaction or lock acquisition`,async()=>{
 const f=fixture();let calls=0;f.db.tx=async()=>{calls++;throw Error('UNEXPECTED_DATABASE_ACCESS');};
 for(const fingerprint of values)await assert.rejects(f.db.registerIntake(f.request('UNKNOWN','business',fingerprint)),/^Error: INTAKE_SCOPE_INVALID$/);
 assert.equal(calls,0);assert.equal(f.concept.rights_state,'PASS');assert.equal(f.writes.length,0);
});
test('literal replacement characters and paired Unicode remain exact fingerprint text',async()=>{
 for(const fingerprint of ['prefix-\ufffd','prefix-\ud800\udc00','prefix-\udbff\udfff',' e\u0301 / é ']){
  const f=fixture(),original=f.db.tx,seen=[];
  f.db.tx=fn=>original(client=>fn({query:async(sql,args)=>{
   if(sql.includes('pg_advisory_xact_lock')||sql.includes('WHERE fingerprint'))seen.push(args[0]);
   return client.query(sql,args);
  }}));
  assert.deepEqual(await f.db.registerIntake(f.request('PASS','business',fingerprint)),{id:f.concept.id});
  assert.deepEqual(seen,[fingerprint,fingerprint]);assert.equal(f.writes.length,0);
 }
});
