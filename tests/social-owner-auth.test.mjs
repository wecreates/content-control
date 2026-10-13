import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {EncryptedSocialStore} from '../social-automation.js';
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
