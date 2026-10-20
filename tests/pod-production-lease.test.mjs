import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-review-key-'.repeat(3),job={id:'fixture-job',fencing_token:1};
const manifest={package_sha256:'a'.repeat(64),template_sha256:'b'.repeat(64)};
function qa(){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod:qa',issued_at_ms:Date.now()-1,
 expires_at_ms:Date.now()+60000,verdict:'PASS',...manifest,
 checks:Object.fromEntries(['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance','template_provenance'].map(k=>[k,true]))});
 return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};}
function fixture(valid){
 const writes=[],queries=[];
 const client={release(){},query:async sql=>{queries.push(sql);
  if(sql.includes('clock_timestamp()')&&sql.startsWith('SELECT'))return {rows:[{valid}]};
  if(sql.startsWith('SELECT'))return {rows:[{id:job.id,rights_state:'PASS',permanently_unpublished:false}]};
  if(/^(UPDATE|INSERT)/.test(sql)){writes.push(sql);return {rows:[{id:job.id}]};}
  return {rows:[]};}};
 const db=new PodDB({pool:{connect:async()=>client},bridge,qaKey:key,expiresAt:'2099-01-01T00:00:00Z'});
 return {db,writes,queries};
}
for(const valid of [true,false])test('production stage guard checks live lease after locks: '+valid,async()=>{
 const f=fixture(valid);
 if(valid)assert.equal(await f.db.assertProducible({...job,account_id:'fixture-account',platform:'redbubble'}),true);
 else await assert.rejects(f.db.assertProducible(job),/LOCAL_PRODUCTION_BLOCKED/);
 assert.equal(f.writes.length,0);
 const lock=f.queries.findIndex(q=>q.includes('FOR SHARE OF q,p'));
 const clock=f.queries.findIndex(q=>q.startsWith('SELECT')&&q.includes('clock_timestamp()'));
 assert.ok(lock>=0&&clock>lock);
 assert.equal(f.queries.at(-1),valid?'COMMIT':'ROLLBACK');
});
for(const [label,run] of [
 ['failure',(db)=>db.failProduction(job,'QA_FAILED')],
 ['review hold',(db)=>db.holdProduction(job,manifest)],
 ['successful completion',(db)=>db.completeProduction(job,manifest,qa())]
]){
 test('expired production lease blocks '+label+' without writes',async()=>{
  const f=fixture(false);await assert.rejects(run(f.db),/LEASE_LOST/);
  assert.equal(f.writes.length,0);assert.equal(f.queries.at(-1),'ROLLBACK');
 });
 test('valid production lease permits '+label,async()=>{
  const f=fixture(true);await run(f.db);assert.ok(f.writes.length>0);
  const lock=f.queries.findIndex(q=>q.includes('FOR UPDATE'));
  const clock=f.queries.findIndex(q=>q.startsWith('SELECT')&&q.includes('clock_timestamp()'));
  assert.ok(lock>=0&&clock>lock);assert.equal(f.queries.at(-1),'COMMIT');
 });
}
