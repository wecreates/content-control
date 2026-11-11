import test from 'node:test';
import assert from 'node:assert/strict';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
const base={POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:'k'.repeat(32)};
const valid={id:'12b4c678-1234-4321-abcd-123456789abc',created_at:'2026-01-01 00:00:00.000123+00'};
for(const [name,cursor] of [['false',false],['missing',{}],['incomplete',{id:valid.id}],
 ['bad ID',{...valid,id:'other'}],['object timestamp',{...valid,created_at:{}}],
 ['blank timestamp',{...valid,created_at:' '}],['NUL timestamp',{...valid,created_at:'a\0b'}],
 ['invalid Unicode',{...valid,created_at:'\ud800'}],['oversized timestamp',{...valid,created_at:'a'.repeat(129)}],
 ['extra member',{...valid,extra:true}]])
test('reject malformed cursor before counters advance: '+name,async()=>{
 const env={...base};let observed,runtime;
 runtime=startOutboxRuntime({db:{},env,deliver:async()=>({delivered:1,failed:0,nextCursor:cursor}),
  wait:async()=>{observed=runtime.status();env.POD_OUTBOX_ENABLED='false';}});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.deepEqual(observed,{status:'RETRYING',delivered:0,failures:1,last_success_at:null});
});

test('cursor Proxy traps are never invoked',async()=>{
 let reads=0;const env={...base},cursor=new Proxy(valid,{get(){reads++;},ownKeys(){reads++;return [];}});
 const runtime=startOutboxRuntime({db:{},env,deliver:async()=>({delivered:1,failed:0,nextCursor:cursor}),
  wait:async()=>{env.POD_OUTBOX_ENABLED='false';}});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.equal(reads,0);assert.equal(runtime.status().delivered,0);assert.equal(runtime.status().failures,1);
});
for(const field of ['id','created_at'])
test('outbox snapshots cursor '+field+' without invoking getters',async()=>{
 let reads=0,calls=0,runtime,observed;
 const env={...base},cursor=Object.defineProperty({...valid},field,{get(){reads++;return valid[field];}});
 runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
  calls++;if(calls===1)return {delivered:0,failed:20,nextCursor:cursor};
  if(options.cursor)void options.cursor[field];return {delivered:0,failed:0};
 },wait:async()=>{observed=runtime.status();env.POD_OUTBOX_ENABLED='false';}});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.equal(reads,0);assert.equal(observed.delivered,0);assert.equal(observed.failures,1);
 assert.equal(observed.last_success_at,null);
});

test('cursor fields are captured before polling callbacks can mutate them',async()=>{
 let calls=0;const env={...base},cursor={...valid},seen=[];
 const runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
  seen.push(options.cursor);calls++;
  return calls===1?{delivered:0,failed:20,nextCursor:cursor}:{delivered:0,failed:0};
 },wait:async()=>{if(calls===1){cursor.id='changed';cursor.created_at='changed';}
  else env.POD_OUTBOX_ENABLED='false';}});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.deepEqual(seen,[null,valid]);assert.equal(Object.isFrozen(seen[1]),true);
});
