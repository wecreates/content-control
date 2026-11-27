import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {EncryptedSocialStore, SocialAutomation} from '../social-automation.js';
import {OwnerAuthentication, OWNER_COOKIE, readCookie} from '../integrations/social-automation/owner-auth.mjs';
import {createOAuthRouter, connectionPage} from '../integrations/social-automation/oauth-router.mjs';
import {initializeSocialService} from '../integrations/social-automation/hosted-service.mjs';
async function fixture(t, owner = 42) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'owner-auth-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=new EncryptedSocialStore({file:path.join(dir,'vault'),key:'e'.repeat(64)});await store.update(()=>{});
 let now=100000;const calls=[];
 const auth=new OwnerAuthentication({store,origin:'https://example.test',clientId:'client',clientSecret:'PRIVATE_CLIENT',ownerId:'42',now:()=>now,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/user')?{id:owner}:{access_token:'PRIVATE_TOKEN',token_type:'bearer'}));}});
 return {auth,store,calls,advance:ms=>now+=ms};
}
test('owner login binds browser and PKCE, consumes state, hashes sessions, verifies numeric owner and logs out',async t=>{
 const {auth,store,calls,advance}=await fixture(t);const begin=await auth.begin(),url=new URL(begin.url),state=url.searchParams.get('state');
 assert.equal(url.origin,'https://github.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 await assert.rejects(auth.complete({state,code:'code'},'x'.repeat(43)),/OWNER_AUTH_FAILED/);assert.equal(calls.length,0);
 const session=await auth.complete({state,code:'code'},begin.binding);
 const request={headers:{cookie:`${OWNER_COOKIE}=${session}`}};
 assert.equal(await auth.authorize(request),'github:42');
 assert.equal(calls.length,2);assert.equal(calls[0].options.redirect,'error');
 const onboarding=(await store.read()).owner_onboarding;
 assert.equal(onboarding.schema_version,1);assert.equal(onboarding.identity_provider,'github');
 assert.equal(onboarding.completed_at,100000);assert.match(onboarding.id,/^[0-9a-f-]{36}$/);
 assert.deepEqual(Object.keys(onboarding).sort(),['completed_at','id','identity_provider','schema_version']);
 const form=new URLSearchParams(calls[0].options.body);assert.equal(form.get('code_verifier').length,43);
 const saved=JSON.stringify(await store.read());for(const secret of [session,'PRIVATE_TOKEN','PRIVATE_CLIENT'])assert.ok(!saved.includes(secret));
 await assert.rejects(auth.complete({state,code:'code'},begin.binding),/OWNER_AUTH_FAILED/);
 advance(28800001);assert.equal(await auth.authorize(request),null);
 await auth.logout(request);assert.deepEqual((await store.read()).owner_sessions,{});
 assert.equal(readCookie({headers:{cookie:`${OWNER_COOKIE}=a; ${OWNER_COOKIE}=b`}},OWNER_COOKIE),null);
});
test('wrong identity, expired state and denied grants never create owner session',async t=>{
 const {auth,store,calls,advance}=await fixture(t,99);let begin=await auth.begin(),state=new URL(begin.url).searchParams.get('state');
 await assert.rejects(auth.complete({state,code:'code'},begin.binding),/OWNER_AUTH_FAILED/);assert.equal((await store.read()).owner_sessions,undefined);
 begin=await auth.begin();state=new URL(begin.url).searchParams.get('state');advance(600001);
 await assert.rejects(auth.complete({state,code:'code'},begin.binding),/OWNER_AUTH_FAILED/);assert.equal(calls.length,2);
 begin=await auth.begin();state=new URL(begin.url).searchParams.get('state');
 await assert.rejects(auth.complete({state,error:'denied'},begin.binding),/OWNER_AUTH_FAILED/);assert.equal((await store.read()).owner_pending[ state ],undefined);
 await assert.rejects(auth.complete({state,code:'code'},begin.binding),/OWNER_AUTH_FAILED/);assert.equal(calls.length,2);
});
test('malformed retained onboarding identity fails closed instead of being repaired',async t=>{
 const {auth,store}=await fixture(t);
 await store.update(d=>{d.owner_onboarding={schema_version:1,id:crypto.randomUUID(),identity_provider:'github',completed_at:true};});
 const begin=await auth.begin(),state=new URL(begin.url).searchParams.get('state');
 await assert.rejects(auth.complete({state,code:'code'},begin.binding),/OWNER_AUTH_FAILED/);
 const saved=await store.read();assert.equal(saved.owner_sessions,undefined);assert.equal(saved.owner_onboarding.completed_at,true);
});
test('HTTP login rejects cross-origin starts and emits protected cookies; disabled host fails closed',async t=>{
 const {auth}=await fixture(t);const app=express();let contexts=[];
 const service={ownerAuth:auth,status:()=>({oauth_providers:['youtube']}),beginAuthorization:async(p,req)=>{if(!await auth.authorize(req))throw Error();contexts.push(p);return {authorization_url:'https://accounts.google.com/'};}};
 app.use('/api/social',createOAuthRouter(service));app.get('/social/connect',connectionPage(service));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/social/auth/start',{method:'POST'})).status,403);
 let r=await fetch(base+'/api/social/auth/start',{method:'POST',headers:{origin:auth.origin},redirect:'manual'});assert.equal(r.status,303);
 const binding=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.match(r.headers.get('set-cookie'),/SameSite=Lax/);
 const state=new URL(r.headers.get('location')).searchParams.get('state');
 r=await fetch(base+'/api/social/auth/callback?'+new URLSearchParams({state,code:'code'}),{headers:{cookie:binding},redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/social/connect');
 const session=r.headers.getSetCookie().find(c=>c.startsWith(OWNER_COOKIE+'=')).split(';')[0];
 r=await fetch(base+'/api/social/oauth/youtube/start',{method:'POST',headers:{origin:auth.origin,cookie:session},redirect:'manual'});assert.equal(r.status,303);assert.deepEqual(contexts,['youtube']);
 assert.equal((await fetch(base+'/api/social/oauth/youtube/start',{method:'POST',headers:{origin:auth.origin}})).status,403);
 r=await fetch(base+'/api/social/auth/logout',{method:'POST',headers:{origin:auth.origin,cookie:session},redirect:'manual'});assert.equal(r.status,303);
 assert.equal((await (await fetch(base+'/api/social/auth/session',{headers:{cookie:session}})).json()).authenticated,false);
 delete service.ownerAuth;assert.equal((await fetch(base+'/api/social/auth/session')).status,503);
 const html=await (await fetch(base+'/social/connect')).text();assert.match(html,/not configured/);assert.doesNotMatch(html,/PRIVATE/);
});
test('OAuth can initialize with empty private vault while read worker remains explicitly off',async t=>{
 const {store}=await fixture(t);const env={SOCIAL_OAUTH_ENABLED:'true',SOCIAL_STORAGE_MODE:'private_durable',SOCIAL_VAULT_FILE:store.file,SOCIAL_VAULT_KEY:'e'.repeat(64),SOCIAL_PUBLIC_ORIGIN:'https://example.test',OWNER_GITHUB_CLIENT_ID:'client',OWNER_GITHUB_CLIENT_SECRET:'secret',OWNER_GITHUB_ID:'42'};
 const service=await initializeSocialService({env});t.after(()=>service.stop());assert.equal(service.status().status,'OAUTH_READY');assert.equal(service.status().oauth_routes_enabled,true);assert.equal(service.status().worker_running,false);assert.equal(service.status().durable_storage_verified,false);
 const blocked=await initializeSocialService({env:{...env,OWNER_GITHUB_ID:'email@example.test'}});assert.equal(blocked.status().status,'ACTIVATION_BLOCKED');assert.equal(blocked.ownerAuth,undefined);
});

test('owner onboarding endpoint reports retained read evidence without provider calls or vault writes',async t=>{
 const {store}=await fixture(t);
 const env={SOCIAL_OAUTH_ENABLED:'true',SOCIAL_STORAGE_MODE:'private_durable',SOCIAL_VAULT_FILE:store.file,
  SOCIAL_VAULT_KEY:'e'.repeat(64),SOCIAL_PUBLIC_ORIGIN:'https://example.test',
  OWNER_GITHUB_CLIENT_ID:'OWNER_CLIENT',OWNER_GITHUB_CLIENT_SECRET:'PRIVATE_OWNER_SECRET',OWNER_GITHUB_ID:'42',
  RENDER_GIT_COMMIT:'a'.repeat(40),
  YOUTUBE_OAUTH_CLIENT_ID:'YT_CLIENT',YOUTUBE_OAUTH_CLIENT_SECRET:'PRIVATE_YT_SECRET',
  YOUTUBE_OAUTH_REDIRECT_URI:'https://example.test/api/social/oauth/youtube/callback',YOUTUBE_CHANNEL_ID:'PRIVATE_CHANNEL'};
 let loginCalls=0;
 const service=await initializeSocialService({env,fetchImpl:async url=>{
  loginCalls++;
  return new Response(JSON.stringify(String(url).endsWith('/user')?{id:42}:{access_token:'PRIVATE_LOGIN',token_type:'bearer'}));
 }});
 let progressReads=0;
 const readProgress=service.ownerOnboarding;
 service.ownerOnboarding=async req=>{progressReads++;return readProgress(req);};
 t.after(()=>service.stop());
 const app=express();
 app.use('/api/social',createOAuthRouter(service));
 app.get('/social/connect',connectionPage(service));
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const url=base+'/api/social/onboarding';
 const connect=base+'/social/connect';
 const signIn=await fetch(connect);
 assert.equal(signIn.headers.get('cache-control'),'no-store');
 const signInPage=await signIn.text();
 assert.match(signInPage,/Sign in as owner with GitHub/);
 assert.doesNotMatch(signInPage,/First read|Read job evidence/);
 assert.equal(progressReads,0);
 const unauthorized=await fetch(url);
 assert.equal(unauthorized.status,403);
 assert.equal((await unauthorized.json()).worker_status,undefined);
 assert.equal(loginCalls,0);
 const begin=await service.ownerAuth.begin();
 const session=await service.ownerAuth.complete({state:new URL(begin.url).searchParams.get('state'),code:'fake'},begin.binding);
 const headers={cookie:`${OWNER_COOKIE}=${session}`};
 const page=async()=>{
  const response=await fetch(connect,{headers});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
  return response.text();
 };
 let response=await fetch(url,{headers});
 assert.equal(response.headers.get('cache-control'),'no-store');
 let progress=await response.json();
 assert.equal(progress.providers[0].status,'CONNECTION_REQUIRED');
 assert.equal(progress.onboarding_journey.status,'CONNECTION_REQUIRED');
 assert.equal(progress.onboarding_journey.signup_status,'OWNER_IDENTITY_RETAINED');
 assert.equal(progress.deployed_source_commit,'a'.repeat(40));
 assert.ok(Number.isSafeInteger(progress.observed_at));
 assert.match(await page(),/YouTube<\/strong> — Connect this account to start onboarding\./);
 const local=new SocialAutomation({store,adapters:{youtube:{
  verify:async grant=>({verified:true,account_id:grant.account_id}),
  read_profile:async()=>({title:'PRIVATE_RESULT'})
 }}});
 await local.connect('youtube',{account_id:'PRIVATE_CHANNEL',access_token:'PRIVATE_ACCESS',
  expires_at:Date.now()+3600000,scopes:[]});
 const pending=await (await fetch(url,{headers})).json();
 assert.equal(pending.providers[0].status,'FIRST_READ_PENDING');
 assert.equal(pending.providers[0].first_read_job_status,'NOT_QUEUED');
 assert.equal(pending.onboarding_journey.status,'FIRST_JOB_REQUIRED');
 assert.ok(pending.onboarding_journey.provider_verified_at>=pending.onboarding_journey.signup_completed_at);
 assert.equal(pending.worker_status,'DISABLED');
 assert.match(await page(),/YouTube<\/strong> — The account is verified\. No read is queued yet\./);
 await local.enqueue({id:'private-job-id',platform:'youtube',operation:'read_profile'});
 assert.equal((await (await fetch(url,{headers})).json()).providers[0].first_read_job_status,'QUEUED');
 assert.match(await page(),/YouTube<\/strong> — The first read is queued\./);
 await local.tick();
 const saved=await fs.readFile(store.file);
 response=await fetch(url,{headers});
 assert.equal(response.status,200);
 const output=await response.text();progress=JSON.parse(output);
 assert.deepEqual(progress.providers.map(p=>p.status),['FIRST_READ_RETAINED','PROVIDER_CONFIGURATION_REQUIRED']);
 assert.deepEqual(progress.providers.map(p=>p.first_read_job_status),['COMPLETED',null]);
 assert.equal(progress.providers[0].first_read_operation,'read_profile');
 assert.equal(progress.onboarding_journey.status,'COMPLETE');
 assert.ok(progress.onboarding_journey.first_successful_job_completed_at>=progress.onboarding_journey.provider_verified_at);
 assert.equal(progress.onboarding_journey.publication_enabled,false);
 assert.equal(progress.onboarding_journey.external_writes_enabled,false);
 assert.equal(progress.worker_status,'DISABLED');
 assert.equal(progress.publication_enabled,false);
 assert.equal(progress.external_writes_enabled,false);
 assert.equal(progress.deployed_source_commit,'a'.repeat(40));
 assert.ok(Number.isSafeInteger(progress.observed_at));
 const ownerPage=await page();
 assert.match(ownerPage,/YouTube<\/strong> — Successful first-read evidence is available\./);
 assert.match(ownerPage,/Instagram<\/strong> — Provider configuration required\./);
 assert.match(ownerPage,/The read worker is disabled\./);
 assert.match(ownerPage,/Read job evidence/);
 assert.equal(loginCalls,2);
 assert.equal(service.status().worker_running,false);
 for(const privateValue of ['PRIVATE_CHANNEL','PRIVATE_ACCESS','PRIVATE_RESULT','PRIVATE_OWNER_SECRET','PRIVATE_YT_SECRET','private-job-id',session]){
  assert.ok(!output.includes(privateValue));
  assert.ok(!ownerPage.includes(privateValue));
 }
 service.ownerOnboarding=async()=>{throw Error('PRIVATE_STORE_ERROR');};
 const unavailablePage=await page();
 assert.match(unavailablePage,/First-read status is temporarily unavailable\./);
 assert.doesNotMatch(unavailablePage,/PRIVATE_STORE_ERROR|Successful first-read evidence/);
 assert.deepEqual(await fs.readFile(store.file),saved);
});

test('owner onboarding separates worker startup, idle polling and failed cycles from retained reads',async t=>{
 for (const outcome of ['idle','failed']) {
  await t.test(outcome,async t=>{
   const {store}=await fixture(t);
   const env={SOCIAL_OAUTH_ENABLED:'true',SOCIAL_WORKER_ENABLED:'true',SOCIAL_STORAGE_MODE:'postgres_encrypted',
    SOCIAL_PUBLIC_ORIGIN:'https://example.test',OWNER_GITHUB_CLIENT_ID:'client',
    OWNER_GITHUB_CLIENT_SECRET:'secret',OWNER_GITHUB_ID:'42'};
   let reads=0;
   const {promise:holdFirstCycle,resolve:release}=Promise.withResolvers();
   const service=await initializeSocialService({env,postgresStoreFactory:()=>({
    update:fn=>store.update(fn),
    async read(){
     if (++reads===2) {
      await holdFirstCycle;
      if(outcome==='failed') throw Error('PRIVATE_WORKER_FAILURE');
     }
     return store.read();
    }
   }),fetchImpl:async url=>{
    assert.ok(['github.com','api.github.com'].includes(new URL(url).hostname));
    return new Response(JSON.stringify(String(url).endsWith('/user')?{id:42}:{access_token:'PRIVATE_LOGIN',token_type:'bearer'}));
   }});
   t.after(async()=>{release();await service.stop();});
   const begin=await service.ownerAuth.begin();
   const session=await service.ownerAuth.complete({state:new URL(begin.url).searchParams.get('state'),code:'fake'},begin.binding);
   const context={headers:{cookie:`${OWNER_COOKIE}=${session}`}};
   const initial=await service.ownerOnboarding(context);
   assert.equal(initial.worker_status,'AWAITING_FIRST_CYCLE');
   release();
   const deadline=performance.now()+5000;
   while(service.status().last_cycle.status==='NOT_STARTED'&&performance.now()<deadline) await new Promise(resolve=>setTimeout(resolve,10));
   const progress=await service.ownerOnboarding(context);
   assert.equal(progress.worker_status,outcome==='idle'?'SCHEDULER_ACTIVE':'UNAVAILABLE');
   assert.deepEqual(progress.providers,initial.providers);
   assert.ok(!JSON.stringify(progress).includes('PRIVATE_WORKER_FAILURE'));
  });
 }
});
