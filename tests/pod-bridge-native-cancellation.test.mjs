import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from '../integrations/pod/http-response.mjs';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('bridge abort checks cannot be bypassed by a shadowed method',async()=>{
 const controller=new AbortController();controller.abort();let reads=0;
 Object.defineProperty(controller.signal,'throwIfAborted',{get(){reads++;return ()=>{};}});
 assert.throws(()=>assertBridgeRequest(controller.signal),{name:'AbortError'});
 await assert.rejects(fetchBridgeResponse(()=>assert.fail('transport started'),'https://authority.example',{signal:controller.signal}),{name:'AbortError'});
 assert.equal(reads,0);
});
test('bridge rejects Proxy signals without executing traps',async()=>{
 let reads=0;
 const signal=new Proxy(new AbortController().signal,{get(){reads++;assert.fail('signal Proxy read');}});
 await assert.rejects(fetchBridgeResponse(()=>assert.fail('transport started'),'https://authority.example',{signal}),/^TypeError: BRIDGE_SIGNAL_INVALID$/);
 assert.equal(reads,0);
});
for(const phase of ['headers','body']){
 test(`bridge ${phase} ignores synthetic abort without losing real cancellation`,{timeout:2000},async()=>{
  const controller=new AbortController();let entered,finish,cancelled=0;
  const started=new Promise(resolve=>entered=resolve);
  const pending=new Promise(resolve=>finish=resolve);
  const body={getReader(){return {read(){entered();return pending;},cancel(){cancelled++;},releaseLock(){}};}};
  const operation=phase==='headers'?
   fetchBridgeResponse(()=>{entered();return pending;},'https://authority.example',{signal:controller.signal}):
   readBridgeJSON({ok:true,headers:new Headers(),body},{maxBytes:16,statusError:'STATUS',sizeError:'SIZE',signal:controller.signal});
  let outcome='pending';operation.then(()=>outcome='resolved',()=>outcome='rejected');
  try{
   await started;controller.signal.dispatchEvent(new Event('abort'));await turn();
   assert.equal(outcome,'pending','synthetic events must not cancel transport or body waits');
   controller.abort();await assert.rejects(operation,{name:'AbortError'});
   assert.equal(getEventListeners(controller.signal,'abort').length,0);
   assert.equal(cancelled,phase==='body'?1:0);
  }finally{controller.abort();finish(phase==='headers'?new Response('{}'):{done:true});await turn();}
 });
 test(`bridge ${phase} honors native abort despite shadowed public members`,{timeout:2000},async()=>{
  const controller=new AbortController();let entered,finish,reads=0;
  const started=new Promise(resolve=>entered=resolve),pending=new Promise(resolve=>finish=resolve);
  const shadow=()=>{for(const key of ['aborted','reason','throwIfAborted','addEventListener','removeEventListener'])
   Object.defineProperty(controller.signal,key,{get(){reads++;throw Error('private signal member');},configurable:true});};
  const body={getReader(){return {read(){shadow();entered();return pending;},cancel(){},releaseLock(){}};}};
  const operation=phase==='headers'?
   fetchBridgeResponse(()=>{shadow();entered();return pending;},'https://authority.example',{signal:controller.signal}):
   readBridgeJSON({ok:true,headers:new Headers(),body},{maxBytes:16,statusError:'STATUS',sizeError:'SIZE',signal:controller.signal});
  operation.catch(()=>{});
  try{
   await started;controller.abort();await assert.rejects(operation,{name:'AbortError'});
   assert.equal(reads,0);assert.equal(getEventListeners(controller.signal,'abort').length,0);
  }finally{controller.abort();finish(phase==='headers'?new Response('{}'):{done:true});await turn();}
 });
}
