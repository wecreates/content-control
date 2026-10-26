import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalHealth} from '../integrations/pod/operational-health.mjs';
import {metrics} from '../integrations/pod/metrics.mjs';
import {operationsSnapshot} from '../scripts/pod_operations_snapshot.mjs';
const now=Date.parse('2026-01-01T00:00:00Z');
const healthy={now,expiresAt:now+8*86400000,artifactBytes:'0',expiredLeases:'0',pendingEvents:'0',oldestEventSeconds:'0',env:{POD_ARTIFACT_BUDGET_BYTES:'100'}};
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
function fixture({fail=false,rollbackFails=false}={}){
 const queries=[];let released,ended=false;
 const client={release:bad=>{released=bad;},query:async sql=>{
  queries.push(sql);if(sql==='ROLLBACK'&&rollbackFails)throw Error('rollback unavailable');
  if(sql.includes('FROM pod_artifacts')){if(fail)throw Error('private database error');return {rows:[{bytes:'90'}]};}
  if(sql.includes('FROM pod_financial_events'))return {rows:[{currency:'USD',verified_net_recorded_minor:'9007199254740993',evidence_count:'1'}]};
  if(sql.includes('GROUP BY platform'))return {rows:[{platform:'redbubble',state:'raw',count:'1'}]};
  if(sql.includes('FROM pod_events'))return {rows:[{count:'1',oldest_seconds:'900'}]};
  if(sql.startsWith('SELECT'))return {rows:[{count:'0'}]};
  return {rows:[]};
 }};
 return {queries,get released(){return released;},get ended(){return ended;},
  db:{active(){throw Error('POD_STORAGE_EXPIRING');},expiresAt:now+3600000,pool:{connect:async()=>client,end:async()=>{ended=true;}}}};
}
test('metrics remain read-only and available inside the write-blocking expiry window',async()=>{
 const f=fixture(),result=await metrics(f.db,{env:healthy.env,clock:()=>now});
 assert.equal(result.health.storage.lifetime,'BLOCKED');assert.equal(result.health.status,'CRITICAL');
 assert.equal(result.financials[0].verified_net_recorded_minor,'9007199254740993');
 assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1),'COMMIT');
 assert.ok(f.queries.every(q=>!/^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)/.test(q)));assert.equal(f.released,false);
 assert.throws(()=>f.db.active(),/POD_STORAGE_EXPIRING/);
});
test('metrics errors roll back and discard a connection if rollback itself fails',async()=>{
 for(const rollbackFails of [false,true]){
  const f=fixture({fail:true,rollbackFails});await assert.rejects(metrics(f.db),/private database error/);
  assert.equal(f.queries.at(-1),'ROLLBACK');assert.equal(f.released,rollbackFails);assert.ok(!f.queries.includes('COMMIT'));
 }
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
