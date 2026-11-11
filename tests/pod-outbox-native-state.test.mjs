import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
const config={url:'https://authority.example/events',key:'k'.repeat(32),continueOnError:true};
for(const phase of ['entry','selection'])test(`outbox stops on native abort at ${phase} despite a false public flag`,async()=>{
 const controller=new AbortController();let reads=0,active=0;
 Object.defineProperty(controller.signal,'aborted',{value:false});
 if(phase==='entry')controller.abort();
 const db={read:async()=>{reads++;controller.abort();return {rows:[{id:'event'}]};},active(){active++;},tx(){assert.fail('delivery marker attempted');}};
 assert.deepEqual(await deliverOutbox(db,{...config,signal:controller.signal,fetchImpl:()=>assert.fail('network attempted')}),{delivered:0,failed:0,nextCursor:null});
 assert.equal(reads,phase==='entry'?0:1);assert.equal(active,0);
});
test('outbox ignores a false positive public abort flag',async()=>{
 const controller=new AbortController();let reads=0,active=0;
 Object.defineProperty(controller.signal,'aborted',{get(){assert.fail('public aborted getter');}});
 const result=await deliverOutbox({read:async()=>{reads++;return {rows:[]};},active(){active++;}}, {...config,signal:controller.signal});
 assert.deepEqual(result,{delivered:0,failed:0,nextCursor:null});assert.equal(reads,1);assert.equal(active,1);
});
for(const proxy of [false,true])test(`outbox rejects forged signals before storage (Proxy=${proxy})`,async()=>{
 let reads=0;
 const target={get aborted(){reads++;assert.fail('forged flag read');}};
 const signal=proxy?new Proxy(target,{get(){reads++;assert.fail('Proxy trap');}}):target;
 await assert.rejects(deliverOutbox({read(){assert.fail('storage attempted');}},{...config,signal}),TypeError);
 assert.equal(reads,0);
});
for(const phase of ['none','fetch','commit'])test(`outbox uses native state across ${phase} delivery`,async()=>{
 const controller=new AbortController();let active=0,updates=0;
 Object.defineProperty(controller.signal,'aborted',{get(){assert.fail('public abort flag read');}});
 const db={read:async()=>({rows:[{id:'event'}]}),active(){active++;},tx:async(fn,options)=>{
  assert.equal(options.signal,controller.signal);
  const result=await fn({query:async()=>{updates++;return {rowCount:1,rows:[{id:'event'}]};}});
  if(phase==='commit')controller.abort();return result;
 }};
 const result=await deliverOutbox(db,{...config,signal:controller.signal,fetchImpl:async()=>{
  if(phase==='fetch')controller.abort();
  return new Response('{"accepted_event_id":"event"}',{headers:{'content-type':'application/json'}});
 }});
 assert.deepEqual(result,{delivered:phase==='fetch'?0:1,failed:0,nextCursor:null});
 assert.equal(updates,phase==='fetch'?0:1);assert.equal(active,phase==='none'?2:1);
});
