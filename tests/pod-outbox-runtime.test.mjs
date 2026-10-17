import test from 'node:test';
import assert from 'node:assert/strict';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const env={POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:'k'.repeat(32)};
test('disabled and incomplete configurations never deliver',async()=>{
 for(const config of [{},{...env,POD_OUTBOX_KEY:''},{...env,POD_OUTBOX_URL:'http://example.com'},{...env,POD_OUTBOX_POLL_MS:'0'}]){
  const r=startOutboxRuntime({db:{},env:config,deliver:()=>assert.fail('unexpected delivery')});
  assert.notEqual(r.status().status,'RUNNING');await r.stop();
 }
});
test('retry backoff is bounded, uses pagination and recovers',async()=>{
 let calls=0;const delays=[],cursors=[];let runtime;
 const completed=new Promise(resolve=>{
  runtime=startOutboxRuntime({db:{},env,deliver:async(_db,options)=>{
   cursors.push(options.cursor);calls++;return calls===1?{delivered:0,failed:20,nextCursor:{id:'next'}}:{delivered:1,failed:0,nextCursor:null};
  },wait:async ms=>{delays.push(ms);if(calls===2){resolve();await new Promise(r=>setImmediate(r));} }});
 });
 await completed;await runtime.stop();assert.deepEqual(delays.slice(0,2),[30000,15000]);
 assert.deepEqual(cursors.slice(0,2),[null,{id:'next'}]);assert.equal(runtime.status().delivered,1);
 assert.equal(runtime.status().status,'STOPPED');assert.ok(runtime.status().last_success_at);
});
test('shutdown aborts in-flight delivery and drains before returning',async()=>{
 let started;const entered=new Promise(r=>started=r);let finished=false;
 const r=startOutboxRuntime({db:{},env,deliver:async(_db,{signal})=>{
  started();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));finished=true;throw Error('aborted');
 }});await entered;await r.stop();assert.equal(finished,true);assert.equal(r.status().failures,0);
});
function dbFixture(events){const updated=[];return {updated,active(){},pool:{query:async()=>({rows:events})},tx:async fn=>fn({query:async(_sql,args)=>updated.push(args[0])})};}
for(const phase of ['select','empty-select','response','commit','last-response','last-commit']){
 test(`storage safety cutoff during ${phase} stops the whole outbox batch`,async t=>{
  const start=Date.parse('2026-10-17T00:00:00Z');let now=start;
  t.mock.method(Date,'now',()=>now);
  const sent=[],committed=[],pending=[];
  const expire=()=>{now=start+1000;};
  const client={release(){},query:async(sql,args)=>{
   if(sql.startsWith('UPDATE pod_events'))pending.push(args[0]);
   if(sql==='ROLLBACK')pending.length=0;
   if(sql==='COMMIT'){
    committed.push(...pending);pending.length=0;
    if(phase.endsWith('commit'))expire();
   }
   return {rows:[]};
  }};
  const db=new PodDB({bridge:{producer:'CYZOR Money Factory',consumer:'Content Control',contract:{fail_closed_rules:BRIDGE_RULES}},
   expiresAt:new Date(start+86400000+1000).toISOString(),pool:{connect:async()=>client,query:async()=>{
    if(phase.endsWith('select'))expire();
    return {rows:phase==='empty-select'?[]:phase.startsWith('last-')?[{id:'a'}]:[{id:'a'},{id:'b'}]};
   }}});
  await assert.rejects(deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,continueOnError:true,
   fetchImpl:async(_url,options)=>{
    const id=options.headers['idempotency-key'];sent.push(id);
    if(phase.endsWith('response'))expire();
    return new Response(JSON.stringify({accepted_event_id:id}));
   }}),/POD_STORAGE_EXPIRING/);
  assert.deepEqual(sent,phase.endsWith('select')?[]:['a']);
  assert.deepEqual(committed,phase.endsWith('commit')?['a']:[]);
 });
}
test('failed acknowledgement does not mark delivered or block another event',async()=>{
 const db=dbFixture([{id:'a'},{id:'b'}]);
 const result=await deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,continueOnError:true,
  fetchImpl:async(_url,opts)=>new Response(JSON.stringify({accepted_event_id:opts.headers['idempotency-key']==='a'?'wrong':'b'}))});
 assert.deepEqual(db.updated,['b']);assert.deepEqual(result,{delivered:1,failed:1,nextCursor:null});
});
test('full rejected batch returns a cursor so later events remain reachable',async()=>{
 const events=Array.from({length:20},(_,i)=>({id:String(i),created_at:'2026-01-01',cursor_created_at:'2026-01-01'})),db=dbFixture(events);
 const result=await deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,continueOnError:true,fetchImpl:async()=>new Response('',{status:503})});
 assert.equal(result.failed,20);assert.deepEqual(result.nextCursor,{id:'19',created_at:'2026-01-01'});assert.equal(db.updated.length,0);
});
test('default delivery behavior preserves error contract',async()=>{
 await assert.rejects(deliverOutbox(dbFixture([{id:'a'}]),{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,fetchImpl:async()=>new Response('',{status:503})}),/OUTBOX_DELIVERY_FAILED/);
});
test('already cancelled batch sends nothing',async()=>{
 const c=new AbortController();c.abort();const db=dbFixture([{id:'a'}]);
 await deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,signal:c.signal,fetchImpl:()=>assert.fail('network attempted')});assert.equal(db.updated.length,0);
});
test('pagination preserves PostgreSQL microseconds without changing the event envelope',async()=>{
 const timestamp='2026-01-01 00:00:00.000123+00';
 const events=Array.from({length:20},(_,i)=>({id:String(i),created_at:new Date('2026-01-01T00:00:00.000Z'),cursor_created_at:timestamp}));
 const db=dbFixture(events);const sent=[];
 const result=await deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,continueOnError:true,
  fetchImpl:async(_url,options)=>{sent.push(JSON.parse(JSON.parse(options.body).payload).event);return new Response('',{status:503});}});
 assert.deepEqual(result.nextCursor,{id:'19',created_at:timestamp});
 assert.equal(sent.length,20);
 assert.equal(sent[0].created_at,'2026-01-01T00:00:00.000Z');
 assert.equal(Object.hasOwn(sent[0],'cursor_created_at'),false);
});

