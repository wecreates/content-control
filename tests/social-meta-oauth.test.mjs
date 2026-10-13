import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstagramOAuth} from '../integrations/social-automation/meta-oauth.mjs';
import {SocialOAuthCoordinator} from '../integrations/social-automation/oauth-coordinator.mjs';
const config={clientId:'123',clientSecret:'PRIVATE_SECRET',redirectUri:'https://example.test/api/social/oauth/instagram/callback',accountId:'456',now:()=>100000};
const scopes=['instagram_basic','pages_read_engagement','pages_show_list'];
function reply(data,status=200){return new Response(JSON.stringify(data),{status});}
test('Instagram confidential-client flow pins endpoints and validates granted read permissions',async()=>{
 const calls=[];const client=createInstagramOAuth({...config,fetchImpl:async(url,options)=>{calls.push({url,options});return reply(url.pathname.endsWith('permissions')?{data:scopes.map(permission=>({permission,status:'granted'}))}:{access_token:calls.length===1?'SHORT_PRIVATE':'LONG_PRIVATE',token_type:'bearer',expires_in:5000});}});
 const url=new URL(client.authorizationUrl({state:'state',challenge:'challenge'}));assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.searchParams.get('state'),'state');assert.equal(url.searchParams.get('scope'),scopes.join(','));assert.ok(!url.href.includes('PRIVATE'));assert.ok(!url.href.includes('publish'));
 const grant=await client.exchange({code:'code'});assert.equal(grant.account_id,'456');assert.equal(grant.access_token,'LONG_PRIVATE');assert.equal(grant.expires_at,5100000);assert.deepEqual(grant.scopes,scopes);
 assert.equal(calls.length,3);for(const {url,options} of calls){assert.equal(url.origin,'https://graph.facebook.com');assert.equal(options.redirect,'error');assert.ok(!url.href.includes('PRIVATE'));}
 assert.equal(new URLSearchParams(calls[1].options.body).get('grant_type'),'fb_exchange_token');assert.equal(calls[2].options.headers.Authorization,'Bearer LONG_PRIVATE');
});
test('Instagram exchange refuses missing scopes, malformed expiry, revoked grants and oversized bodies',async()=>{
 const clients=[
  createInstagramOAuth({...config,fetchImpl:async url=>reply(url.pathname.endsWith('permissions')?{data:[{permission:'instagram_basic',status:'declined'}]}:{access_token:'PRIVATE',token_type:'bearer',expires_in:5000})}),
  createInstagramOAuth({...config,fetchImpl:async()=>reply({access_token:'PRIVATE',token_type:'bearer',expires_in:0})}),
  createInstagramOAuth({...config,fetchImpl:async()=>reply({error:{message:'PRIVATE'}},401)}),
  createInstagramOAuth({...config,fetchImpl:async()=>reply({data:'x'.repeat(65537)})})
 ];
 for(const client of clients)await assert.rejects(client.exchange({code:'code'}),e=>['PERMISSION_DENIED','OAUTH_EXCHANGE_FAILED'].includes(e.message));
 const abort=new AbortController();abort.abort();let calls=0;await assert.rejects(createInstagramOAuth({...config,fetchImpl:async()=>calls++}).exchange({code:'code'},{signal:abort.signal}),/EXCHANGE/);assert.equal(calls,0);
});
test('Instagram callback connects only through coordinator identity verification and single-use owner state',async()=>{
 let data={};const store={update:async fn=>fn(data)};let verifies=0;
 const provider=createInstagramOAuth({...config,fetchImpl:async url=>reply(url.pathname.endsWith('permissions')?{data:scopes.map(permission=>({permission,status:'granted'}))}:{access_token:'PRIVATE',token_type:'bearer',expires_in:5000})});
 const coordinator=new SocialOAuthCoordinator({store,providers:{instagram:provider},authorizeOwner:async req=>req.owner,runtime:{connect:async(platform,grant)=>{assert.equal(platform,'instagram');assert.equal(grant.account_id,'456');verifies++;}}});
 const start=await coordinator.begin('instagram',{owner:'verified-owner'}),state=new URL(start.authorization_url).searchParams.get('state');
 await assert.rejects(coordinator.complete('instagram',{state,code:'code'},{owner:'other-owner'}),/STATE/);assert.equal(verifies,0);
 await coordinator.complete('instagram',{state,code:'code'},{owner:'verified-owner'});assert.equal(verifies,1);
 await assert.rejects(coordinator.complete('instagram',{state,code:'code'},{owner:'verified-owner'}),/STATE/);
});
