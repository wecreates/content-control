import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const bridge={producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}};
const key='synthetic-intake-budget-key-'.repeat(2);
function fixture(days,{duplicate=false,full=false,budgetResult,conceptResult,clockResult}={}){
 const queries=[],payload=JSON.stringify({schema_version:1,audience:'content-control:pod:intake',issued_at_ms:Date.now()-1,
  expires_at_ms:Date.now()+60000,concept_id:'concept',business_id:'business',fingerprint:'fingerprint',rights_state:'PASS'});
 const client={release(){},query:async(sql,args=[])=>{
  if(typeof sql!=='string'){args=sql.values??args;sql=sql.text;}
  queries.push({sql,args});
  if(sql.includes('AS budget_day'))return clockResult??{rows:[{budget_day:days.shift()}]};
  if(sql.includes('FROM pod_concepts WHERE fingerprint'))return {rows:duplicate?[{id:'existing',business_id:'business',rights_state:'PASS',permanently_unpublished:false}]:[]};
  if(sql.startsWith('UPDATE pod_daily_concept_budget'))return budgetResult??(full?{rowCount:0,rows:[]}:
   {rowCount:1,rows:[{business_id:'business',day:args[1],within_limit:true}]});
  if(sql.startsWith('INSERT INTO pod_concepts'))return conceptResult??{rowCount:1,rows:[{
   id:args[0],business_id:args[1],fingerprint:args[2],rights_state:args[3],permanently_unpublished:args[4]}]};
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
 assert.equal(f.queries.at(-2).sql,'COMMIT');
});
test('UTC rollover during registration rolls back instead of charging a stale day',async()=>{
 const f=fixture(['2026-10-16','2026-10-17']);await assert.rejects(f.run(),/CONCEPT_BUDGET_DAY_CHANGED/);
 assert.equal(f.queries.at(-2).sql,'ROLLBACK');assert.ok(!f.queries.some(q=>q.sql==='COMMIT'));
});
test('missing database clock and exhausted budget fail closed',async()=>{
 for(const [days,options,reason] of [[[],{},/CONCEPT_BUDGET_CLOCK_INVALID/],[['2026-10-16'],{full:true},/DAILY_CONCEPT_LIMIT/]]){
  const f=fixture(days,options);await assert.rejects(f.run(),reason);assert.equal(f.queries.at(-2).sql,'ROLLBACK');
  assert.ok(!f.queries.some(q=>q.sql.startsWith('INSERT INTO pod_concepts')));
 }
});
for(const variant of [
 {name:'result rows accessor',make:probes=>Object.defineProperty({},'rows',{get(){probes.push('result rows accessor');return [{budget_day:'2026-10-17'}];}})},
 {name:'rows Proxy',make:probes=>({rows:new Proxy([{budget_day:'2026-10-17'}],{get(target,key,receiver){probes.push('rows Proxy');return Reflect.get(target,key,receiver);}})})},
 {name:'row field accessor',make:probes=>({rows:[Object.defineProperty({},'budget_day',{enumerable:true,get(){probes.push('row field accessor');return '2026-10-17';}})]})},
 {name:'row Proxy',make:probes=>({rows:[new Proxy({budget_day:'2026-10-17'},{get(target,key,receiver){probes.push('row Proxy');return Reflect.get(target,key,receiver);}})]})},
])test(`database budget clock rejects ${variant.name} without executing it`,async()=>{
 const probes=[],f=fixture([],{clockResult:variant.make(probes)});
 await assert.rejects(f.run(),error=>error?.message==='POD_QUERY_UNVERIFIED');
 assert.deepEqual(probes,[]);
 assert.ok(!f.queries.some(q=>q.sql.includes('pod_daily_concept_budget')||q.sql.startsWith('INSERT INTO pod_concepts')));
});
test('a duplicate keeps its identity without consuming a new daily budget',async()=>{
 const f=fixture([],{duplicate:true});assert.deepEqual(await f.run(),{id:'existing'});
 assert.ok(!f.queries.some(q=>q.sql.includes('pod_daily_concept_budget')||q.sql.includes('AS budget_day')));
});

test('new concept admission requires exact inert budget and concept mutation proof',async()=>{
 const probes=[];
 const exactBudget={rowCount:1,rows:[{business_id:'business',day:'2026-10-17',within_limit:true}]};
 const exactConcept={rowCount:1,rows:[{id:'concept',business_id:'business',fingerprint:'fingerprint',rights_state:'PASS',permanently_unpublished:false}]};
 const variants=[
  {name:'budget missing row count',options:{budgetResult:{rows:exactBudget.rows}}},
  {name:'budget empty without row count',options:{budgetResult:{rows:[]}}},
  {name:'budget mismatched identity',options:{budgetResult:{rowCount:1,rows:[{...exactBudget.rows[0],business_id:'other'}]}}},
  {name:'budget extra field',options:{budgetResult:{rowCount:1,rows:[{...exactBudget.rows[0],used:1}]}}},
  {name:'budget result accessor',options:{budgetResult:Object.defineProperty({rowCount:1},'rows',{get(){probes.push('budget accessor');return exactBudget.rows;}})}},
  {name:'budget rows Proxy',options:{budgetResult:{rowCount:1,rows:new Proxy(exactBudget.rows,{get(target,key,receiver){probes.push('budget rows Proxy');return Reflect.get(target,key,receiver);}})}}},
  {name:'budget row Proxy',options:{budgetResult:{rowCount:1,rows:[new Proxy(exactBudget.rows[0],{get(target,key,receiver){probes.push('budget row Proxy');return Reflect.get(target,key,receiver);}})]}}},
  {name:'concept missing row count',options:{budgetResult:exactBudget,conceptResult:{rows:exactConcept.rows}}},
  {name:'concept mismatched identity',options:{budgetResult:exactBudget,conceptResult:{rowCount:1,rows:[{...exactConcept.rows[0],id:'other'}]}}},
  {name:'concept extra field',options:{budgetResult:exactBudget,conceptResult:{rowCount:1,rows:[{...exactConcept.rows[0],created:true}]}}},
  {name:'concept result accessor',options:{budgetResult:exactBudget,conceptResult:Object.defineProperty({rowCount:1},'rows',{get(){probes.push('concept accessor');return exactConcept.rows;}})}},
  {name:'concept rows Proxy',options:{budgetResult:exactBudget,conceptResult:{rowCount:1,rows:new Proxy(exactConcept.rows,{get(target,key,receiver){probes.push('concept rows Proxy');return Reflect.get(target,key,receiver);}})}}},
  {name:'concept row Proxy',options:{budgetResult:exactBudget,conceptResult:{rowCount:1,rows:[new Proxy(exactConcept.rows[0],{get(target,key,receiver){probes.push('concept row Proxy');return Reflect.get(target,key,receiver);}})]}}},
 ];
 for(const variant of variants){
  const f=fixture(['2026-10-17','2026-10-17'],variant.options);
  await assert.rejects(f.run(),error=>error?.message==='POD_MUTATION_UNVERIFIED',variant.name);
 }
 assert.deepEqual(probes,[]);
});
