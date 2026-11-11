import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {operationalHealth} from '../integrations/pod/operational-health.mjs';
import {metrics} from '../integrations/pod/metrics.mjs';
import {operationsSnapshot} from '../scripts/pod_operations_snapshot.mjs';
const now=Date.parse('2026-01-01T00:00:00Z');
const healthy={now,expiresAt:now+8*86400000,artifactBytes:'0',expiredLeases:'0',unverifiedLeases:'0',pendingEvents:'0',oldestEventSeconds:'0',env:{POD_ARTIFACT_BUDGET_BYTES:'100'}};
test('operational snapshots reject invalid wall clocks with a fixed error',()=>{
 for(const clock of [NaN,Infinity,-1,0.5,8640000000000001,Number.MAX_SAFE_INTEGER+1,'0'])
  assert.throws(()=>operationalHealth({...healthy,now:clock}),/OPERATIONAL_CLOCK_INVALID/);
});
for(const [delta,lifetime,code] of [[0,'EXPIRED','STORAGE_EXPIRED'],[-1,'EXPIRED','STORAGE_EXPIRED'],
 [86400000,'BLOCKED','STORAGE_EXPIRING'],[86400001,'WARNING','STORAGE_EXPIRING_SOON'],[7*86400000,'WARNING','STORAGE_EXPIRING_SOON'],
 [7*86400000+1,'OK',null]])test('storage lifetime boundary '+delta,()=>{
 const report=operationalHealth({...healthy,expiresAt:now+delta});
 assert.equal(report.storage.lifetime,lifetime);assert.deepEqual(report.alerts.map(a=>a.code),code?[code]:[]);
 assert.equal(report.acceptance_verified,false);assert.equal(report.publication_enabled,false);
});
test('unknown expiry or budget produces explicit critical alerts instead of healthy defaults',()=>{
 for(const expiresAt of [NaN,undefined,Infinity,'2030-01-01',-1,0.5,8640000000000001,Number.MAX_SAFE_INTEGER+1]){
  const report=operationalHealth({...healthy,expiresAt});assert.equal(report.storage.expires_at,null);assert.equal(report.status,'CRITICAL');
 }
 const report=operationalHealth({...healthy,env:{POD_ARTIFACT_BUDGET_BYTES:'invalid'}});
 assert.equal(report.storage.budget_bytes,null);assert.equal(report.storage.remaining_bytes,null);assert.equal(report.alerts[0].code,'ARTIFACT_BUDGET_UNKNOWN');
});
test('storage thresholds and large counters use exact integer arithmetic',()=>{
 assert.equal(operationalHealth({...healthy,artifactBytes:'89'}).status,'NO_ALERTS');
 assert.equal(operationalHealth({...healthy,artifactBytes:'90'}).alerts[0].code,'ARTIFACT_STORAGE_LOW');
 for(const artifactBytes of ['100','9007199254740993']){
  const r=operationalHealth({...healthy,artifactBytes});assert.equal(r.alerts[0].code,'ARTIFACT_STORAGE_EXHAUSTED');
  assert.equal(r.storage.artifact_bytes,artifactBytes);assert.equal(r.storage.remaining_bytes,'0');
 }
});
test('expired leases and overdue feedback are observable without inventing acceptance',()=>{
 const report=operationalHealth({...healthy,expiredLeases:'2',pendingEvents:'9007199254740993',oldestEventSeconds:'900'});
 assert.deepEqual(report.alerts.map(a=>a.code),['EXPIRED_WORKER_LEASES','OUTBOX_DELIVERY_OVERDUE']);
 assert.equal(report.outbox.pending,'9007199254740993');assert.equal(report.acceptance_verified,false);
 assert.equal(operationalHealth({...healthy,pendingEvents:'1',oldestEventSeconds:'899'}).status,'NO_ALERTS');
 assert.equal(operationalHealth({...healthy,pendingEvents:'0',oldestEventSeconds:'900'}).status,'NO_ALERTS');
 for(const artifactBytes of ['-1','1.2','1e3',null,1])assert.throws(()=>operationalHealth({...healthy,artifactBytes}),/OPERATIONAL_METRIC_INVALID/);
});
test('unverified leases produce a distinct critical alert even with no expired lease',()=>{
 const report=operationalHealth({...healthy,unverifiedLeases:'2'});
 assert.equal(report.status,'CRITICAL');
 assert.equal(report.expired_leases,'0');
 assert.equal(report.unverified_leases,'2');
 assert.deepEqual(report.alerts,[{code:'UNVERIFIED_WORKER_LEASES',severity:'critical'}]);
 assert.equal(report.acceptance_verified,false);
});
function fixture({fail=false,rollbackFails=false,wrongRollback=false}={}){
 const queries=[];let released,ended=false;
 const client={release:bad=>{released=bad;},query:async sql=>{
  sql=typeof sql==='string'?sql:sql.text;
  queries.push(sql);if(sql==='ROLLBACK'&&rollbackFails)throw Error('rollback unavailable');
  if(sql==='ROLLBACK')return {command:wrongRollback?'SELECT':'ROLLBACK'};
  if(sql.startsWith('BEGIN '))return {command:'BEGIN'};
  if(sql==='COMMIT')return {command:'COMMIT'};
  if(sql.includes('FROM public.pod_artifacts')){if(fail)throw Error('private database error');return {rows:[{bytes:'90'}]};}
  if(sql.includes('FROM public.pod_financial_events'))return {rows:[{currency:'USD',verified_net_recorded_minor:'9007199254740993',evidence_count:'1'}]};
  if(sql.includes('GROUP BY platform'))return {rows:[{platform:'redbubble',state:'raw',count:'1'}]};
  if(sql.includes('FROM public.pod_events'))return {rows:[{count:'1',oldest_seconds:'900'}]};
  if(sql.includes('AS unverified_count'))return {rows:[{count:'0',unverified_count:'1'}]};
  if(sql.startsWith('SELECT'))return {rows:[{count:'0'}]};
  return {rows:[]};
 }};
 return {queries,get released(){return released;},get ended(){return ended;},
  db:{active(){throw Error('POD_STORAGE_EXPIRING');},expiresAt:now+3600000,pool:{connect:async()=>client,end:async()=>{ended=true;}}}};
}
test('metrics never reads a snapshot when the read-only start is unverified',async()=>{
 const f=fixture(),client=await f.db.pool.connect();
 client.query=async sql=>{f.queries.push(sql);return {command:'SELECT'};};
 await assert.rejects(metrics(f.db,{env:healthy.env,clock:()=>now}),/^Error: POD_BEGIN_UNVERIFIED$/);
 assert.deepEqual(f.queries,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);assert.equal(f.released,true);
});
test('metrics reject unverified commit results and discard the connection',async()=>{
 let commandReads=0;
 for(const outcome of [{command:'ROLLBACK'},undefined,Object.create({command:'COMMIT'}),
  {get command(){commandReads++;return 'COMMIT';}},Object.assign([],{command:'COMMIT'})]){
  const f=fixture(),client=await f.db.pool.connect(),query=client.query.bind(client);
  client.query=async sql=>{if(sql==='COMMIT'){f.queries.push(sql);return outcome;}return query(sql);};
  await assert.rejects(metrics(f.db,{env:healthy.env,clock:()=>now}),/^Error: POD_COMMIT_UNVERIFIED$/);
  assert.equal(f.queries.at(-1),'COMMIT');assert.equal(f.queries.includes('ROLLBACK'),false);assert.equal(f.released,true);
 }
 assert.equal(commandReads,0);
});
test('metrics remain read-only and available inside the write-blocking expiry window',async()=>{
 const f=fixture(),result=await metrics(f.db,{env:healthy.env,clock:()=>now});
 assert.equal(result.health.storage.lifetime,'BLOCKED');assert.equal(result.health.status,'CRITICAL');
 assert.equal(result.health.unverified_leases,'1');
 assert.equal(result.financials[0].verified_net_recorded_minor,'9007199254740993');
 assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1),'COMMIT');
 assert.ok(f.queries.every(q=>!/^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)/.test(q)));assert.equal(f.released,false);
 assert.throws(()=>f.db.active(),/POD_STORAGE_EXPIRING/);
});
test('metrics reject executable database results without invocation',async()=>{
 const stages=[
  ['states',{platform:'redbubble',state:'raw',count:'1'}],
  ['failures',{count:'0'}],
  ['storage',{bytes:'90'}],
  ['financials',{currency:'USD',verified_net_recorded_minor:'1',evidence_count:'1'}],
  ['leases',{count:'0',unverified_count:'0'}],
  ['events',{count:'0',oldest_seconds:'0'}],
 ];
 const stageFor=sql=>sql.includes('GROUP BY platform')?'states':sql.includes('AND NOT')?'failures':
  sql.includes('FROM public.pod_artifacts')?'storage':sql.includes('FROM public.pod_financial_events')?'financials':
  sql.includes('lease_until<=')?'leases':sql.includes('FROM public.pod_events')?'events':null;
 for(const [target,row] of stages){
  let reads=0;
  const resultProxy=value=>new Proxy(value,{get(object,property,receiver){
   if(property==='then')return undefined;reads++;return Reflect.get(object,property,receiver);
  }});
  const firstField=Object.keys(row)[0];
  const attempts=[
   Object.defineProperty({},'rows',{get(){reads++;throw Error('metric rows getter executed');}}),
   resultProxy({rows:[row]}),
   {rows:new Proxy([row],{get(object,property,receiver){reads++;return Reflect.get(object,property,receiver);}})},
   {rows:Object.defineProperty([],'0',{enumerable:true,get(){reads++;throw Error('metric row getter executed');}})},
   {rows:[new Proxy(row,{get(object,property,receiver){reads++;return Reflect.get(object,property,receiver);}})]},
   {rows:[Object.defineProperty({...row},firstField,{enumerable:true,get(){reads++;throw Error('metric field getter executed');}})]},
  ];
  for(const attempt of attempts){
   const queries=[];let released;
   const client={release:bad=>{released=bad;},query:async sql=>{
    sql=typeof sql==='string'?sql:sql.text;queries.push(sql);
    const stage=stageFor(sql);
    if(!stage)return sql.startsWith('BEGIN ')?{command:'BEGIN'}:sql==='ROLLBACK'?{command:'ROLLBACK'}:{rows:[]};
    if(stage===target)return attempt;
    const safe=stages.find(([name])=>name===stage)[1];
    return Object.assign(Object.create({driver_result:true}),{rows:[safe]});
   }};
   const db={expiresAt:now+8*86400000,pool:{connect:async()=>client}};
   await assert.rejects(metrics(db,{env:healthy.env,clock:()=>now}),/^Error: POD_METRICS_QUERY_UNVERIFIED$/);
   assert.equal(queries.at(-1),'ROLLBACK');assert.equal(released,false);
  }
  assert.equal(reads,0,target);
 }
});
for(const failure of ['throw','reject','stall'])test('metrics cannot return success after '+failure+' from client release',async()=>{
 const f=fixture(),client=await f.db.pool.connect(),controller=new AbortController();let attempts=0;
 client.release=bad=>{attempts++;assert.equal(bad,false);
  if(failure==='throw')throw Error('private release failure');
  if(failure==='reject'){const pending=Promise.reject(Error('private release failure'));pending.catch(()=>{});return pending;}
  controller.abort();return new Promise(()=>{});
 };
 await assert.rejects(metrics(f.db,{env:healthy.env,clock:()=>now,signal:controller.signal}),
  failure==='stall'?/POD_DIAGNOSTIC_TIMEOUT/:/private release failure/);
 assert.equal(attempts,1);assert.equal(f.queries.at(-1),'COMMIT');
});
test('metrics consume asynchronous rejection when destroying a late client',async()=>{
 const controller=new AbortController();let complete,consumed=0;
 const task=metrics({pool:{connect:()=>new Promise(resolve=>{complete=resolve;})}},{signal:controller.signal});
 controller.abort();await assert.rejects(task,/POD_DIAGNOSTIC_TIMEOUT/);
 complete({release:bad=>{assert.equal(bad,true);return {then(_resolve,reject){consumed++;reject(Error('private late release'));}};}});
 await new Promise(r=>setImmediate(r));assert.equal(consumed,1);
});
for(const failure of ['reject','stall'])test('manual snapshot closes owned pool after '+failure+' from client release',async()=>{
 const f=fixture(),client=await f.db.pool.connect(),controller=new AbortController();
 client.release=()=>{
  if(failure==='reject'){const pending=Promise.reject(Error('private release failure'));pending.catch(()=>{});return pending;}
  controller.abort();return new Promise(()=>{});
 };
 await assert.rejects(operationsSnapshot({connect:()=>f.db.pool,env:healthy.env,clock:()=>now,signal:controller.signal}),
  failure==='stall'?/POD_DIAGNOSTIC_TIMEOUT/:/private release failure/);
 assert.equal(f.ended,true);
});
for(const stage of ['commit','release','pool shutdown']){
 const prepare=async remaining=>{
  let current=now;const f=fixture(),client=await f.db.pool.connect(),query=client.query,release=client.release,end=f.db.pool.end;
  f.db.expiresAt=now+remaining;
  client.query=async sql=>{const result=await query(sql);if(stage==='commit'&&sql==='COMMIT')current++;return result;};
  client.release=async bad=>{release(bad);if(stage==='release')current++;};
  f.db.pool.end=async()=>{await end();if(stage==='pool shutdown')current++;};
  const invoke=()=>stage==='pool shutdown'?operationsSnapshot({env:{...healthy.env,POD_STORAGE_EXPIRES_AT:new Date(f.db.expiresAt).toISOString()},
   clock:()=>current,connect:()=>f.db.pool}):metrics(f.db,{env:healthy.env,clock:()=>current});
  return {f,invoke,setClock:value=>{current=value;},client};
 };
 for(const [remaining,lifetime] of [[86400001,'BLOCKED'],[1,'EXPIRED']])test('storage alerts reflect '+stage+' crossing '+lifetime,async()=>{
  const {f,invoke}=await prepare(remaining),report=await invoke();
  assert.equal(report.health.storage.lifetime,lifetime);assert.equal(report.health.observed_at,new Date(now+1).toISOString());
  assert.equal(report.health.acceptance_verified,false);assert.equal(report.publication_enabled,false);
  assert.equal(f.released,false);if(stage==='pool shutdown')assert.equal(f.ended,true);
 });
 test('invalid clock after '+stage+' cannot return stale health',async()=>{
  const {f,invoke,setClock,client}=await prepare(86400001);
  if(stage==='commit'){const query=client.query;client.query=async sql=>{const result=await query(sql);if(sql==='COMMIT')setClock(NaN);return result;};}
  if(stage==='release'){const release=client.release;client.release=async bad=>{await release(bad);setClock(NaN);};}
  if(stage==='pool shutdown'){const end=f.db.pool.end;f.db.pool.end=async()=>{await end();setClock(NaN);};}
  await assert.rejects(invoke(),/^Error: OPERATIONAL_CLOCK_INVALID$/);
  assert.equal(f.released,false);if(stage==='pool shutdown')assert.equal(f.ended,true);
 });
}
test('metrics errors roll back and discard a connection if rollback itself fails',async()=>{
 for(const [rollbackFails,wrongRollback] of [[false,false],[true,false],[false,true]]){
  const f=fixture({fail:true,rollbackFails,wrongRollback});await assert.rejects(metrics(f.db),/private database error/);
  assert.equal(f.queries.at(-1),'ROLLBACK');assert.equal(f.released,rollbackFails||wrongRollback);assert.ok(!f.queries.includes('COMMIT'));
 }
});
test('metrics discard an uncertain connection when transaction open fails',async()=>{
 const original=Error('BEGIN_FAILURE'),queries=[],releases=[];
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);throw original;},
  release:bad=>releases.push(bad),
 })}};
 await assert.rejects(metrics(db),error=>error===original);
 assert.deepEqual(queries,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);
 assert.deepEqual(releases,[true]);
});
test('metrics discard an uncertain connection when commit fails',async()=>{
 const f=fixture(),original=Error('COMMIT_FAILURE'),client=await f.db.pool.connect(),query=client.query.bind(client);
 client.query=async sql=>{if(sql==='COMMIT'){f.queries.push(sql);throw original;}return query(sql);};
 await assert.rejects(metrics(f.db,{env:healthy.env,clock:()=>now}),error=>error===original);
 assert.equal(f.queries.at(-1),'COMMIT');assert.equal(f.queries.includes('ROLLBACK'),false);assert.equal(f.released,true);
});
test('metrics abort a stalled diagnostic transaction and discard its client',async()=>{
 const controller=new AbortController(),queries=[],releases=[];let entered;
 const stalled=new Promise(resolve=>{entered=resolve;}).then(()=>new Promise(()=>{}));
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);if(sql.includes('GROUP BY platform'))return stalled;return sql.startsWith('BEGIN ')?{command:'BEGIN'}:{rows:[]};},
  release:bad=>releases.push(bad),
 })}};
 const result=metrics(db,{signal:controller.signal});
 while(!queries.some(sql=>sql.includes('GROUP BY platform')))await new Promise(resolve=>setImmediate(resolve));
 entered();controller.abort();
 await assert.rejects(result,/^Error: POD_DIAGNOSTIC_TIMEOUT$/);
 assert.equal(queries.includes('ROLLBACK'),false);assert.deepEqual(releases,[true]);
});
test('metrics abort a stalled pool acquisition and destroy a late client',async()=>{
 const controller=new AbortController(),releases=[];let connect;
 const pending=new Promise(resolve=>{connect=resolve;});
 const result=metrics({pool:{connect:()=>pending}},{signal:controller.signal});
 controller.abort();
 await assert.rejects(result,/^Error: POD_DIAGNOSTIC_TIMEOUT$/);
 connect({release:bad=>releases.push(bad)});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(releases,[true]);
});
test('metrics discard a query completing at the absolute deadline without rollback',async t=>{
 let monotonic=0,complete;const queries=[],releases=[];
 t.mock.method(performance,'now',()=>monotonic);
 t.mock.method(AbortSignal,'timeout',()=>new AbortController().signal);
 const db={pool:{connect:async()=>({
  query:async sql=>{queries.push(sql);if(sql.includes('GROUP BY platform'))return new Promise(resolve=>{complete=resolve;});return sql.startsWith('BEGIN ')?{command:'BEGIN'}:{rows:[]};},
  release:bad=>releases.push(bad),
 })}};
 const result=metrics(db);
 while(!complete)await new Promise(resolve=>setImmediate(resolve));
 monotonic=40000;complete({rows:[]});
 await assert.rejects(result,/^Error: POD_DIAGNOSTIC_TIMEOUT$/);
 assert.equal(queries.includes('ROLLBACK'),false);assert.deepEqual(releases,[true]);
});
async function snapshotResult(task){
 const stalled=(async()=>{for(let i=0;i<100;i++)await new Promise(r=>setImmediate(r));throw Error('UNBOUNDED_SNAPSHOT');})();
 return Promise.race([task,stalled]);
}
test('manual diagnostics validate cancellation before allocating an owned timer',async t=>{
 let timers=0;const set=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(...args)=>{timers++;return set(...args);});
 await assert.rejects(operationsSnapshot({signal:{},connect:()=>{throw Error('must not connect');}}),/^Error: POD_DIAGNOSTIC_TIMEOUT$/);
 assert.equal(timers,0);
});
test('manual diagnostics start no work after cancellation',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(snapshotResult(operationsSnapshot({signal:controller.signal,connect:()=>{calls++;return fixture().db.pool;}})),/POD_DIAGNOSTIC_TIMEOUT/);
 assert.equal(calls,0);
});
for(const failure of ['throw','reject'])test('manual diagnostics destroy a late pool and consume '+failure+' from shutdown',async()=>{
 const controller=new AbortController();let complete,ended=0;
 const task=operationsSnapshot({signal:controller.signal,connect:()=>new Promise(resolve=>{complete=resolve;controller.abort();})});
 await assert.rejects(snapshotResult(task),/POD_DIAGNOSTIC_TIMEOUT/);
 complete({end:()=>{ended++;if(failure==='throw')throw Error('private shutdown');return Promise.reject(Error('private shutdown'));}});
 await new Promise(r=>setImmediate(r));assert.equal(ended,1);
});
test('manual diagnostics cannot return success when owned-pool shutdown stalls',async()=>{
 const controller=new AbortController(),f=fixture();let ended=0,finish;
 f.db.pool.end=()=>{ended++;controller.abort();return new Promise(resolve=>{finish=resolve;});};
 try{
  await assert.rejects(snapshotResult(operationsSnapshot({signal:controller.signal,connect:()=>f.db.pool,
   env:healthy.env,clock:()=>now})),/POD_DIAGNOSTIC_TIMEOUT/);
  assert.equal(ended,1);assert.equal(f.released,false);
 }finally{finish?.();}
});
test('manual diagnostics close their pool on success and failure without starting workers',async()=>{
 for(const fail of [false,true]){
  const f=fixture({fail}),invoke=()=>operationsSnapshot({connect:async()=>f.db.pool,
   env:{...healthy.env,POD_STORAGE_EXPIRES_AT:new Date(now+3600000).toISOString()},clock:()=>now});
  if(fail)await assert.rejects(invoke(),/private database error/);else assert.equal((await invoke()).health.storage.lifetime,'BLOCKED');
  assert.equal(f.ended,true);
 }
});
test('manual diagnostics expose ambiguous storage expiry as unknown',async()=>{
 for(const expiry of ['2030-01-01','2030-01-01 00:00:00Z','2030-01-01T01:00:00+01:00',
  '2030-01-01T00:00:00.0Z','2030-01-01T00:00:00z','2030-01-01T00:00:00Z ']){
  const f=fixture(),result=await operationsSnapshot({connect:async()=>f.db.pool,
   env:{...healthy.env,POD_STORAGE_EXPIRES_AT:expiry},clock:()=>now});
  assert.equal(result.health.storage.expires_at,null);
  assert.equal(result.health.storage.lifetime,'UNKNOWN');
  assert.ok(result.health.alerts.some(alert=>alert.code==='STORAGE_EXPIRY_UNKNOWN'));
 }
});
