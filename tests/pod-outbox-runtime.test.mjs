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
test('disabling the outbox during polling stops before the next batch',async()=>{
 const config={...env};let calls=0;
 const runtime=startOutboxRuntime({db:{},env:config,
  deliver:async()=>{calls++;return {delivered:1,failed:0};},
  wait:async()=>{config.POD_OUTBOX_ENABLED='false';if(calls>1)throw Error('unexpected next batch');}});
 await new Promise(resolve=>setImmediate(resolve));
 const observed=runtime.status();await runtime.stop();
 assert.equal(calls,1);assert.equal(observed.status,'STOPPED');
 assert.equal(observed.delivered,1);assert.ok(observed.last_success_at);
 config.POD_OUTBOX_ENABLED='true';await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);assert.equal(runtime.status().status,'STOPPED');
});
test('disabling while delivery rejects stops without a retry or failure increment',async()=>{
 const config={...env};let rejectDelivery;
 const runtime=startOutboxRuntime({db:{},env:config,
  deliver:()=>new Promise((_resolve,reject)=>rejectDelivery=reject),
  wait:async()=>{throw Error('disabled delivery must not retry');}});
 config.POD_OUTBOX_ENABLED='false';rejectDelivery(Error('private transport error'));
 await new Promise(resolve=>setImmediate(resolve));
 const observed=runtime.status();await runtime.stop();
 assert.deepEqual(observed,{status:'STOPPED',delivered:0,failures:0,last_success_at:null});
});
for(const ending of ['disable','abort']){
 test(`${ending} during delivery retains acknowledged counts without recording a healthy cycle`,async()=>{
  const config={...env};let release,entered;
  const started=new Promise(resolve=>entered=resolve);
  const runtime=startOutboxRuntime({db:{},env:config,deliver:async()=>{
   entered();await new Promise(resolve=>release=resolve);return {delivered:1,failed:0};
  },wait:async()=>{throw Error('stopped cycle must not poll');}});
  await started;
  let stopping;
  if(ending==='disable')config.POD_OUTBOX_ENABLED='false';else stopping=runtime.stop();
  release();await new Promise(resolve=>setImmediate(resolve));
  const observed=runtime.status();await (stopping||runtime.stop());
  assert.equal(observed.status,'STOPPED');assert.equal(observed.delivered,1);
  assert.equal(observed.failures,0);assert.equal(observed.last_success_at,null);
 });
}
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

