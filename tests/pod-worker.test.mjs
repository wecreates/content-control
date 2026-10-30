import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const productionClaim=brief=>({id:'j',account_id:'a',platform:brief.platform,fencing_token:1,brief});
const durableProductionEndpoints=Object.freeze({
 assertProducible:async()=>{},holdProduction:async()=>{},completeProduction:async()=>({pass:false})
});
import {produceOnce} from '../scripts/pod_production_worker.mjs';
test('production options reject accessors and proxies without invocation',async()=>{
 let reads=0;
 for(const key of ['db','resolveTask','resolveGrant','upstreamKey','root','env','signal']){
  const options={};
  Object.defineProperty(options,key,{enumerable:true,get(){reads++;throw Error('option getter executed');}});
  await assert.rejects(produceOnce(options),/PRODUCTION_OPTIONS_UNVERIFIED/,key);
 }
 const options=new Proxy({},{get(){reads++;throw Error('option proxy executed');}});
 await assert.rejects(produceOnce(options),/PRODUCTION_OPTIONS_UNVERIFIED/);
 assert.equal(reads,0);
});
test('disabled production never claims work',async()=>{
 assert.deepEqual(await produceOnce({env:{},db:{claimProduction(){throw Error('unexpected');}}}),{status:'DISABLED'});
});
test('live production enable checks reject accessors without invocation',async()=>{
 const env={POD_PRODUCTION_ENABLED:'true'};let reads=0;
 const result=await produceOnce({env,upstreamKey:'k'.repeat(48),resolveGrant:async()=>{},resolveTask:async()=>{},
  db:{...durableProductionEndpoints,failProduction:async()=>{},claimProduction:async()=>{
  Object.defineProperty(env,'POD_PRODUCTION_ENABLED',{configurable:true,enumerable:true,get(){reads++;return 'false';}});
  return null;
 }}});
 assert.equal(reads,0);assert.deepEqual(result,{status:'STOPPED'});
});
test('production requires authority configuration before queue access',async()=>{
 const key='k'.repeat(48);
 for(const [name,authority] of [
  ['missing grant resolver',{resolveTask:async()=>{},upstreamKey:key}],
  ['missing task resolver',{resolveGrant:async()=>{},upstreamKey:key}],
  ['missing signing key',{resolveGrant:async()=>{},resolveTask:async()=>{}}],
  ['short signing key',{resolveGrant:async()=>{},resolveTask:async()=>{},upstreamKey:'short'}]
 ]){
  let claims=0;
  await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},...authority,
   db:{...durableProductionEndpoints,claimProduction:async()=>{claims++;return null;},failProduction:async()=>{}}}),
  /PRODUCTION_AUTHORITY_UNVERIFIED/,name);
  assert.equal(claims,0,name);
 }
});
test('production requires durable failure settlement before queue access',async()=>{
 let claims=0;
 await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},
  db:{claimProduction:async()=>{claims++;return null;}}}),/PRODUCTION_DATABASE_UNVERIFIED/);
 assert.equal(claims,0);
});
test('production requires every durable database endpoint before queue access',async()=>{
 for(const missing of ['assertProducible','holdProduction','completeProduction']){
  let claims=0;
  const db={claimProduction:async()=>{claims++;return null;},failProduction:async()=>{},
   assertProducible:async()=>{},holdProduction:async()=>{},completeProduction:async()=>({pass:false})};
  delete db[missing];
  await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},db}),
   /PRODUCTION_DATABASE_UNVERIFIED/,missing);
  assert.equal(claims,0,missing);
 }
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
  db:{...durableProductionEndpoints,claimProduction:async()=>productionClaim(brief),failProduction:async()=>{failed=true;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>{resolved=true;return {rights_verified:false};}});
 assert.equal(resolved,true);assert.equal(failed,true);assert.equal(result.status,'BLOCKED');
});
test('workspace cleanup failure preserves the durable job result and exposes only a fixed signal',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const options={env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:key},upstreamKey:key,
  db:{...durableProductionEndpoints,recover:async()=>{},claimProduction:async()=>productionClaim(brief),failProduction:async()=>{}},
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
  db:{...durableProductionEndpoints,claimProduction:async()=>productionClaim(brief),failProduction:async()=>{throw persistenceFailure;}},
  resolveGrant:async()=>({payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}),
  resolveTask:async()=>({rights_verified:false,cleanup:async()=>{throw Error('secondary cleanup failure');}})}),
 error=>error===persistenceFailure);
});
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';
test('production runtime options reject accessors and proxies without invocation',()=>{
 let reads=0;
 for(const key of ['db','production','env','pythonReady','onError']){
  const options={};
  Object.defineProperty(options,key,{enumerable:true,get(){reads++;throw Error('runtime option getter executed');}});
  assert.throws(()=>startProductionRuntime(options),/PRODUCTION_RUNTIME_OPTIONS_UNVERIFIED/,key);
 }
 const options=new Proxy({},{get(){reads++;throw Error('runtime option proxy executed');}});
 assert.throws(()=>startProductionRuntime(options),/PRODUCTION_RUNTIME_OPTIONS_UNVERIFIED/);
 assert.equal(reads,0);
});
test('production runtime rejects executable nested configuration without invocation',async()=>{
 let reads=0;
 const executable=(target,key)=>Object.defineProperty(target,key,{enumerable:true,get(){reads++;throw Error('nested runtime getter executed');}});
 const env={};executable(env,'POD_PRODUCTION_ENABLED');
 const envRuntime=startProductionRuntime({env});
 assert.equal(envRuntime.status(),'BLOCKED_PRODUCTION_CONFIGURATION');await envRuntime.stop();
 for(const key of ['authorityReady','resolveTask','resolveGrant','root']){
  const production={resolveTask:async()=>{},resolveGrant:async()=>{}};executable(production,key);
  const runtime=startProductionRuntime({env:{POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)},db:{},production});
  assert.equal(runtime.status(),'BLOCKED_PRODUCTION_CONFIGURATION',key);await runtime.stop();
 }
 const keyEnv={POD_PRODUCTION_ENABLED:'true'};executable(keyEnv,'POD_UPSTREAM_KEY');
 const keyRuntime=startProductionRuntime({env:keyEnv,db:{},production:{resolveTask:async()=>{},resolveGrant:async()=>{}}});
 assert.equal(keyRuntime.status(),'BLOCKED_PRODUCTION_CONFIGURATION');await keyRuntime.stop();
 assert.equal(reads,0);
});
import {runPodWorker} from '../integrations/pod/orchestrator.mjs';
for(const phase of ['recovery','rejected recovery','claim']){
 test(`disable during ${phase} stops the lifecycle without completion or retry health`,async()=>{
  const env={POD_PRODUCTION_ENABLED:'true',POD_UPSTREAM_KEY:'k'.repeat(48)};
  let release,entered,claims=0;
  const started=new Promise(resolve=>entered=resolve);
  const pending=new Promise(resolve=>release=resolve);
  const runtime=startProductionRuntime({env,db:{...durableProductionEndpoints,
   recover:async()=>{if(phase!=='claim'){entered();await pending;if(phase==='rejected recovery')throw Error('private recovery failure');}},
   claimProduction:async()=>{claims++;if(phase==='claim'){entered();await pending;}return null;},failProduction:async()=>{}
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
  db:{...durableProductionEndpoints,recover:async()=>{},claimProduction:async()=>{entered();await pending;return null;},failProduction:async()=>{}},
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
test('production rejects executable abort signals without invocation or queue access',async()=>{
 let reads=0,claims=0;
 const signal={get aborted(){reads++;return false;}};
 await assert.rejects(produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},signal,
  db:{claimProduction:async()=>{claims++;return null;},failProduction:async()=>{}}}),
 /PRODUCTION_SIGNAL_UNVERIFIED/);
 assert.equal(reads,0);assert.equal(claims,0);
});
test('cancellation during an empty production claim reports stopped',async()=>{
 const controller=new AbortController();
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},signal:controller.signal,
  upstreamKey:'k'.repeat(48),resolveGrant:async()=>{},resolveTask:async()=>{},
  db:{...durableProductionEndpoints,claimProduction:async()=>{controller.abort();return null;},failProduction:async()=>{}}});
 assert.deepEqual(result,{status:'STOPPED'});
});
test('production disable during an empty claim reports stopped',async()=>{
 const env={POD_PRODUCTION_ENABLED:'true'};
 const result=await produceOnce({env,upstreamKey:'k'.repeat(48),resolveGrant:async()=>{},resolveTask:async()=>{},
  db:{...durableProductionEndpoints,claimProduction:async()=>{env.POD_PRODUCTION_ENABLED='false';return null;},failProduction:async()=>{}}});
 assert.deepEqual(result,{status:'STOPPED'});
});
test('executable source capability is rejected without invocation before template access',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pod-worker-source-stop-'));
 try{
  const key='k'.repeat(48),env={POD_PRODUCTION_ENABLED:'true',POD_RIGHTS_KEY:key};
  const sourcePath=path.join(root,'source.png'),rightsPath=path.join(root,'rights.json');
  const source=Buffer.from('fixture source');
  await fs.writeFile(sourcePath,source);
  const rightsPayload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
   audience:'pod:asset-rights',status:'PASS',
   source_sha256:crypto.createHash('sha256').update(source).digest('hex')});
  await fs.writeFile(rightsPath,JSON.stringify({payload:rightsPayload,
   signature:crypto.createHmac('sha256',key).update(rightsPayload).digest('hex')}));
  const brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
  const grantPayload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,
   expires_at_ms:Date.now()+60000,job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',
   production_permission:true,publication_permission:false,revoked:false});
  let templateReads=0,sourceReads=0;
  const task={rights_verified:true,templateScope:{product:'fixture-shirt',country:'US'},assetRights:rightsPath};
  Object.defineProperties(task,{
   source:{get(){sourceReads++;env.POD_PRODUCTION_ENABLED='false';return sourcePath;}},
   template:{get(){templateReads++;return path.join(root,'missing-template.json');}}
  });
  const result=await produceOnce({env,upstreamKey:key,
   db:{...durableProductionEndpoints,claimProduction:async()=>productionClaim(brief),failProduction:async()=>{}},
   resolveGrant:async()=>({payload:grantPayload,signature:crypto.createHmac('sha256',key).update(grantPayload).digest('hex')}),
   resolveTask:async()=>task});
  assert.equal(sourceReads,0);assert.equal(templateReads,0);
  assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'PRODUCTION_BLOCKED'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
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
  db:{...durableProductionEndpoints,recover:async()=>{},claimProduction:async()=>null,failProduction:async()=>{}},production:{resolveTask:async()=>{},resolveGrant:async()=>{}}});
 await new Promise(r=>setImmediate(r));const h=runtime.health();assert.equal(h.cycles,1);assert.equal(h.last_result,'IDLE');
 assert.ok(h.last_completed_at);await runtime.stop();
});

test('unsnapshotable production claims never reach callbacks or settlement',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 for(const kind of ['proxy','accessor']){
  const original={id:'j',account_id:'a',platform:'redbubble',fencing_token:7,brief};
  let reads=0,callbacks=0,settlements=0,outcome,error;
  const claimed=kind==='proxy'?new Proxy(original,{
   get(target,property,receiver){if(property==='id'||property==='fencing_token')reads++;return Reflect.get(target,property,receiver);}
  }):Object.defineProperty({...original},'id',{enumerable:true,get(){reads++;return original.id;}});
  try{
   outcome=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
    db:{...durableProductionEndpoints,claimProduction:async()=>claimed,failProduction:async job=>{settlements++;void job.id;void job.fencing_token;}},
    resolveGrant:async()=>{callbacks++;return envelope;},
    resolveTask:async()=>{callbacks++;return {rights_verified:false};}});
  }catch(value){error=value;}
  assert.equal(callbacks,0,kind);assert.equal(settlements,0,kind);assert.equal(reads,0,kind);
  assert.equal(outcome,undefined,kind);assert.equal(error?.message,'PRODUCTION_SETTLEMENT_UNCERTAIN',kind);
 }
});

test('production callbacks cannot redirect fenced settlement identity',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 const claimed={id:'j',account_id:'a',platform:'redbubble',fencing_token:'7',brief},settlements=[];
 const mutate=job=>{job.id='redirected';job.account_id='redirected';job.platform='kdp';job.fencing_token=99;job.brief.id='redirected';};
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,
  db:{...durableProductionEndpoints,claimProduction:async()=>claimed,failProduction:async job=>settlements.push([job.id,job.account_id,job.platform,job.fencing_token,job.brief.id])},
  resolveGrant:async job=>{mutate(job);return envelope;},
  resolveTask:async job=>{mutate(job);return {rights_verified:false};}});
 assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'RIGHTS_BLOCKED'});
 assert.deepEqual(settlements,[['j','a','redbubble','7','j']]);
 assert.deepEqual([claimed.id,claimed.account_id,claimed.platform,claimed.fencing_token,claimed.brief.id],['j','a','redbubble','7','j']);
});


test('production database settlement is bound before the claim callback',async()=>{
 const key='k'.repeat(48),brief={id:'j',account_id:'a',business_id:'b',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:'j',account_id:'a',business_id:'b',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 const envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
 let originalSettlements=0,replacementSettlements=0,originalTransactions=0,replacementTransactions=0;
 const db={...durableProductionEndpoints,
  tx:async fn=>{originalTransactions++;return fn({});},
  failProduction:async function(){originalSettlements++;return this.tx(async()=>{});},
  claimProduction:async()=>{
   db.tx=async fn=>{replacementTransactions++;return fn({});};
   db.failProduction=async()=>{replacementSettlements++;};
   return productionClaim(brief);
  }
 };
 const result=await produceOnce({env:{POD_PRODUCTION_ENABLED:'true'},upstreamKey:key,db,
  resolveGrant:async()=>envelope,resolveTask:async()=>({rights_verified:false})});
 assert.deepEqual(result,{status:'BLOCKED',job_id:'j',reason_code:'RIGHTS_BLOCKED'});
 assert.equal(originalSettlements,1);
 assert.equal(replacementSettlements,0);
 assert.equal(originalTransactions,1);
 assert.equal(replacementTransactions,0);
});
