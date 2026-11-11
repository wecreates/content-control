import test from 'node:test';
import assert from 'node:assert/strict';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
const base={POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:'k'.repeat(32)};
const invalid=[undefined,{}, {delivered:NaN},{delivered:Infinity},{delivered:-1},{delivered:-0},
 {delivered:0.5},{delivered:'1'},{delivered:21},{delivered:1,failed:20},
 {delivered:1,failed:NaN},{delivered:1,failed:'0'},{delivered:1,failed:-1},{delivered:1,failed:null}];
for(let index=0;index<invalid.length;index++)
test('malformed delivery counts cannot corrupt health: '+index,async()=>{
 const env={...base};let observed,runtime;
 runtime=startOutboxRuntime({db:{},env,deliver:async()=>invalid[index],wait:async()=>{
  observed=runtime.status();env.POD_OUTBOX_ENABLED='false';
 }});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.deepEqual(observed,{status:'RETRYING',delivered:0,failures:1,last_success_at:null});
});

test('delivery result accessors and proxies are never invoked',async()=>{
 let reads=0;
 const results=[new Proxy({delivered:1},{get(_target,key){if(key==='then')return undefined;reads++;throw Error('private proxy');}})];
 for(const key of ['delivered','failed','nextCursor']){
  results.push(Object.defineProperty({delivered:1,failed:0},key,{get(){reads++;throw Error('private getter');}}));
 }
 for(const result of results){
  const env={...base};const runtime=startOutboxRuntime({db:{},env,deliver:async()=>result,
   wait:async()=>{env.POD_OUTBOX_ENABLED='false';}});
  await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
  assert.equal(runtime.status().delivered,0);assert.equal(runtime.status().failures,1);
  assert.equal(runtime.status().last_success_at,null);
 }
 assert.equal(reads,0);
});

test('a rejected result preserves cursor and clean retry restores health',async()=>{
 const env={...base},cursors=[],delays=[];let calls=0,runtime,observed;
 runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
  cursors.push(options.cursor);calls++;
  return calls===1?{delivered:1,failed:NaN,nextCursor:{id:'must-not-advance'}}:{delivered:2};
 },wait:async delay=>{delays.push(delay);if(calls===2){observed=runtime.status();env.POD_OUTBOX_ENABLED='false';}}});
 await new Promise(resolve=>setImmediate(resolve));await runtime.stop();
 assert.deepEqual(cursors,[null,null]);assert.deepEqual(delays,[30000,15000]);
 assert.equal(observed.status,'RUNNING');assert.equal(observed.delivered,2);
 assert.equal(observed.failures,1);assert.ok(observed.last_success_at);
});
