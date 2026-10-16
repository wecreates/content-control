import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createStoredTaskResolvers} from '../integrations/pod/task-resolver.mjs';
import {startProductionRuntime} from '../integrations/pod/production-runtime.mjs';
const key='synthetic-upstream-'.repeat(3);
const env={POD_GRANT_URL:'https://authority.invalid/grant',POD_GRANT_AUTH_KEY:'synthetic-auth-'.repeat(3),POD_UPSTREAM_KEY:key,POD_PRODUCTION_ENABLED:'true'};
const brief={id:'job',business_id:'business',account_id:'account',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
const grant={job_id:'job',business_id:'business',account_id:'account',platform:'redbubble',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false};
function signed(extra={}){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,...grant,...extra});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};}
test('missing or invalid authority never falls back to a valid saved grant',async()=>{
 for(const change of [{POD_GRANT_URL:undefined},{POD_GRANT_URL:''},{POD_GRANT_URL:'http://authority.invalid'},
  {POD_GRANT_AUTH_KEY:undefined},{POD_GRANT_AUTH_KEY:key}]){
  const resolver=createStoredTaskResolvers({}, {env:{...env,...change},fetchImpl:()=>assert.fail('network must not run')});
  await assert.rejects(resolver.resolveGrant({id:brief.id,brief,upstream_envelope:signed()}),/GRANT_AUTHORITY_(REQUIRED|INVALID)/);
  assert.equal(resolver.authorityReady,false);
 }
});
test('worker blocks missing authority before recovery or queue claims',async()=>{
 let touched=false;const db={recover:async()=>{touched=true;},claimProduction:async()=>{touched=true;return null;}};
 const config={...env,POD_GRANT_URL:undefined};
 const runtime=startProductionRuntime({db,env:config,production:createStoredTaskResolvers(db,{env:config})});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.equal(touched,false);assert.equal(runtime.status(),'BLOCKED_GRANT_AUTHORITY');
});
test('stored resolver rechecks authority for each call and honors revocation over queue approval',async()=>{
 let calls=0;const resolver=createStoredTaskResolvers({}, {env,fetchImpl:async(url,options)=>{
  assert.equal(url.href,env.POD_GRANT_URL);assert.deepEqual(JSON.parse(options.body),{job_id:'job'});
  assert.equal(options.redirect,'error');calls++;return new Response(JSON.stringify(signed({revoked:calls>1})));
 }});
 assert.equal(resolver.authorityReady,true);
 const job={id:'job',brief,upstream_envelope:signed()};
 await resolver.resolveGrant(job);await assert.rejects(resolver.resolveGrant(job),/APPROVAL_REVOKED/);assert.equal(calls,2);
});
