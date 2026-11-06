import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {performance} from 'node:perf_hooks';
import {operationalAuth} from '../integrations/pod/auth.mjs';
import {createPodRouter} from '../integrations/pod/router.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {recordFinancialEvent} from '../integrations/pod/finance.mjs';
import {validateTemplate} from '../integrations/pod/templates.mjs';
const key='a'.repeat(48);
const artifactInsert=args=>({rowCount:1,rows:[{
 sha256:args[0],media_type:args[2],body_sha256:crypto.createHash('sha256').update(args[1]).digest('hex'),
}]});
test('authenticated parser failures return sanitized JSON before any database operation',async()=>{
 const app=express();app.set('env','development');let calls=0,escaped=0;
 const db=new Proxy({}, {get(){calls++;throw Error('database must not be touched');}});
 app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 app.use((_error,_req,res,_next)=>{escaped++;res.status(599).json({error:'escaped'});});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const cases=[
   ['/jobs','application/json','{"private-marker":',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','{"payload":"first","pay\\u006coad":"second"}',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','{"value":1e400}',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json',Buffer.concat([Buffer.from('{"value":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]),{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{}')]),{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','true',{},400,'POD_REQUEST_INVALID'],
   ['/jobs','application/json','x'.repeat(262145),{},413,'POD_REQUEST_TOO_LARGE'],
   ['/artifacts','image/png',Buffer.alloc(16777217),{},413,'POD_REQUEST_TOO_LARGE'],
   ['/jobs','application/json; charset=iso-8859-1','{}',{},415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
   ['/jobs','application/json','{}',{'content-encoding':'unsupported-fixture'},415,'POD_REQUEST_ENCODING_UNSUPPORTED']
  ];
  for(const [path,type,body,headers,status,code] of cases){
   const r=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':type,...headers},body});
   assert.equal(r.status,status);assert.match(r.headers.get('content-type'),/^application\/json/);
   assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{error:code});
  }
  // Unauthenticated input is rejected by auth before parsing sensitive bytes.
  const denied=await fetch(base+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"private-marker":'});
  assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'OWNER_AUTH_REQUIRED'});
  assert.equal(calls,0);assert.equal(escaped,0);
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated uploads share the bounded deployment storage policy',async()=>{
 const env={POD_ARTIFACT_BUDGET_BYTES:'3'};let inserts=0,transactions=0;
 const db={active(){},tx:async fn=>{transactions++;return fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT')){inserts++;return artifactInsert(args);}
  return {rows:[]};
 }});}};
 const app=express();app.use(createPodRouter({db,env,authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const send=()=>fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'1234'});
  const rejected=await send();assert.equal(rejected.status,409);assert.deepEqual(await rejected.json(),{error:'ARTIFACT_STORAGE_BLOCKED'});assert.equal(inserts,0);
  env.POD_ARTIFACT_BUDGET_BYTES='4';assert.equal((await send()).status,201);assert.equal(inserts,1);
  const before=transactions;env.POD_ARTIFACT_BUDGET_BYTES='';
  assert.equal((await send()).status,409);assert.equal(transactions,before);assert.equal(inserts,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated regional-rights evidence upload accepts and preserves text/plain',async()=>{
 const inserts=[],db={active(){},tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT')){inserts.push(args);return artifactInsert(args);}
  return {rows:[]};
 }})};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const body='synthetic regional-rights evidence; not legal approval';
  const response=await fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'text/plain; charset=utf-8'},body});
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{
   sha256:crypto.createHash('sha256').update(body).digest('hex')});
  assert.equal(inserts.length,1);assert.equal(inserts[0][2],'text/plain');
  assert.deepEqual(inserts[0][1],Buffer.from(body));
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated KDP template archive upload accepts and preserves application/zip',async()=>{
 const inserts=[],db={active(){},tx:fn=>fn({query:async(sql,args)=>{
  if(sql.includes('sum('))return {rows:[{bytes:'0'}]};
  if(sql.startsWith('INSERT')){inserts.push(args);return artifactInsert(args);}
  return {rows:[]};
 }})};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const body=Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),Buffer.from('synthetic bounded KDP template archive')]);
  const response=await fetch(`http://127.0.0.1:${server.address().port}/artifacts`,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/zip'},body});
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{
   sha256:crypto.createHash('sha256').update(body).digest('hex')});
  assert.equal(inserts.length,1);assert.equal(inserts[0][2],'application/zip');
  assert.deepEqual(inserts[0][1],body);
 }finally{await new Promise(r=>server.close(r));}
});
const sign=p=>{const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+30000,...p});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
test('unset operational key cannot be authenticated with Bearer undefined',()=>assert.equal(operationalAuth()( {headers:{authorization:'Bearer undefined'}}),false));
test('operational key requires exact bearer match',()=>{const auth=operationalAuth(key);assert.equal(auth({headers:{authorization:`Bearer ${key}`}}),true);assert.equal(auth({headers:{authorization:`Bearer ${key}x`}}),false);});
test('artifact rejects oversize before database access',async()=>{const store=new ArtifactStore({}, {maxObjectBytes:1});await assert.rejects(store.put(Buffer.from('xx'),'image/png'),/ARTIFACT_INVALID/);});
test('artifact reads detect stored byte corruption',async()=>{const db={active(){},read:async()=>({rows:[{body:Buffer.from('wrong')}]})};await assert.rejects(new ArtifactStore(db).get('a'.repeat(64)),/ARTIFACT_UNAVAILABLE/);});
test('review artifact download requires an exact job-scoped hold',async()=>{
 const body=Buffer.from('scoped artifact'),sha=crypto.createHash('sha256').update(body).digest('hex'),calls=[];
 const db={reviewArtifact:async(id,digest)=>{calls.push({id,digest});return {body,media_type:'image/png'};}};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${server.address().port}`,
  headers={Authorization:`Bearer ${key}`};
  const unscoped=await fetch(base+'/artifacts/'+sha,{headers});
  assert.equal(unscoped.status,404);assert.deepEqual(await unscoped.json(),{error:'ARTIFACT_UNAVAILABLE'});
  assert.equal(calls.length,0);
  const scoped=await fetch(base+'/jobs/fixture-job/artifacts/'+sha,{headers});
  assert.equal(scoped.status,200);assert.equal(scoped.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await scoped.arrayBuffer()),body);
  assert.deepEqual(calls,[{id:'fixture-job',digest:sha}]);
 }finally{await new Promise(r=>server.close(r));}
});
for(const [name,path] of [
 ['review package','/jobs/fixture-job/package'],
 ['review artifact','/jobs/fixture-job/artifacts/'+'a'.repeat(64)],
 ['owner job list','/jobs']
])test(name+' reports the storage cutoff as unavailable',async()=>{
 const unavailable=async()=>{throw Error('POD_STORAGE_EXPIRING');};
 const db={reviewPackage:unavailable,reviewArtifact:unavailable,listOperationsJobs:unavailable};
 const app=express();app.use(createPodRouter({db,env:{},authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}`+path,{headers:{Authorization:`Bearer ${key}`}});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'POD_STORAGE_UNAVAILABLE'});
  assert.equal(response.headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated mutations report the exact storage cutoff as unavailable',async()=>{
 const unavailable=async()=>{throw Error('POD_STORAGE_EXPIRING');};
 const db={tx:unavailable,requeueRepair:unavailable,acceptReview:unavailable,registerIntake:unavailable,enqueue:unavailable};
 const env={POD_MARKET_KEY:key,POD_PROVIDER_KEY:key,POD_FINANCE_KEY:key};
 const app=express();app.use(createPodRouter({db,env,authorize:operationalAuth(key)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const market=sign({audience:'content-control:pod:market',platform:'redbubble',source_url:'https://example.org/fixture',
  country:'US',category:'shirt',observed_at:'2026-01-01T00:00:00Z',collection_authorized:true,source_sha256:'a'.repeat(64)});
 const listing=sign({audience:'content-control:pod:listing-observation',account_id:'account',evidence_sha256:'a'.repeat(64),
  job_id:'job',package_sha256:'b'.repeat(64),platform:'redbubble',provider_event_id:'event',provider_id:'listing',provider_verified:true,status:'LIVE'});
 const financial=sign({audience:'content-control:pod:finance',verified:true,authority_event_id:'authority',provider_event_id:'event',
  provider:'redbubble',job_id:'job',amount_minor:1,kind:'royalty',currency:'USD',occurred_at:'2026-01-01T00:00:00Z',evidence_sha256:'a'.repeat(64)});
 try{
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Bearer ${key}`};
  const cases=[
   ['/artifacts','image/png',Buffer.from('fixture')],
   ['/jobs/fixture-job/retry','application/json',{}],
   ['/jobs/fixture-job/review','application/json',{}],
   ['/market','application/json',market],
   ['/listing-observations','application/json',listing],
   ['/financial-events','application/json',financial],
   ['/intake','application/json',{}],
   ['/jobs','application/json',{}]
  ];
  for(const [path,type,body] of cases){
   const response=await fetch(base+path,{method:'POST',headers:{...headers,'Content-Type':type},body:type==='application/json'?JSON.stringify(body):body});
   assert.equal(response.status,503,path);assert.deepEqual(await response.json(),{error:'POD_STORAGE_UNAVAILABLE'},path);
   assert.equal(response.headers.get('cache-control'),'no-store');
  }
 }finally{await new Promise(r=>server.close(r));}
});
test('financial events cannot fabricate unsigned verified income',async()=>{await assert.rejects(recordFinancialEvent({}, {payload:'{}',signature:'0'.repeat(64)},key),/SIGNATURE_INVALID/);});
test('refund sign cannot inflate net recorded income',async()=>{await assert.rejects(recordFinancialEvent({},sign({audience:'content-control:pod:finance',verified:true,authority_event_id:'a',provider_event_id:'e',provider:'p',job_id:'j',amount_minor:10,kind:'refund',currency:'USD',occurred_at:new Date().toISOString(),evidence_sha256:'a'.repeat(64)}),key),/FINANCIAL_SIGN_INVALID/);});
test('templates reject unsupported platforms despite trusted signature',()=>assert.throws(()=>validateTemplate(sign({audience:'pod:template',template:{platform:'etsy'}}),key,{platform:'etsy'}),/TEMPLATE_PROVENANCE_REQUIRED/));
test('operations endpoints require auth and redact unavailable DB errors',async()=>{
 const app=express();app.use('/api/print',createPodRouter({db:undefined,authorize:operationalAuth(key),env:{}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/api/print`;
 try{assert.equal((await fetch(url+'/metrics')).status,401);assert.equal((await fetch(url+'/jobs')).status,401);const response=await fetch(url+'/metrics',{headers:{Authorization:`Bearer ${key}`}});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'POD_STORAGE_UNAVAILABLE'});assert.equal((await fetch(url+'/dashboard')).status,200);}finally{await new Promise(r=>server.close(r));}
});
test('capacity endpoint authenticates and sanitizes unavailable storage',async()=>{
 const app=express();app.use(createPodRouter({db:undefined,authorize:operationalAuth(key),env:{}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const url=`http://127.0.0.1:${server.address().port}/capacity`;
  const denied=await fetch(url);assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'OWNER_AUTH_REQUIRED'});
  const blocked=await fetch(url,{headers:{Authorization:`Bearer ${key}`}});
  assert.equal(blocked.status,503);assert.deepEqual(await blocked.json(),{error:'POD_CAPACITY_UNAVAILABLE'});
  assert.equal(blocked.headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));}
});
test('job inspection route authenticates and forwards only its filter',async()=>{
 const calls=[],app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db:{listOperationsJobs:async state=>{calls.push(state);return [{id:'fixture-job',state}];}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/jobs?state=blocked')).status,401);assert.equal(calls.length,0);
  const result=await fetch(base+'/jobs?state=blocked',{headers:{Authorization:`Bearer ${key}`}});
  assert.deepEqual(await result.json(),{jobs:[{id:'fixture-job',state:'blocked'}],limit:50,publication_enabled:false});
  assert.deepEqual(calls,['blocked']);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.match(result.headers.get('content-security-policy'),/img-src blob:/);
 }finally{await new Promise(r=>server.close(r));}
});
test('authenticated review routes forward a native request lifecycle signal',async()=>{
 const calls=[],body=Buffer.from('fixture');
 const db={
  listOperationsJobs:async(state,options)=>{calls.push(['jobs',state,options?.signal]);return [];},
  reviewPackage:async(id,options)=>{calls.push(['package',id,options?.signal]);return {id};},
  reviewArtifact:async(id,sha,options)=>{calls.push(['artifact',id,sha,options?.signal]);return {body,media_type:'image/png'};},
  listReady:async options=>{calls.push(['ready',options?.signal]);return [];},
 };
 const app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Bearer ${key}`};
  assert.equal((await fetch(base+'/jobs?state=blocked',{headers})).status,200);
  assert.equal((await fetch(base+'/jobs/fixture-job/package',{headers})).status,200);
  assert.equal((await fetch(base+'/jobs/fixture-job/artifacts/'+'a'.repeat(64),{headers})).status,200);
  assert.equal((await fetch(base+'/ready',{headers})).status,200);
  assert.deepEqual(calls.map(call=>call.slice(0,-1)),[
   ['jobs','blocked'],['package','fixture-job'],['artifact','fixture-job','a'.repeat(64)],['ready']]);
  for(const call of calls){const signal=call.at(-1);assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,false);}
 }finally{await new Promise(r=>server.close(r));}
});
test('disconnecting an authenticated read aborts its pending database operation',async()=>{
 let entered,aborted;const started=new Promise(resolve=>{entered=resolve;}),cancelled=new Promise(resolve=>{aborted=resolve;});
 const db={listOperationsJobs:async(_state,{signal}={})=>{
  entered();
  return new Promise((resolve,reject)=>{
   const stop=()=>{aborted(signal);reject(signal.reason);};
   if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});
  });
 }};
 const app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const controller=new AbortController();
 try{
  const request=fetch(`http://127.0.0.1:${server.address().port}/jobs`,{
   headers:{Authorization:`Bearer ${key}`},signal:controller.signal});
  await started;controller.abort();
  await assert.rejects(request,error=>error?.name==='AbortError');
  const signal=await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('request cancellation not forwarded')),1000))]);
  assert.equal(signal.aborted,true);assert.equal(signal.reason?.message,'POD_REQUEST_CANCELLED');
 }finally{controller.abort();await new Promise(r=>server.close(r));}
});
for(const [name,path,method] of [
 ['repair retry','/jobs/fixture-job/retry','requeueRepair'],
 ['review acceptance','/jobs/fixture-job/review','acceptReview'],
])test('disconnecting authenticated '+name+' aborts its pending database mutation',async()=>{
 let entered,release,observed,observedSignal;
 const started=new Promise(resolve=>{entered=resolve;}),pending=new Promise(resolve=>{release=resolve;}),
  cancelled=new Promise(resolve=>{observed=resolve;});
 const db={[method]:async(_id,_body,options)=>{
  observedSignal=options?.signal;entered();
  if(!(observedSignal instanceof AbortSignal))observed();
  else if(observedSignal.aborted)observed(observedSignal);
  else observedSignal.addEventListener('abort',()=>observed(observedSignal),{once:true});
  await pending;return {status:'fixture'};
 }};
 const app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const controller=new AbortController();
 try{
  const request=fetch(`http://127.0.0.1:${server.address().port}`+path,{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',signal:controller.signal});
  await started;controller.abort();await assert.rejects(request,error=>error?.name==='AbortError');
  const signal=await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('mutation cancellation not forwarded')),1000))]);
  assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,true);
  assert.equal(signal.reason?.message,'POD_REQUEST_CANCELLED');
 }finally{release();controller.abort();await new Promise(r=>server.close(r));}
});
test('authenticated reads enforce one fixed server deadline while the client stays connected',async t=>{
 const deadline=new AbortController();let timeoutMs,entered,observed;
 const started=new Promise(resolve=>{entered=resolve;}),cancelled=new Promise(resolve=>{observed=resolve;});
 t.mock.method(AbortSignal,'timeout',ms=>{timeoutMs=ms;return deadline.signal;});
 const db={listOperationsJobs:async(_state,{signal}={})=>{
  entered();
  return new Promise((resolve,reject)=>{
   const stop=()=>{observed(signal);reject(signal.reason);};
   if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});
  });
 }};
 const app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const request=fetch(`http://127.0.0.1:${server.address().port}/jobs`,{headers:{Authorization:`Bearer ${key}`}});
  await started;assert.equal(timeoutMs,30000);
  deadline.abort(new DOMException('deadline','TimeoutError'));
  const signal=await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('request deadline not forwarded')),1000))]);
  assert.equal(signal.aborted,true);assert.equal(signal.reason?.name,'TimeoutError');
  const response=await request;assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:'JOB_LIST_UNAVAILABLE'});
 }finally{deadline.abort();await new Promise(r=>server.close(r));}
});
test('late read completion cannot beat a delayed server deadline callback',async t=>{
 let now=100,timeoutMs,entered,release,signal;
 const started=new Promise(resolve=>{entered=resolve;}),timeout=new AbortController();
 t.mock.method(performance,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',ms=>{timeoutMs=ms;return timeout.signal;});
 const db={listOperationsJobs:async(_state,options)=>{
  signal=options?.signal;entered();return new Promise(resolve=>{release=resolve;});
 }};
 const app=express();app.use(createPodRouter({authorize:operationalAuth(key),env:{},db}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const request=fetch(`http://127.0.0.1:${server.address().port}/jobs`,{headers:{Authorization:`Bearer ${key}`}});
  await started;assert.equal(timeoutMs,30000);assert.equal(signal.aborted,false);
  now=30100;release([]);
  const response=await request;assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:'JOB_LIST_UNAVAILABLE'});
  assert.equal(signal.aborted,true);assert.equal(signal.reason?.message,'POD_REQUEST_TIMEOUT');
 }finally{timeout.abort();await new Promise(r=>server.close(r));}
});
test('template safe box uses x y width height consistently with Python QA',()=>{
 const record={audience:'pod:template',product:'shirt',country:'US',official_source_verified:true,source_url:'https://example.org/template',source_sha256:'a'.repeat(64),observed_at:new Date().toISOString(),template:{platform:'redbubble',dpi:300,size_inches:[2,2],safe_box_px:[400,400,100,100]}};
 assert.deepEqual(validateTemplate(sign(record),key,{platform:'redbubble',product:'shirt',country:'US'}).safe_box_px,[400,400,100,100]);
 record.template.safe_box_px=[400,400,300,300];
 assert.throws(()=>validateTemplate(sign(record),key,{platform:'redbubble',product:'shirt',country:'US'}),/TEMPLATE_SAFE_ZONE_INVALID/);
});
test('requested publication cannot masquerade as enabled without an adapter',async()=>{
 const app=express();app.use(createPodRouter({env:{PUBLICATION_ENABLED:'true',POD_PUBLICATION_ENABLED:'true'},
  status:()=>({status:'DISABLED',production_status:'BLOCKED_PRODUCTION_CONFIGURATION'})}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/status`);const state=await r.json();
  assert.equal(state.publication_enabled,false);assert.equal(state.publication_requested,true);
  assert.equal(state.production_status,'BLOCKED_PRODUCTION_CONFIGURATION');
 }finally{await new Promise(r=>server.close(r));}
});
test('public POD status exposes only inert bounded health fields',async()=>{
 let privateReads=0;
 const state={status:'DISABLED',database_health:{idle_connection_failures:2,
  last_idle_connection_failure_at:'2026-11-06T08:00:00.000Z',last_error_code:'POD_DATABASE_IDLE_CONNECTION_FAILED',
  private_database_url:'postgresql://private'},production_status:'STOPPED',
  production_health:{status:'STOPPED',cycles:3,consecutive_failures:1,
   last_started_at:'2026-11-06T08:00:00.000Z',last_completed_at:'2026-11-06T08:00:01.000Z',
   last_error_code:'QA_FAILED',last_result:'QA_FAILED',private_worker_key:'private'},
  outbox:{status:'DISABLED',delivered:0,failures:0,last_success_at:null,private_outbox_key:'private'},
  private_top_level:'private'};
 Object.defineProperty(state,'private_accessor',{enumerable:true,get(){privateReads++;return 'private';}});
 const app=express();app.use(createPodRouter({env:{},status:()=>state}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/status`),observed=await response.json();
  assert.equal(response.status,200);assert.equal(privateReads,0);
  assert.deepEqual(observed,{status:'DISABLED',database_health:{idle_connection_failures:2,
   last_idle_connection_failure_at:'2026-11-06T08:00:00.000Z',last_error_code:'POD_DATABASE_IDLE_CONNECTION_FAILED'},
   production_status:'STOPPED',production_health:{status:'STOPPED',cycles:3,consecutive_failures:1,
    last_started_at:'2026-11-06T08:00:00.000Z',last_completed_at:'2026-11-06T08:00:01.000Z',
    last_error_code:'QA_FAILED',last_result:'QA_FAILED'},
   outbox:{status:'DISABLED',delivered:0,failures:0,last_success_at:null},publication_enabled:false,
   publication_requested:false,adapters_verified:false});
  assert.doesNotMatch(JSON.stringify(observed),/private|postgresql/i);
 }finally{await new Promise(r=>server.close(r));}
});
test('public POD status rejects executable health fields without invoking them',async()=>{
 let reads=0;const state={database_health:null,production_status:'DISABLED',production_health:null,outbox:{status:'DISABLED',delivered:0,failures:0,last_success_at:null}};
 Object.defineProperty(state,'status',{enumerable:true,get(){reads++;return 'DISABLED';}});
 const app=express();app.use(createPodRouter({env:{},status:()=>state}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/status`),observed=await response.json();
  assert.equal(response.status,503);assert.equal(reads,0);
  assert.deepEqual(observed,{status:'BLOCKED_STATUS_UNAVAILABLE',publication_enabled:false,
   publication_requested:false,adapters_verified:false});
 }finally{await new Promise(r=>server.close(r));}
});
