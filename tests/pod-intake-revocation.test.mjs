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
 const request=(state,business='business')=>{
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   concept_id:'retry-concept',business_id:business,fingerprint:'same-concept-fingerprint',rights_state:state});
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
