import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-intake-budget-key-'.repeat(2);
function fixture(days,{duplicate=false,full=false}={}){
 const queries=[],payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,concept_id:'concept',business_id:'business',fingerprint:'fingerprint',rights_state:'PASS'});
 const client={release(){},query:async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.includes('AS budget_day'))return {rows:[{budget_day:days.shift()}]};
  if(sql.includes('FROM pod_concepts WHERE fingerprint'))return {rows:duplicate?[{id:'existing',business_id:'business',permanently_unpublished:false}]:[]};
  if(sql.startsWith('UPDATE pod_daily_concept_budget'))return {rows:full?[]:[{used:1}]};
  return {rows:[]};
 }};
 const db=new PodDB({pool:{connect:async()=>client},bridge,expiresAt:'2099-01-01T00:00:00Z'});
 const run=()=>db.registerIntake({id:'concept',businessId:'business',intakeKey:key,dailyLimit:100,
  envelope:{payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}});
 return {run,queries};
}
test('budget day is selected after the business lock and passed explicitly to both writes',async()=>{
 const f=fixture(['2026-10-17','2026-10-17']);await f.run();
 const lock=f.queries.findIndex(q=>q.args[0]==='pod:concept-budget:business');
 const clock=f.queries.findIndex(q=>q.sql.includes('AS budget_day'));
 assert.ok(lock>=0&&clock>lock);
 const insert=f.queries.find(q=>q.sql.startsWith('INSERT INTO pod_daily_concept_budget'));
 const update=f.queries.find(q=>q.sql.startsWith('UPDATE pod_daily_concept_budget'));
 assert.deepEqual(insert.args,['business','2026-10-17']);assert.deepEqual(update.args,['business','2026-10-17',100]);
 assert.ok(!insert.sql.includes('now()')&&!update.sql.includes('now()'));
 assert.match(f.queries.find(q=>q.sql.startsWith('INSERT INTO pod_concepts')).sql,/clock_timestamp\(\)/);
 assert.equal(f.queries.at(-1).sql,'COMMIT');
});
test('UTC rollover during registration rolls back instead of charging a stale day',async()=>{
 const f=fixture(['2026-10-16','2026-10-17']);await assert.rejects(f.run(),/CONCEPT_BUDGET_DAY_CHANGED/);
 assert.equal(f.queries.at(-1).sql,'ROLLBACK');assert.ok(!f.queries.some(q=>q.sql==='COMMIT'));
});
test('missing database clock and exhausted budget fail closed',async()=>{
 for(const [days,options,reason] of [[[],{},/CONCEPT_BUDGET_CLOCK_INVALID/],[['2026-10-16'],{full:true},/DAILY_CONCEPT_LIMIT/]]){
  const f=fixture(days,options);await assert.rejects(f.run(),reason);assert.equal(f.queries.at(-1).sql,'ROLLBACK');
  assert.ok(!f.queries.some(q=>q.sql.startsWith('INSERT INTO pod_concepts')));
 }
});
test('a duplicate keeps its identity without consuming a new daily budget',async()=>{
 const f=fixture([],{duplicate:true});assert.deepEqual(await f.run(),{id:'existing'});
 assert.ok(!f.queries.some(q=>q.sql.includes('pod_daily_concept_budget')||q.sql.includes('AS budget_day')));
});
