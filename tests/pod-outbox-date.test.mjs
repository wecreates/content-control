import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
const instant='2026-01-01T00:00:00.123Z';
async function deliver(created_at){
 const event={id:'12b4c678-1234-4321-abcd-123456789abc',job_id:null,kind:'pod.test.date',payload:{},created_at};
 let sent;
 const db={active(){},read:async()=>({rows:[event]}),tx:async fn=>fn({query:async()=>({rowCount:1,rows:[{id:event.id}]})})};
 const result=await deliverOutbox(db,{url:'https://authority.example/events',key:'k'.repeat(32),fetchImpl:async(_url,options)=>{
  sent=JSON.parse(JSON.parse(options.body).payload).event;
  return new Response(JSON.stringify({accepted_event_id:event.id}),{headers:{'content-type':'application/json'}});
 }});
 return {sent,result};
}
test('outbox snapshots a database Date before signing without calling object methods',async()=>{
 let reads=0;
 for(const method of ['getTime','toISOString','toJSON']){
  const date=new Date(instant);
  Object.defineProperty(date,method,{get(){reads++;throw Error('private date getter executed');}});
  const {sent,result}=await deliver(date);
  assert.equal(sent.created_at,instant);assert.equal(result.delivered,1);
 }
 assert.equal(reads,0);
});
test('outbox cannot sign a substituted Date toJSON timestamp',async()=>{
 let calls=0;
 const date=new Date(instant);date.toJSON=()=>{calls++;return '2099-01-01T00:00:00.000Z';};
 const {sent}=await deliver(date);
 assert.equal(sent.created_at,instant);assert.equal(calls,0);
});
test('outbox rejects proxy, invalid and forged Dates without invoking traps',async()=>{
 let traps=0;
 const proxy=new Proxy(new Date(instant),{get(){traps++;throw Error('private date proxy executed');},getPrototypeOf(){traps++;throw Error('private date prototype trap');}});
 for(const value of [proxy,new Date(NaN),Object.create(Date.prototype)])
  await assert.rejects(deliver(value),/^Error: OUTBOX_EVENT_SCOPE_INVALID$/);
 assert.equal(traps,0);
});
