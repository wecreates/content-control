import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createGrantResolver} from '../integrations/pod/grant-client.mjs';
const env={POD_GRANT_URL:'https://authority.example/grant',POD_GRANT_AUTH_KEY:'a'.repeat(32),POD_UPSTREAM_KEY:'s'.repeat(32)};
const brief={id:'job',business_id:'business',account_id:'account',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
function response(extra={}){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,job_id:'job',business_id:'business',account_id:'account',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,...extra});return new Response(JSON.stringify({payload,signature:crypto.createHmac('sha256',env.POD_UPSTREAM_KEY).update(payload).digest('hex')}),{headers:{'content-type':'application/json'}});}
function responseAt(now,extra={}){const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:now-1,expires_at_ms:now+60000,job_id:'job',business_id:'business',account_id:'account',platform:'kdp',max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false,...extra});return new Response(JSON.stringify({payload,signature:crypto.createHmac('sha256',env.POD_UPSTREAM_KEY).update(payload).digest('hex')}),{headers:{'content-type':'application/json'}});}
test('fresh authority grant replaces expired queue envelope',async()=>{
 const resolve=createGrantResolver({env,fetchImpl:async(_url,options)=>{assert.deepEqual(JSON.parse(options.body),{job_id:'job'});assert.equal(options.redirect,'error');return response();}});
 const result=await resolve({id:'job',brief,upstream_envelope:{expired:true}});assert.equal(JSON.parse(result.payload).publication_permission,false);
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
