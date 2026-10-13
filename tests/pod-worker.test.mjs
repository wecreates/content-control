import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {produceOnce} from '../scripts/pod_production_worker.mjs';
test('disabled production never claims work',async()=>{
 assert.deepEqual(await produceOnce({env:{},db:{claimProduction(){throw Error('unexpected');}}}),{status:'DISABLED'});
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
