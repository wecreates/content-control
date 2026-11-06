import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {storageLifetimeStatus} from '../integrations/pod/storage-expiry.mjs';
import {createPodRouter} from '../integrations/pod/router.mjs';
const now=Date.parse('2026-11-06T18:00:00Z');
for(const [value,clock,status,cutoff] of [
 [undefined,now,'UNCONFIGURED',null],['private-invalid-value',now,'INVALID',null],
 [null,now,'INVALID',null],['2026-12-01',now,'INVALID',null],
 ['2026-12-01T00:00:00Z',NaN,'CLOCK_INVALID','2026-12-01T00:00:00.000Z'],
 [new Date(now).toISOString(),now,'EXPIRED',new Date(now).toISOString()],
 [new Date(now-1).toISOString(),now,'EXPIRED',new Date(now-1).toISOString()],
 [new Date(now+86400000).toISOString(),now,'EXPIRING',new Date(now+86400000).toISOString()],
 [new Date(now+86400001).toISOString(),now,'CONFIGURED_WINDOW_VALID',new Date(now+86400001).toISOString()],
])test(`configured storage window reports ${status}: ${String(value)}`,()=>{
 assert.deepEqual(storageLifetimeStatus(value,clock),{status,operational_cutoff:cutoff,
  scope:'configured_cutoff_only',acceptance_verified:false});
});
for(const broken of [false,true])test(`disabled public status exposes cutoff without database/auth or secret access, broken=${broken}`,async t=>{
 t.mock.method(Date,'now',()=>now);let touched=0;
 const env={POD_STORAGE_EXPIRES_AT:'2026-12-01T00:00:00Z'};
 Object.defineProperty(env,'POD_DATABASE_URL',{get(){touched++;throw Error('private credential');}});
 const app=express();app.use(createPodRouter({env,db:new Proxy({},{get(){touched++;throw Error();}}),
  authorize:()=>{touched++;throw Error();},status:()=>{if(broken)throw Error('private backend');
   return {status:'DISABLED',production_status:'DISABLED'};}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const r=await fetch(`http://127.0.0.1:${server.address().port}/status`),body=await r.json();
  assert.equal(r.status,broken?503:200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(body.storage_lifetime,storageLifetimeStatus(env.POD_STORAGE_EXPIRES_AT,now));
  assert.equal(body.publication_enabled,false);assert.equal(body.adapters_verified,false);
  assert.equal(touched,0);assert.doesNotMatch(JSON.stringify(body),/private|credential|postgresql/);
 }finally{await new Promise(r=>server.close(r));}
});
test('public cutoff ignores accessor and Proxy environment fields without invocation',async()=>{
 let reads=0;const env=Object.defineProperty({},'POD_STORAGE_EXPIRES_AT',{get(){reads++;throw Error();}});
 for(const candidate of [env,new Proxy({},{get(){reads++;throw Error();},getOwnPropertyDescriptor(){reads++;throw Error();}})]){
  const app=express();app.use(createPodRouter({env:candidate,status:()=>({status:'DISABLED',production_status:'DISABLED'})}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const r=await fetch(`http://127.0.0.1:${server.address().port}/status`),body=await r.json();
   assert.equal(r.status,200);assert.equal(body.storage_lifetime.status,'UNCONFIGURED');assert.equal(reads,0);
  }finally{await new Promise(r=>server.close(r));}
 }
});
