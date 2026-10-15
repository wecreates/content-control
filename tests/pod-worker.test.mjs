import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
test('disabled production never claims work',async()=>{
 assert.deepEqual(await produceOnce({env:{},db:{claimProduction(){throw Error('unexpected');}}}),{status:'DISABLED'});
});
test('malformed production storage budgets fail before queue access',async()=>{
 for(const value of ['', '0', 'NaN', '134217729']){
  await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true',POD_ARTIFACT_BUDGET_BYTES:value},
   db:{claimProduction(){assert.fail('must not claim under invalid storage policy');}}}),/ARTIFACT_BUDGET_CONFIG_INVALID/);
 }
});
test('production-only grant reaches task resolution without publishing',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 let resolved=false,failed=false;
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
  db:{claimProduction:async()=>({id:'j',brief}),failProduction:async()=>{failed=true;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>{resolved=true;return {rights_verified:false};}});
 assert.equal(resolved,true);assert.equal(failed,true);assert.equal(result.status,'BLOCKED');
});
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';
test('enabled worker without authority resolvers fails closed',async()=>{
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true'},db:{recover(){throw Error('must not access');}}});
 assert.equal(runtime.status(),'BLOCKED_PRODUCTION_CONFIGURATION');await runtime.stop();
});
test('worker awaits its in-flight cycle before shutdown',async()=>{
 let entered,finish;const entry=new Promise(r=>entered=r),pending=new Promise(r=>finish=r);
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)},
  db:{recover:async()=>{},claimProduction:async()=>{entered();await pending;return null;}},
  production:{resolveTask:async()=>{},resolveGrant:async()=>{}}});
 await entry;let stopped=false;const shutdown=runtime.stop().then(()=>stopped=true);
 await new Promise(r=>setImmediate(r));assert.equal(stopped,false);finish();await shutdown;
 assert.equal(runtime.status(),'STOPPED');
});
test('already aborted production does not claim a job',async()=>{
 const controller=new AbortController();controller.abort();
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},signal:controller.signal,
  db:{claimProduction(){throw Error('must not claim');}}});
 assert.equal(result.status,'STOPPED');
});
test('missing Python dependencies block before queue access',async()=>{
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true'},pythonReady:false,
  db:{recover(){throw Error('must not claim');}}});
 assert.equal(runtime.status(),'BLOCKED_PYTHON_RUNTIME');await runtime.stop();
});
test('failed recovery reports retrying without leaking database error details',async()=>{
 let observed;const errorSeen=new Promise(r=>observed=r);
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)},
  db:{recover:async()=>{throw Error('private connection details');}},
  production:{resolveTask:async()=>{},resolveGrant:async()=>{}},onError:observed});
 await errorSeen;assert.equal(runtime.status(),'RETRYING');const health=runtime.health();
 assert.equal(health.consecutive_failures,1);assert.equal(health.cycles,0);assert.ok(health.last_started_at);
 assert.ok(!JSON.stringify(health).includes('private'));await runtime.stop();assert.equal(runtime.status(),'STOPPED');
});
test('idle cycle records completion without claiming successful production',async()=>{
 const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)},
  db:{recover:async()=>{},claimProduction:async()=>null},production:{resolveTask:async()=>{},resolveGrant:async()=>{}}});
 await new Promise(r=>setImmediate(r));const h=runtime.health();assert.equal(h.cycles,1);assert.equal(h.last_result,'IDLE');
 assert.ok(h.last_completed_at);await runtime.stop();
});
