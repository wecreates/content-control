import test from 'node:test';
import assert from 'node:assert/strict';
import {productionActivity} from '../integrations/pod/capacity.mjs';
function fixture(patch={}){
 const row={window_start:'2026-10-15T00:00:00Z',window_end:'2026-10-16T00:00:00Z',
  registered_concept_records:'1000',generated_concept_records:'1000',generated_jobs:'4000',
  generated_package_hashes:'3000',jobs_with_pass_event:'1500',jobs_with_fail_event:'20',...patch};
 const queries=[],released=[];
 const db={active(){throw Error('POD_STORAGE_EXPIRING');},pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);if(sql.startsWith('BEGIN '))return {command:'BEGIN'};
   if(sql==='ROLLBACK')return {command:'ROLLBACK'};
   return sql==='COMMIT'?{command:'COMMIT'}:{rows:sql.startsWith('WITH')?[row]:[]};},release:bad=>released.push(bad)
 })}};
 return {db,queries,released};
}
test('activity counts against the exact millisecond window returned by the driver',async()=>{
 const f=fixture();await productionActivity(f.db);
 const sql=f.queries.find(q=>q.startsWith('WITH'));
 assert.match(sql,/date_trunc\('milliseconds',transaction_timestamp\(\)\) AS finish/);
 assert.match(sql,/date_trunc\('milliseconds',transaction_timestamp\(\)\)-interval '24 hours' AS start/);
});
test('capacity never reads a snapshot when the read-only start is unverified',async()=>{
 const queries=[],releases=[];
 const db={pool:{connect:async()=>({query:async sql=>{queries.push(sql);return {command:'SELECT'};},
  release:bad=>releases.push(bad)})}};
 await assert.rejects(productionActivity(db),/^Error: POD_BEGIN_UNVERIFIED$/);
 assert.deepEqual(queries,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);assert.deepEqual(releases,[true]);
});
test('recorded activity refuses an unverified commit and discards the connection',async()=>{
 let commandReads=0;
 for(const outcome of [{command:'ROLLBACK'},undefined,Object.create({command:'COMMIT'}),
  {get command(){commandReads++;return 'COMMIT';}},Object.assign([],{command:'COMMIT'})]){
  const f=fixture(),client=await f.db.pool.connect(),query=client.query.bind(client);
  client.query=async sql=>{if(sql==='COMMIT'){f.queries.push(sql);return outcome;}return query(sql);};
  f.db.pool.connect=async()=>client;
  await assert.rejects(productionActivity(f.db),/^Error: POD_COMMIT_UNVERIFIED$/);
  assert.equal(f.queries.at(-1),'COMMIT');assert.equal(f.queries.includes('ROLLBACK'),false);assert.deepEqual(f.released,[true]);
 }
 assert.equal(commandReads,0);
});
test('meeting numeric targets never manufactures measured capacity or launch acceptance',async()=>{
 const f=fixture({generated_jobs:'9007199254740993'}),r=await productionActivity(f.db);
 assert.equal(r.counts.generated_jobs,'9007199254740993');assert.equal(r.counts.generated_concept_records,'1000');
 assert.equal(r.capacity_verified,false);assert.equal(r.acceptance_verified,false);assert.equal(r.publication_enabled,false);
 assert.equal(r.window.hours,24);assert.ok(r.evidence_limitations.includes('concept_records_do_not_prove_unique_artwork'));
 assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1),'COMMIT');
 assert.deepEqual(f.released,[false]);
});
test('capacity reporting rejects executable query results without invocation',async()=>{
 const row={window_start:'2026-10-15T00:00:00Z',window_end:'2026-10-16T00:00:00Z',
  registered_concept_records:'1',generated_concept_records:'1',generated_jobs:'1',
  generated_package_hashes:'1',jobs_with_pass_event:'1',jobs_with_fail_event:'0'};
 let reads=0;
 const resultProxy=value=>new Proxy(value,{get(object,property,receiver){
  if(property==='then')return undefined;reads++;return Reflect.get(object,property,receiver);
 }});
 const attempts=[
  Object.defineProperty({},'rows',{get(){reads++;throw Error('CAPACITY_ROWS_GETTER_EXECUTED');}}),
  resultProxy({rows:[row]}),
  {rows:new Proxy([row],{get(object,property,receiver){reads++;return Reflect.get(object,property,receiver);}})},
  {rows:Object.defineProperty([],'0',{enumerable:true,get(){reads++;throw Error('CAPACITY_ROW_GETTER_EXECUTED');}})},
  {rows:[new Proxy(row,{get(object,property,receiver){reads++;return Reflect.get(object,property,receiver);}})]},
  {rows:[Object.defineProperty({...row},'generated_jobs',{enumerable:true,get(){reads++;throw Error('CAPACITY_FIELD_GETTER_EXECUTED');}})]},
  {rows:[]},{rows:new Array(1)},{rows:[row,row]},
 ];
 for(const result of attempts){
  let released;
  const db={pool:{connect:async()=>({
   query:async sql=>sql.startsWith('BEGIN ')?{command:'BEGIN'}:sql==='ROLLBACK'?{command:'ROLLBACK'}:sql.startsWith('WITH')?result:{rows:[]},
   release:bad=>{released=bad},
  })}};
  await assert.rejects(productionActivity(db),/^Error: CAPACITY_REPORT_INVALID$/);
  assert.equal(released,false);
 }
 assert.equal(reads,0);
});
for(const failure of ['throw','reject','stall'])test('activity cannot return success after '+failure+' from release',async()=>{
 const f=fixture(),client=await f.db.pool.connect(),controller=new AbortController();let calls=0;
 client.release=bad=>{calls++;assert.equal(bad,false);
  if(failure==='throw')throw Error('private release failure');
  if(failure==='reject'){const rejected=Promise.reject(Error('private release failure'));rejected.catch(()=>{});return rejected;}
  controller.abort();return new Promise(()=>{});
 };
 f.db.pool.connect=async()=>client;
 await assert.rejects(productionActivity(f.db,{signal:controller.signal}),
  failure==='stall'?/POD_DIAGNOSTIC_TIMEOUT/:/private release failure/);
 assert.equal(calls,1);assert.equal(f.queries.at(-1),'COMMIT');
});
test('activity waits for successful asynchronous release before returning unverified evidence',async()=>{
 const f=fixture(),client=await f.db.pool.connect();let complete,settled=false;
 client.release=()=>new Promise(resolve=>{complete=resolve;});f.db.pool.connect=async()=>client;
 const task=productionActivity(f.db).then(value=>{settled=true;return value;});
 while(!complete)await new Promise(r=>setImmediate(r));
 try{assert.equal(settled,false);}finally{complete();}
 const report=await task;assert.equal(report.capacity_verified,false);assert.equal(report.acceptance_verified,false);
 assert.equal(report.publication_enabled,false);
});
test('activity consumes asynchronous late-client destruction failure after cancelled acquisition',async()=>{
 const controller=new AbortController();let complete,consumed=0;
 const task=productionActivity({pool:{connect:()=>new Promise(resolve=>{complete=resolve;})}},{signal:controller.signal});
 controller.abort();await assert.rejects(task,/POD_DIAGNOSTIC_TIMEOUT/);
 complete({release:bad=>{assert.equal(bad,true);return {then(_resolve,reject){consumed++;reject(Error('private late release'));}};}});
 await new Promise(r=>setImmediate(r));assert.equal(consumed,1);
});
test('malformed counts and observation windows fail closed',async()=>{
 for(const patch of [{generated_jobs:5},{generated_jobs:'-1'},{generated_jobs:'1e3'},
  {window_start:'invalid'},{window_end:'2026-10-17T00:00:00Z'}]){
  const f=fixture(patch);await assert.rejects(productionActivity(f.db),/CAPACITY_REPORT_INVALID/);
  assert.equal(f.queries.at(-1),'ROLLBACK');assert.deepEqual(f.released,[false]);
 }
});
test('activity rejects normalized or ambiguous timestamp strings even for a 24-hour window',async()=>{
 for(const [window_start,window_end] of [
  ['2026-02-30T00:00:00Z','2026-02-31T00:00:00Z'],
  ['2026-10-15','2026-10-16'],
  ['2026-10-15T00:00:00','2026-10-16T00:00:00'],
  ['2026-10-15T24:00:00Z','2026-10-16T24:00:00Z'],
  ['2026-10-15T00:00:00+00:00','2026-10-16T00:00:00+00:00'],
  ['2026-10-15T00:00:00.000001Z','2026-10-16T00:00:00.000002Z'],
 ]){
  const f=fixture({window_start,window_end});
  await assert.rejects(productionActivity(f.db),/^Error: CAPACITY_REPORT_INVALID$/);
  assert.equal(f.queries.at(-1),'ROLLBACK');assert.deepEqual(f.released,[false]);
 }
});
test('activity preserves canonical UTC milliseconds and native database Date instants',async()=>{
 for(const date of [value=>value,value=>new Date(value)]){
  const f=fixture({window_start:date('2026-10-15T00:00:00.123Z'),window_end:date('2026-10-16T00:00:00.123Z')});
  const report=await productionActivity(f.db);
  assert.equal(report.window.start,'2026-10-15T00:00:00.123Z');
  assert.equal(report.window.end,'2026-10-16T00:00:00.123Z');
  assert.equal(report.capacity_verified,false);assert.equal(report.acceptance_verified,false);
  assert.equal(report.publication_enabled,false);assert.equal(f.queries.at(-1),'COMMIT');
 }
});
for(const wrongTag of [false,true])test('failed rollback discards the connection and preserves the original failure; wrong tag='+wrongTag,async()=>{
 const releases=[];
 const db={pool:{connect:async()=>({query:async sql=>{if(sql.startsWith('WITH'))throw Error('original');if(sql==='ROLLBACK'){if(wrongTag)return {command:'SELECT'};throw Error('rollback');}return sql.startsWith('BEGIN ')?{command:'BEGIN'}:{rows:[]};},release:bad=>releases.push(bad)})}};
 await assert.rejects(productionActivity(db),/^Error: original$/);assert.deepEqual(releases,[true]);
});
test('capacity reporting discards an uncertain connection when transaction open fails',async()=>{
 const original=Error('BEGIN_FAILURE'),queries=[],releases=[];
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);throw original;},
  release:bad=>releases.push(bad),
 })}};
 await assert.rejects(productionActivity(db),error=>error===original);
 assert.deepEqual(queries,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);
 assert.deepEqual(releases,[true]);
});
test('capacity reporting discards an uncertain connection when commit fails',async()=>{
 const original=Error('COMMIT_FAILURE'),queries=[],releases=[];
 const row={window_start:'2026-10-15T00:00:00Z',window_end:'2026-10-16T00:00:00Z',
  registered_concept_records:'1',generated_concept_records:'1',generated_jobs:'1',generated_package_hashes:'1',
  jobs_with_pass_event:'1',jobs_with_fail_event:'0'};
 const db={pool:{connect:async()=>({query:async sql=>{queries.push(sql);if(sql==='COMMIT')throw original;
  return sql.startsWith('BEGIN ')?{command:'BEGIN'}:{rows:sql.startsWith('WITH')?[row]:[]};},release:bad=>releases.push(bad)})}};
 await assert.rejects(productionActivity(db),error=>error===original);
 assert.equal(queries.at(-1),'COMMIT');assert.equal(queries.includes('ROLLBACK'),false);
 assert.deepEqual(releases,[true]);
});
test('capacity reporting aborts a stalled diagnostic query and discards its client',async()=>{
 const controller=new AbortController(),queries=[],releases=[];
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);if(sql.startsWith('WITH'))return new Promise(()=>{});return sql.startsWith('BEGIN ')?{command:'BEGIN'}:{rows:[]};},
  release:bad=>releases.push(bad),
 })}};
 const result=productionActivity(db,{signal:controller.signal});
 while(!queries.some(sql=>sql.startsWith('WITH')))await new Promise(resolve=>setImmediate(resolve));
 controller.abort();
 await assert.rejects(result,/^Error: POD_DIAGNOSTIC_TIMEOUT$/);
 assert.equal(queries.includes('ROLLBACK'),false);assert.deepEqual(releases,[true]);
});
