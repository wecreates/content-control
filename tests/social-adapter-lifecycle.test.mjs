import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstagramAdapter} from '../integrations/social-automation/instagram-adapter.mjs';
const grant={account_id:'1234',access_token:'PRIVATE'};
test('cancelled caller prevents all network activity including the second media request',async()=>{
 const controller=new AbortController();let calls=0;
 const adapter=createInstagramAdapter({fetchImpl:async(url,{signal})=>{
  calls++;assert.equal(signal.aborted,false);controller.abort();
  return new Response(JSON.stringify({id:'1234',username:'private'}));
 }});
 await assert.rejects(adapter.read_media(grant,{}, {signal:controller.signal}),/PROVIDER_FAILED/);
 assert.equal(calls,1);
 await assert.rejects(adapter.verify(grant,{signal:controller.signal}),/PROVIDER_FAILED/);
 assert.equal(calls,1);
});
test('worker cancellation reaches an in-flight provider request',async()=>{
 const controller=new AbortController();let started;
 const ready=new Promise(r=>started=r);
 const adapter=createInstagramAdapter({fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(Error('private transport detail')),{once:true});started();
 })});
 const pending=adapter.verify(grant,{signal:controller.signal});await ready;controller.abort();
 await assert.rejects(pending,e=>e.message==='PROVIDER_FAILED');
});
test('HTTP authorization failures remain permanent even with non-JSON bodies',async()=>{
 for(const [status,reason] of [[401,'REAUTHORIZE'],[403,'PERMISSION_DENIED']]){
  const adapter=createInstagramAdapter({fetchImpl:async()=>new Response('PRIVATE',{status})});
  await assert.rejects(adapter.verify(grant),e=>e.message===reason);
 }
});
test('invalid timeout configuration is refused before calling provider',()=>{
 for(const timeoutMs of [0,-1,NaN,Infinity,20001])assert.throws(()=>createInstagramAdapter({timeoutMs}),/INVALID_ADAPTER_CONFIGURATION/);
});
