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
test('workspace cleanup failure preserves the durable job result and exposes only a fixed signal',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const options={env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:key},upstreamKey:key,
  db:{recover:async()=>{},claimProduction:async()=>({id:'j',brief}),failProduction:async()=>{}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>({rights_verified:false,cleanup:async()=>{throw Error('private workspace path');}})};
 const result=await produceOnce(options);
 assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'RIGHTS_BLOCKED',cleanup_failed:true});
 assert.ok(!JSON.stringify(result).includes('private'));
 let observed,timer;const failure=new Promise(resolve=>observed=resolve);
 const runtime=startProductionRuntime({db:options.db,env:options.env,
  production:{resolveTask:options.resolveTask,resolveGrant:options.resolveGrant},onError:observed});
 try{
  const report=await Promise.race([failure,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('cleanup health event missing')),5000);})]);
  assert.deepEqual(report,{code:'POD_WORKSPACE_CLEANUP_FAILED'});
  const health=runtime.health();assert.equal(health.last_result,'BLOCKED');
  assert.equal(health.last_error_code,'POD_WORKSPACE_CLEANUP_FAILED');assert.equal(health.consecutive_failures,1);
  assert.ok(!JSON.stringify(health).includes('private'));
 }finally{clearTimeout(timer);await runtime.stop();}
});
test('workspace cleanup failure cannot mask an earlier persistence failure',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const persistenceFailure=Error('primary persistence failure');
 await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
  db:{claimProduction:async()=>({id:'j',brief}),failProduction:async()=>{throw persistenceFailure;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>({rights_verified:false,cleanup:async()=>{throw Error('secondary cleanup failure');}})}),
 error=>error===persistenceFailure);
});
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';
import {runPodWorker} from '../integrations/pod/orchestrator.mjs';
for(const phase of ['recovery','rejected recovery','claim']){
 test(`disable during ${phase} stops the lifecycle without completion or retry health`,async()=>{
  const env={POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)};
  let release,entered,claims=0;
  const started=new Promise(resolve=>entered=resolve);
  const pending=new Promise(resolve=>release=resolve);
  const runtime=startProductionRuntime({env,db:{
   recover:async()=>{if(phase!=='claim'){entered();await pending;if(phase==='rejected recovery')throw Error('private recovery failure');}},
   claimProduction:async()=>{claims++;if(phase==='claim'){entered();await pending;}return null;}
  },production:{resolveTask:async()=>{},resolveGrant:async()=>{}}});
  await started;env.POD_PRODUCTION_ENABLED='false';release();
  await new Promise(resolve=>setImmediate(resolve));
  const health=runtime.health();await runtime.stop();
  assert.equal(health.status,'STOPPED');assert.equal(health.cycles,0);
  assert.equal(health.consecutive_failures,0);assert.equal(health.last_error_code,null);
  assert.equal(health.last_completed_at,null);assert.equal(claims,phase==='claim'?1:0);
  env.POD_PRODUCTION_ENABLED='true';await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runtime.status(),'STOPPED');assert.equal(claims,phase==='claim'?1:0);
 });
}
test('disabled worker continuation gate prevents recovery before the first cycle',async()=>{
 const controller=new AbortController();let recovered=0;
 await runPodWorker({signal:controller.signal,shouldContinue:()=>false,
  db:{recover:async()=>{recovered++;controller.abort();}},produce:async()=>{},publish:async()=>{}});
 assert.equal(recovered,0);
});
test('disable after production prevents the following stage and completion notification',async()=>{
 const controller=new AbortController();let enabled=true,published=0,completed=0;
 await runPodWorker({signal:controller.signal,shouldContinue:()=>enabled,
  db:{recover:async()=>{}},produce:async()=>{enabled=false;return {status:'IDLE'};},
  publish:async()=>{published++;controller.abort();},
  onCycle:event=>{if(event.phase==='completed')completed++;}});
 assert.equal(published,0);assert.equal(completed,0);
});
test('disable during polling prevents another lease recovery', {timeout:3000},async()=>{
 const controller=new AbortController();let enabled=true,recovered=0,completed=0;
 await runPodWorker({signal:controller.signal,pollMs:1000,shouldContinue:()=>enabled,
  db:{recover:async()=>{recovered++;}},produce:async()=>({status:'IDLE'}),publish:async()=>{},
  onCycle:event=>{if(event.phase==='completed'){completed++;setImmediate(()=>{enabled=false;});}}});
 assert.equal(recovered,1);assert.equal(completed,1);
});
test('disable during the final stage suppresses completion notification',async()=>{
 const controller=new AbortController();let enabled=true,completed=0;
 await runPodWorker({signal:controller.signal,shouldContinue:()=>enabled,
  db:{recover:async()=>{}},produce:async()=>({status:'IDLE'}),publish:async()=>{enabled=false;},
  onCycle:event=>{if(event.phase==='completed')completed++;}});
 assert.equal(completed,0);
});
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
test('cancellation during an empty production claim reports stopped',async()=>{
 const controller=new AbortController();
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},signal:controller.signal,
  db:{claimProduction:async()=>{controller.abort();return null;}}});
 assert.deepEqual(result,{status:'STOPPED'});
});
test('production disable during an empty claim reports stopped',async()=>{
 const env={POD_PRODUCTION_ENABLED:'true'};
 const result=await produceOnce({env,
  db:{claimProduction:async()=>{env.POD_PRODUCTION_ENABLED='false';return null;}}});
 assert.deepEqual(result,{status:'STOPPED'});
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
