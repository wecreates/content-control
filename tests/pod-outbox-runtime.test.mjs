import test from 'node:test';
import assert from 'node:assert/strict';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
import {PodDB} from '../pod-db-bridge.js';
import {BRIDGE_RULES} from '../integrations/pod/policy.mjs';
const env={POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:'k'.repeat(32)};
const jsonResponse=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('disabled and incomplete configurations never deliver',async()=>{
 for(const config of [{},{...env,POD_OUTBOX_KEY:''},{...env,POD_OUTBOX_URL:'http://example.com'},
  {...env,POD_OUTBOX_URL:'https://authority.example/events?route=other'},
  {...env,POD_OUTBOX_URL:'https://authority.example/events#other'},{...env,POD_OUTBOX_POLL_MS:'0'}]){
  let calls=0;
  const r=startOutboxRuntime({db:{},env:config,deliver:async()=>{calls++;return {delivered:0,failed:0};}});
  const observed=r.status();await r.stop();
  assert.notEqual(observed.status,'RUNNING');assert.equal(calls,0);
 }
});
test('direct delivery rejects query and fragment endpoint variants before storage access',async()=>{
 for(const suffix of ['?route=other','#other']){
  let active=0;
  const db={active(){active++;},pool:{query:()=>assert.fail('unexpected database query')}};
  await assert.rejects(deliverOutbox(db,{url:env.POD_OUTBOX_URL+suffix,key:env.POD_OUTBOX_KEY,
   fetchImpl:()=>assert.fail('unexpected network request')}),/OUTBOX_CONFIG_INVALID/);
  assert.equal(active,0);
 }
});
test('direct delivery enforces receiver byte ceilings before network access',async t=>{
 const now=1800000000000;t.mock.method(Date,'now',()=>now);
 const encoded=event=>JSON.stringify({schema_version:1,audience:'money-factory:pod:event',issued_at_ms:now,event});
 const event=n=>({id:'12b4c678-1234-4321-abcd-123456789abc',job_id:null,kind:'pod.test.large',
  payload:{value:'\\'.repeat(n)},created_at:new Date(now).toISOString()});
 let low=0,high=262144;
 while(low<high){const middle=Math.ceil((low+high)/2);if(Buffer.byteLength(encoded(event(middle)))<=262144)low=middle;else high=middle-1;}
 const boundary=event(low),boundaryPayload=encoded(boundary);
 assert.ok(Buffer.byteLength(boundaryPayload)<=262144);
 assert.ok(Buffer.byteLength(encoded(event(low+1)))>262144);
 assert.ok(Buffer.byteLength(JSON.stringify({payload:boundaryPayload,signature:'0'.repeat(64)}))<=524288);
 const accepted=dbFixture([boundary]);
 await deliverOutbox(accepted,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,
  fetchImpl:async()=>jsonResponse({accepted_event_id:boundary.id})});
 assert.deepEqual(accepted.updated,[boundary.id]);
 const rejected=dbFixture([event(low+1)]);
 await assert.rejects(deliverOutbox(rejected,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,
  fetchImpl:()=>assert.fail('unexpected network request')}),/OUTBOX_EVENT_TOO_LARGE/);
 assert.deepEqual(rejected.updated,[]);
});
test('invalid issuer clocks cannot create or dispatch a signed outbox event',async t=>{
 let now=NaN;t.mock.method(Date,'now',()=>now);
 const event={id:'12b4c678-1234-4321-abcd-123456789abc',job_id:null,kind:'pod.test.clock',payload:{},created_at:'2026-01-01T00:00:00.000Z'};
 for(const invalid of [NaN,-1,0.5,Number.MAX_SAFE_INTEGER+1]){
  now=invalid;const db=dbFixture([event]);let calls=0;
  await assert.rejects(deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,
   fetchImpl:async()=>{calls++;return jsonResponse({accepted_event_id:event.id});}}),/^Error: OUTBOX_CLOCK_INVALID$/);
  assert.equal(calls,0);assert.deepEqual(db.updated,[]);
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
    return jsonResponse({accepted_event_id:id});
   }}),/POD_STORAGE_EXPIRING/);
  assert.deepEqual(sent,phase.endsWith('select')?[]:['a']);
  assert.deepEqual(committed,phase.endsWith('commit')?['a']:[]);
 });
}
test('failed acknowledgement does not mark delivered or block another event',async()=>{
 const db=dbFixture([{id:'a'},{id:'b'}]);
 const result=await deliverOutbox(db,{url:env.POD_OUTBOX_URL,key:env.POD_OUTBOX_KEY,continueOnError:true,
  fetchImpl:async(_url,opts)=>jsonResponse({accepted_event_id:opts.headers['idempotency-key']==='a'?'wrong':'b'})});
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

