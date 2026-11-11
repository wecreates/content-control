import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {getEventListeners} from 'node:events';
import {createGrantResolver} from '../integrations/pod/grant-client.mjs';
const env={POD_GRANT_URL:'https://authority.example/grant',POD_GRANT_AUTH_KEY:'a'.repeat(32),POD_UPSTREAM_KEY:'s'.repeat(32)};
const brief={id:'job',business_id:'business',account_id:'account',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
test('grant call rejects executable cancellation options without invoking them',async()=>{
 let reads=0,calls=0;const trap=()=>{reads++;throw Error('private option getter');};
 const resolve=createGrantResolver({env,fetchImpl:async()=>{calls++;return response();}});
 for(const options of [{get signal(){return trap();}},new Proxy({},{get:trap,getOwnPropertyDescriptor:trap})])
  await assert.rejects(resolve({id:'job',brief},options),/^Error: GRANT_OPTIONS_UNVERIFIED$/);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('grant call rejects forged and Proxy signals before dispatch without traps',async()=>{
 let reads=0,calls=0;const trap=()=>{reads++;throw Error('private signal getter');};
 const resolve=createGrantResolver({env,fetchImpl:async()=>{calls++;return response();}});
 for(const signal of [{get aborted(){return trap();}},new Proxy(new AbortController().signal,{get:trap})])
  await assert.rejects(resolve({id:'job',brief},{signal}),TypeError);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('already cancelled grant retains native reason despite shadowed members',async()=>{
 const controller=new AbortController(),reason=Error('stopped');controller.abort(reason);
 Object.defineProperty(controller.signal,'aborted',{get(){assert.fail('public flag read');}});
 const resolve=createGrantResolver({env,fetchImpl:()=>assert.fail('transport started')});
 await assert.rejects(resolve({id:'job',brief},{signal:controller.signal}),e=>e===reason);
 assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
test('valid grant ignores shadowed public signal members and releases its relay',async()=>{
 const controller=new AbortController();
 for(const key of ['aborted','reason','addEventListener','removeEventListener','throwIfAborted'])
  Object.defineProperty(controller.signal,key,{get(){assert.fail('public signal member read');}});
 const result=await createGrantResolver({env,fetchImpl:async()=>response()})({id:'job',brief},{signal:controller.signal});
 assert.equal(JSON.parse(result.payload).publication_permission,false);
 assert.equal(getEventListeners(controller.signal,'abort').length,0);
});
for(const phase of ['headers','body'])test(`grant ${phase} wait ignores synthetic events but honors native abort`,{timeout:2000},async()=>{
 const controller=new AbortController();let entered,finish,cancelled=0;
 const started=new Promise(r=>entered=r),pending=new Promise(r=>finish=r);
 const fetchImpl=phase==='headers'?()=>{entered();return pending;}:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),body:{getReader(){return {read(){entered();return pending;},cancel(){cancelled++;},releaseLock(){}};}}});
 const operation=createGrantResolver({env,fetchImpl})({id:'job',brief},{signal:controller.signal});
 let settled=false;operation.then(()=>settled=true,()=>settled=true);
 try{
  await started;controller.signal.dispatchEvent(new Event('abort'));await new Promise(r=>setImmediate(r));assert.equal(settled,false);
  Object.defineProperty(controller.signal,'aborted',{value:false});controller.abort();
  await assert.rejects(operation,{name:'AbortError'});
  assert.equal(getEventListeners(controller.signal,'abort').length,0);assert.equal(cancelled,phase==='body'?1:0);
 }finally{controller.abort();finish(phase==='headers'?response():{done:true});}
});
function response(extra={}){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,job_id:'job',business_id:'business',account_id:'account',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,...extra});return new Response(JSON.stringify({payload,signature:crypto.createHmac('sha256',env.POD_UPSTREAM_KEY).update(payload).digest('hex')}),{headers:{'content-type':'application/json'}});}
function responseAt(now,extra={}){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:now-1,expires_at_ms:now+60000,job_id:'job',business_id:'business',account_id:'account',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,...extra});return new Response(JSON.stringify({payload,signature:crypto.createHmac('sha256',env.POD_UPSTREAM_KEY).update(payload).digest('hex')}),{headers:{'content-type':'application/json'}});}
test('fresh authority grant replaces expired queue envelope',async()=>{
 const resolve=createGrantResolver({env,fetchImpl:async(_url,options)=>{assert.deepEqual(JSON.parse(options.body),{job_id:'job'});assert.equal(options.redirect,'error');return response();}});
 const result=await resolve({id:'job',brief,upstream_envelope:{expired:true}});assert.equal(JSON.parse(result.payload).publication_permission,false);
});
test('authority response cannot follow a job or task scope changed during lookup',async()=>{
 for(const change of ['job','task']){
  const originalTask='a'.repeat(64);
  const job={id:'job',brief:{...brief,task_sha256:originalTask}};
  let requested;
  const resolve=createGrantResolver({env,fetchImpl:async(_url,options)=>{
   requested=JSON.parse(options.body);
   if(change==='job'){
    job.id='other';job.brief={...job.brief,id:'other'};
    return response({job_id:'other',task_sha256:originalTask});
   }
   job.brief.task_sha256='b'.repeat(64);
   return response({task_sha256:job.brief.task_sha256});
  }});
  await assert.rejects(resolve(job),change==='job'?/^Error: GRANT_SCOPE_MISMATCH$/:/^Error: TASK_SCOPE_MISMATCH$/);
  assert.deepEqual(requested,{job_id:'job'});
 }
});
test('a valid grant is checked against the original scope without rereading the caller',async()=>{
 const job={id:'job',brief:{...brief}};let reads=0;
 const resolve=createGrantResolver({env,fetchImpl:async()=>{
  Object.defineProperty(job,'brief',{get(){reads++;throw Error('late caller property read');}});
  return response();
 }});
 assert.equal(JSON.parse((await resolve(job)).payload).job_id,'job');
 assert.equal(reads,0);
});
test('grant scope rejects getters, proxies, and inherited identity before dispatch',async()=>{
 let reads=0,calls=0;
 const resolve=createGrantResolver({env,fetchImpl:async()=>{calls++;return response();}});
 const trap=()=>{reads++;throw Error('scope trap executed');};
 const jobs=[
  {get id(){return trap();},brief},
  {id:'job',get brief(){return trap();}},
  new Proxy({id:'job',brief},{get:trap,getOwnPropertyDescriptor:trap}),
  {id:'job',brief:new Proxy(brief,{get:trap,getOwnPropertyDescriptor:trap})},
  {id:'job',brief:{...brief,get account_id(){return trap();}}},
  {id:'job',brief:{...brief,get task_sha256(){return trap();}}},
  {id:'job',brief:Object.create(brief)}
 ];
 for(const job of jobs)await assert.rejects(resolve(job),/^Error: GRANT_REQUEST_INVALID$/);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('authority lookup requires an exact primitive durable job scope before dispatch',async()=>{
 for(const job of [
  {id:{toJSON:()=>brief.id},brief},
  {id:new String(brief.id),brief},
  {id:[brief.id],brief},
  {id:'other',brief},
  {id:'bad/id',brief:{...brief,id:'bad/id'}},
  {id:'x'.repeat(101),brief:{...brief,id:'x'.repeat(101)}},
 ]){
  let calls=0;
  const resolve=createGrantResolver({env,fetchImpl:async()=>{calls++;return response();}});
  await assert.rejects(resolve(job),/^Error: GRANT_REQUEST_INVALID$/);
  assert.equal(calls,0);
 }
});
for(const [name,extra] of [['revocation',{revoked:true}],['wrong scope',{account_id:'other'}],['expired',{expires_at_ms:Date.now()-1}],['nearly expired',{expires_at_ms:Date.now()+1000}]])test(name+' blocks production',async()=>{
 await assert.rejects(createGrantResolver({env,fetchImpl:async()=>response(extra)})({id:'job',brief}));
});
test('authority failure never falls back to cached approval',async()=>{
 await assert.rejects(createGrantResolver({env,fetchImpl:async()=>new Response('',{status:503})})({id:'job',brief,upstream_envelope:{valid:true}}),/GRANT_AUTHORITY_BLOCKED/);
});
test('credentials and transport are constrained',()=>{
 assert.throws(()=>createGrantResolver({env:{...env,POD_GRANT_URL:'http://authority.example'}}));
 assert.throws(()=>createGrantResolver({env:{...env,POD_GRANT_AUTH_KEY:env.POD_UPSTREAM_KEY}}));
 const authKey='\ud800'.repeat(11),signingKey='\ud801'.repeat(11);
 assert.notEqual(authKey,signingKey);
 assert.ok(Buffer.from(authKey).equals(Buffer.from(signingKey)));
 assert.throws(()=>createGrantResolver({env:{...env,POD_GRANT_AUTH_KEY:authKey,POD_UPSTREAM_KEY:signingKey}}),/GRANT_AUTHORITY_INVALID/);
});
test('clock becoming invalid after envelope verification cannot authorize a fresh grant',async t=>{
 const now=1800000000000,envelope=responseAt(now);let calls=0;
 t.mock.method(Date,'now',()=>++calls===1?now:NaN);
 const resolve=createGrantResolver({env,fetchImpl:async()=>envelope});
 await assert.rejects(resolve({id:'job',brief}),/^Error: GRANT_CLOCK_INVALID$/);
 assert.equal(calls,2);
});
test('clock rollback before signed issuance cannot authorize a fresh grant',async t=>{
 const now=1800000000000,envelope=responseAt(now);let calls=0;
 t.mock.method(Date,'now',()=>++calls===1?now:now-2);
 const resolve=createGrantResolver({env,fetchImpl:async()=>envelope});
 await assert.rejects(resolve({id:'job',brief}),/^Error: GRANT_CLOCK_INVALID$/);
 assert.equal(calls,2);
});


test('grant resolver snapshots authority credentials before caller mutation',async()=>{
 const mutableEnv={...env};
 const initialAuthKey=mutableEnv.POD_GRANT_AUTH_KEY;
 const replacementSigningKey='t'.repeat(32);
 let authorization;
 const resolve=createGrantResolver({env:mutableEnv,fetchImpl:async(_url,options)=>{
  authorization=options.headers.authorization;
  const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',
   issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,job_id:'job',
   business_id:'business',account_id:'account',platform:'kdp',max_mode:'PRELAUNCH',
   production_permission:true,publication_permission:false,revoked:false});
  const signature=crypto.createHmac('sha256',replacementSigningKey).update(payload).digest('hex');
  return new Response(JSON.stringify({payload,signature}),{headers:{'content-type':'application/json'}});
 }});
 mutableEnv.POD_GRANT_AUTH_KEY='b'.repeat(32);
 mutableEnv.POD_UPSTREAM_KEY=replacementSigningKey;
 await assert.rejects(resolve({id:'job',brief}),/^Error: SIGNATURE_INVALID$/);
 assert.equal(authorization,'Bearer '+initialAuthKey);
});


test('grant resolver rejects executable authority configuration without invocation',()=>{
 let reads=0;
 for(const key of ['env','fetchImpl']){
  const options={};
  Object.defineProperty(options,key,{enumerable:true,get(){reads++;throw Error('grant option getter executed');}});
  assert.throws(()=>createGrantResolver(options),/^Error: GRANT_OPTIONS_UNVERIFIED$/,key);
 }
 const proxyOptions=new Proxy({},{get(){reads++;throw Error('grant option proxy executed');}});
 assert.throws(()=>createGrantResolver(proxyOptions),/^Error: GRANT_OPTIONS_UNVERIFIED$/);
 for(const key of ['POD_GRANT_URL','POD_GRANT_AUTH_KEY','POD_UPSTREAM_KEY']){
  const config={...env};
  Object.defineProperty(config,key,{enumerable:true,get(){reads++;throw Error('grant environment getter executed');}});
  assert.throws(()=>createGrantResolver({env:config}),/^Error: GRANT_ENV_UNVERIFIED$/,key);
 }
 const proxyEnv=new Proxy({...env},{get(){reads++;throw Error('grant environment proxy executed');}});
 assert.throws(()=>createGrantResolver({env:proxyEnv}),/^Error: GRANT_ENV_UNVERIFIED$/);
 assert.equal(reads,0);
});
