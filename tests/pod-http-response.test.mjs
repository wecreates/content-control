import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
import {createGrantResolver} from '../integrations/pod/grant-client.mjs';
import {startOutboxRuntime} from '../integrations/pod/outbox-runtime.mjs';
import {fetchBridgeResponse,readBridgeJSON} from '../integrations/pod/http-response.mjs';

const key='k'.repeat(32);
const env={POD_GRANT_URL:'https://authority.example/grant',POD_GRANT_AUTH_KEY:'a'.repeat(32),POD_UPSTREAM_KEY:key};
function streamResponse({status=200,headers={},chunks=[]}={}){
 let cancelled=0;
 const body=new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(Buffer.from(chunk));},cancel(){cancelled++;}});
 return {response:new Response(body,{status,headers:{'content-type':'application/json',...headers}}),cancelled:()=>cancelled};
}
function dbFixture(){const updated=[];return {updated,active(){},pool:{query:async()=>({rows:[{id:'event'}]})},tx:async fn=>fn({query:async(_sql,args)=>updated.push(args[0])})};}
const jsonResponse=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('rejected authority response is cancelled without consuming its body',async()=>{
 const f=streamResponse({status:403});
 const resolve=createGrantResolver({env,fetchImpl:async()=>f.response});
 await assert.rejects(resolve({id:'job'}),/GRANT_AUTHORITY_BLOCKED/);
 assert.equal(f.cancelled(),1);assert.equal(f.response.body.locked,false);
});
test('oversized declared acknowledgement is cancelled and never delivered',async()=>{
 const f=streamResponse({headers:{'content-length':'4097'}}),db=dbFixture();
 await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl:async()=>f.response}),/OUTBOX_ACK_TOO_LARGE/);
 assert.equal(f.cancelled(),1);assert.equal(f.response.body.locked,false);assert.deepEqual(db.updated,[]);
});
test('chunked and understated acknowledgement bounds cancel the reader',async()=>{
 for(const headers of [{},{'content-length':'1'}]){
  const f=streamResponse({headers,chunks:['x'.repeat(2048),'x'.repeat(2049)]}),db=dbFixture();
  await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl:async()=>f.response}),/OUTBOX_ACK_TOO_LARGE/);
  assert.equal(f.cancelled(),1);assert.equal(f.response.body.locked,false);assert.deepEqual(db.updated,[]);
 }
});
test('grant response has both declared and streamed byte limits',async()=>{
 for(const config of [{headers:{'content-length':'262145'}},{chunks:['x'.repeat(262145)]}]){
  const f=streamResponse(config),resolve=createGrantResolver({env,fetchImpl:async()=>f.response});
  await assert.rejects(resolve({id:'job'}),/GRANT_TOO_LARGE/);
  assert.equal(f.cancelled(),1);assert.equal(f.response.body.locked,false);
 }
});
test('failed response cancellation cannot mask the delivery failure',async()=>{
 const body=new ReadableStream({cancel(){throw Error('private remote detail');}});
 const response=new Response(body,{status:503}),db=dbFixture();
 await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl:async()=>response}),/^Error: OUTBOX_DELIVERY_FAILED$/);
 assert.deepEqual(db.updated,[]);assert.equal(body.locked,false);
});
test('malformed JSON, invalid UTF-8 and absent body cannot acknowledge an event',async()=>{
 for(const response of [new Response('{'),new Response(Buffer.from([0xff])),new Response(null,{status:204})]){
  const db=dbFixture();
  await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl:async()=>response}));
  assert.deepEqual(db.updated,[]);assert.equal(response.body?.locked||false,false);
 }
});
test('escaped duplicate acknowledgement keys cannot mark an event delivered',async()=>{
 const db=dbFixture();
 const response='{"accepted_event_id":"wrong","accepted_event\\u005fid":"event"}';
 await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,
  fetchImpl:async()=>new Response(response,{headers:{'content-type':'application/json'}})}));
 assert.deepEqual(db.updated,[]);
});
test('acknowledgement must be the exact receiver response object',async()=>{
 for(const acknowledgement of [
  {accepted_event_id:'event',status:'rejected'},
  {accepted_event_id:'event',error:'EVENT_REJECTED'},
 ]){
  const db=dbFixture();
  await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,
   fetchImpl:async()=>jsonResponse(acknowledgement)}),/OUTBOX_ACK_INVALID/);
  assert.deepEqual(db.updated,[]);
 }
});
test('acknowledgement requires the receiver JSON media type',async()=>{
 const text=JSON.stringify({accepted_event_id:'event'});
 for(const response of [
  new Response(text,{headers:{'content-type':'text/html; charset=utf-8'}}),
  new Response(text,{headers:{'content-type':'application/problem+json'}}),
  new Response(Buffer.from(text)),
 ]){
  const db=dbFixture();
  await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,
   fetchImpl:async()=>response}),/OUTBOX_ACK_MEDIA_TYPE_INVALID/);
  assert.deepEqual(db.updated,[]);
  assert.equal(response.body.locked,false);
 }
 const db=dbFixture();
 await deliverOutbox(db,{url:'https://authority.example/events',key,
  fetchImpl:async()=>new Response(text,{headers:{'content-type':'Application/JSON; charset=utf-8'}})});
 assert.deepEqual(db.updated,['event']);
});
test('grant authority response requires the JSON media type',async()=>{
 const grant=scopedGrant(),text=JSON.stringify(grant.envelope);
 for(const response of [
  new Response(text,{headers:{'content-type':'text/html; charset=utf-8'}}),
  new Response(text,{headers:{'content-type':'application/problem+json'}}),
  new Response(Buffer.from(text)),
 ]){
  const resolve=createGrantResolver({env,fetchImpl:async()=>response});
  await assert.rejects(resolve({id:'job',brief:grant.brief}),/GRANT_MEDIA_TYPE_INVALID/);
  assert.equal(response.body.locked,false);
 }
 const resolve=createGrantResolver({env,fetchImpl:async()=>new Response(text,
  {headers:{'content-type':'Application/JSON; charset=utf-8'}})});
 assert.deepEqual(await resolve({id:'job',brief:grant.brief}),grant.envelope);
});
test('a leading UTF-8 BOM cannot acknowledge an event',async()=>{
 const db=dbFixture(),body=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{"accepted_event_id":"event"}')]);
 await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,
  fetchImpl:async()=>new Response(body,{headers:{'content-type':'application/json'}})}));
 assert.deepEqual(db.updated,[]);
});
test('exact-limit UTF-8 JSON split across every byte preserves the original text',async()=>{
 const input=Buffer.from(JSON.stringify({text:'café 日本語 😀'}));
 const body=new ReadableStream({start(c){for(const byte of input)c.enqueue(Uint8Array.of(byte));c.close();}});
 const response=new Response(body);
 assert.deepEqual(await readBridgeJSON(response,{maxBytes:input.length,statusError:'STATUS',sizeError:'SIZE'}),{text:'café 日本語 😀'});
 assert.equal(body.locked,false);
});
test('aborted response read releases its reader and never acknowledges delivery',async()=>{
 const controller=new AbortController(),db=dbFixture();let entered;
 const reading=new Promise(resolve=>entered=resolve);let response;
 const operation=deliverOutbox(db,{url:'https://authority.example/events',key,signal:controller.signal,fetchImpl:async(_url,{signal})=>{
  response=new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason),{once:true});entered();}}));return response;
 }});
 await reading;controller.abort();await operation;
 assert.equal(response.body.locked,false);assert.deepEqual(db.updated,[]);
});
test('failed event response is released before processing the next event',async()=>{
 const f=streamResponse({status:503}),db=dbFixture();db.pool.query=async()=>({rows:[{id:'failed'},{id:'ok'}]});
 let calls=0;
 const result=await deliverOutbox(db,{url:'https://authority.example/events',key,continueOnError:true,fetchImpl:async()=>{
  if(calls++===0)return f.response;
  assert.equal(f.cancelled(),1);return jsonResponse({accepted_event_id:'ok'});
 }});
 assert.deepEqual(result,{delivered:1,failed:1,nextCursor:null});assert.deepEqual(db.updated,['ok']);
});
test('bounded grant transport still checks signature, scope, revocation and lifetime',async()=>{
 const brief={id:'job',account_id:'account',business_id:'business',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const base={schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1000,expires_at_ms:Date.now()+60000,
  job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,platform:brief.platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false};
 for(const [patch,error] of [[{},null],[{revoked:true},/APPROVAL_REVOKED/],[{job_id:'other'},/GRANT_SCOPE_MISMATCH/],[{expires_at_ms:Date.now()+10000},/GRANT_LIFETIME_TOO_SHORT/]]){
  const payload=JSON.stringify({...base,...patch}),envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const resolve=createGrantResolver({env,fetchImpl:async()=>jsonResponse(envelope)});
  if(error)await assert.rejects(resolve({id:brief.id,brief}),error);
  else assert.deepEqual(await resolve({id:brief.id,brief}),envelope);
 }
 const payload=JSON.stringify(base),resolve=createGrantResolver({env,fetchImpl:async()=>jsonResponse({payload,signature:'0'.repeat(64)})});
 await assert.rejects(resolve({id:brief.id,brief}),/SIGNATURE_INVALID/);
});
test('escaped duplicate outer grant keys cannot select a signed payload',async()=>{
 const grant=scopedGrant();
 const response=`{"payload":"invalid","payl\\u006fad":${JSON.stringify(grant.envelope.payload)},"signature":${JSON.stringify(grant.envelope.signature)}}`;
 const resolve=createGrantResolver({env,fetchImpl:async()=>new Response(response,{headers:{'content-type':'application/json'}})});
 await assert.rejects(resolve({id:'job',brief:grant.brief}));
});

async function bounded(promise){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TEST_OPERATION_STALLED')),1000);})]);}
 finally{clearTimeout(timer);}
}
for(const scenario of ['status','size']){
 test(`unsettled cancellation does not stall the ${scenario} error`,async()=>{
  let cancelled=0;
  const body=new ReadableStream({start(c){if(scenario==='size')c.enqueue(new Uint8Array(5));},cancel(){cancelled++;return new Promise(()=>{});}});
  const response=new Response(body,{status:scenario==='status'?503:200});
  await assert.rejects(bounded(readBridgeJSON(response,{maxBytes:4,statusError:'STATUS',sizeError:'SIZE'})),
   scenario==='status'?/^Error: STATUS$/:/^Error: SIZE$/);
  assert.equal(cancelled,1);assert.equal(body.locked,false);
 });
}
test('response abort interrupts an uncooperative read and releases a stalled cancellation',async()=>{
 const controller=new AbortController();let reading,cancelled=0;
 const entered=new Promise(resolve=>reading=resolve);
 const body=new ReadableStream({pull(){reading();return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}});
 const operation=readBridgeJSON(new Response(body),{maxBytes:32,statusError:'STATUS',sizeError:'SIZE',signal:controller.signal});
 await entered;controller.abort();
 await assert.rejects(bounded(operation),{name:'AbortError'});
 assert.equal(cancelled,1);assert.equal(body.locked,false);
});
for(const caller of ['grant','outbox']){
 test(`${caller} forwards cancellation to a body that ignores fetch's signal`,async()=>{
  const controller=new AbortController();let reading,cancelled=0;
  const entered=new Promise(resolve=>reading=resolve),db=dbFixture();
  let body;
  const fetchImpl=async()=>{body=new ReadableStream({pull(){reading();return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}});return new Response(body);};
  const operation=caller==='grant'?createGrantResolver({env,fetchImpl})({id:'job'},{signal:controller.signal}):
   deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl,signal:controller.signal});
  await entered;controller.abort();
  if(caller==='grant')await assert.rejects(bounded(operation),{name:'AbortError'});
  else assert.deepEqual(await bounded(operation),{delivered:0});
  assert.equal(cancelled,1);assert.equal(body.locked,false);assert.deepEqual(db.updated,[]);
 });
}

test('response deadline stops a stalled body without a transport abort listener',async()=>{
 let cancelled=0;
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}});
 await assert.rejects(bounded(readBridgeJSON(new Response(body),
  {maxBytes:32,statusError:'STATUS',sizeError:'SIZE',signal:AbortSignal.timeout(10)})),{name:'TimeoutError'});
 assert.equal(cancelled,1);assert.equal(body.locked,false);
});
test('already aborted response is cancelled without acquiring a reader',async()=>{
 let cancelled=0;
 const body=new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}});
 await assert.rejects(bounded(readBridgeJSON(new Response(body),
  {maxBytes:32,statusError:'STATUS',sizeError:'SIZE',signal:AbortSignal.abort()})),{name:'AbortError'});
 assert.equal(cancelled,1);assert.equal(body.locked,false);
});

async function outcomeAfterTurn(operation){
 let outcome;
 operation.then(value=>outcome={value},error=>outcome={error});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(outcome,'cancelled operation must settle without transport cooperation');
 return outcome;
}
for(const caller of ['grant','outbox']){
 test(`${caller} abort interrupts a transport stalled before response headers`,async()=>{
  const controller=new AbortController(),db=dbFixture();let entered;
  const started=new Promise(resolve=>entered=resolve);
  const fetchImpl=()=>{entered();return new Promise(()=>{});};
  const operation=caller==='grant'?createGrantResolver({env,fetchImpl})({id:'job'},{signal:controller.signal}):
   deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl,signal:controller.signal});
  await started;controller.abort();
  const result=await outcomeAfterTurn(operation);
  if(caller==='grant')assert.equal(result.error?.name,'AbortError');
  else assert.deepEqual(result,{value:{delivered:0}});
  assert.deepEqual(db.updated,[]);
 });
}
test('already aborted grant never starts the authority transport',async()=>{
 let calls=0;
 const resolve=createGrantResolver({env,fetchImpl:()=>{calls++;return new Promise(()=>{});}});
 const result=await outcomeAfterTurn(resolve({id:'job'},{signal:AbortSignal.abort()}));
 assert.equal(result.error?.name,'AbortError');assert.equal(calls,0);
});

for(const ending of ['response','rejection']){
 test(`late transport ${ending} after abort is discarded without delaying the caller`,async()=>{
  const controller=new AbortController();let finish,entered,cancelled=0;
  const started=new Promise(resolve=>entered=resolve);
  const operation=fetchBridgeResponse(()=>new Promise((resolve,reject)=>{
   finish=ending==='response'?resolve:reject;entered();
  }),'https://authority.example',{signal:controller.signal});
  await started;controller.abort();
  assert.equal((await outcomeAfterTurn(operation)).error?.name,'AbortError');
  if(ending==='response')finish(new Response(new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}})));
  else finish(Error('private late failure'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(cancelled,ending==='response'?1:0);
 });
}
for(const caller of ['grant','outbox']){
 test(`${caller} request deadline interrupts an uncooperative header wait`,async t=>{
  const controller=new AbortController(),db=dbFixture();let entered,deadline;
  t.mock.method(AbortSignal,'timeout',ms=>{deadline=ms;return controller.signal;});
  const started=new Promise(resolve=>entered=resolve);
  const fetchImpl=()=>{entered();return new Promise(()=>{});};
  const operation=caller==='grant'?createGrantResolver({env,fetchImpl})({id:'job'}):
   deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl});
  await started;controller.abort(new DOMException('deadline','TimeoutError'));
  assert.equal((await outcomeAfterTurn(operation)).error?.name,'TimeoutError');
  assert.equal(deadline,caller==='grant'?10000:15000);assert.deepEqual(db.updated,[]);
 });
}
test('unsettled header calls retain a shared per-transport admission bound after abort',async()=>{
 let calls=0;const deferred=[],controllers=[];
 const fetchImpl=()=>{calls++;return calls<=32?new Promise((resolve,reject)=>deferred.push({resolve,reject})):Promise.resolve(new Response('{}'));};
 const operations=Array.from({length:32},()=>{
  const controller=new AbortController();controllers.push(controller);
  return fetchBridgeResponse(fetchImpl,'https://authority.example',{signal:controller.signal});
 });
 const outcomes=Promise.all(operations.map(p=>p.catch(error=>error.name)));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,32);
 controllers.forEach(c=>c.abort());assert.deepEqual(await outcomes,Array(32).fill('AbortError'));
 // Both clients use the same bound when they reuse a transport function.
 await assert.rejects(createGrantResolver({env,fetchImpl})({id:'job'}),/^Error: BRIDGE_REQUEST_BUSY$/);
 const db=dbFixture();
 await assert.rejects(deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl}),/^Error: BRIDGE_REQUEST_BUSY$/);
 assert.equal(calls,32);assert.deepEqual(db.updated,[]);
 const independent=await fetchBridgeResponse(async()=>new Response('{}'),'https://authority.example',{});
 assert.deepEqual(await independent.json(),{});
 let cancelled=0;
 deferred[0].resolve(new Response(new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}})));
 deferred[1].reject(Error('late private detail'));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);
 const recovered=await fetchBridgeResponse(fetchImpl,'https://authority.example',{});
 assert.deepEqual(await recovered.json(),{});assert.equal(calls,33);
 // Settle remaining transports so the fixture leaves no retained admissions.
 deferred.slice(2).forEach(d=>d.reject(Error('late private detail')));
 await new Promise(resolve=>setImmediate(resolve));
});
test('synchronous transport failures release admission and preserve the error',async()=>{
 let calls=0;const failure=Error('transport failed'),fetchImpl=()=>{calls++;throw failure;};
 for(let i=0;i<40;i++)await assert.rejects(fetchBridgeResponse(fetchImpl,'https://authority.example',{}),error=>error===failure);
 assert.equal(calls,40);
});
test('outbox shutdown drains a header wait without accepting a late acknowledgement',async()=>{
 const db=dbFixture();let entered,respond,cancelled=0;
 const started=new Promise(resolve=>entered=resolve);
 const fetchImpl=()=>new Promise(resolve=>{respond=resolve;entered();});
 const runtime=startOutboxRuntime({db,env:{POD_OUTBOX_ENABLED:'true',POD_OUTBOX_URL:'https://authority.example/events',POD_OUTBOX_KEY:key},
  deliver:(db,options)=>deliverOutbox(db,{...options,fetchImpl})});
 await started;assert.deepEqual(await outcomeAfterTurn(runtime.stop()),{value:undefined});
 assert.equal(runtime.status().status,'STOPPED');assert.equal(runtime.status().failures,0);
 respond(new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('{"accepted_event_id":"event"}'));},cancel(){cancelled++;return new Promise(()=>{});}})));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cancelled,1);assert.deepEqual(db.updated,[]);assert.equal(runtime.status().delivered,0);
});

function scopedGrant(){
 const brief={id:'job',account_id:'account',business_id:'business',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
 const payload=JSON.stringify({schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1,expires_at_ms:Date.now()+60000,
  job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,platform:brief.platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false});
 return {brief,envelope:{payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')}};
}
for(const caller of ['grant','outbox'])for(const phase of ['headers','body','parse']){
 test(`${caller} rejects late ${phase} completion when its timeout callback is delayed`,async t=>{
  const budget=caller==='grant'?10000:15000,grant=scopedGrant();let now=0,completion;
  t.mock.method(performance,'now',()=>now);
  // Model an event loop that has not dispatched the timeout callback yet.
  t.mock.method(AbortSignal,'timeout',ms=>{assert.equal(ms,budget);return new AbortController().signal;});
  const parse=JSON.parse;
  if(phase==='parse')t.mock.method(JSON,'parse',(...args)=>{const result=parse(...args);now=completion;return result;});
  for(const elapsed of [budget-1,budget,budget+1]){
   now=0;completion=elapsed;const db=dbFixture();let body,pulls=0,cancelled=0;
   const text=JSON.stringify(caller==='grant'?grant.envelope:{accepted_event_id:'event'});
   const fetchImpl=async()=>{
    if(phase==='headers')now=completion;
    body=new ReadableStream({pull(c){pulls++;if(phase==='body')now=completion;c.enqueue(Buffer.from(text));c.close();},
     cancel(){cancelled++;return new Promise(()=>{});}},{highWaterMark:0});
    return new Response(body,{headers:{'content-type':'application/json'}});
   };
   const operation=caller==='grant'?createGrantResolver({env,fetchImpl})({id:'job',brief:grant.brief}):
    deliverOutbox(db,{url:'https://authority.example/events',key,fetchImpl});
   if(elapsed<budget){
    const result=await operation;
    if(caller==='grant')assert.deepEqual(result,grant.envelope);
    else assert.deepEqual(result,{delivered:1});
    assert.deepEqual(db.updated,caller==='outbox'?['event']:[]);
   }else{
    await assert.rejects(operation,{name:'TimeoutError'});
    assert.deepEqual(db.updated,[]);
    if(phase==='headers'){assert.equal(pulls,0);assert.equal(cancelled,1);}
   }
   assert.equal(body.locked,false);
  }
 });
}
test('expired header deadline refuses admission before calling a transport',async t=>{
 let now=100,calls=0;t.mock.method(performance,'now',()=>now);
 const fetchImpl=async()=>{calls++;return new Response('{}');};
 await assert.rejects(fetchBridgeResponse(fetchImpl,'https://authority.example',{}, {deadline:100}),{name:'TimeoutError'});
 now=0;const deferred=fetchBridgeResponse(fetchImpl,'https://authority.example',{}, {deadline:100});
 now=100;await assert.rejects(deferred,{name:'TimeoutError'});
 assert.equal(calls,0);
});
test('grant validation cannot return an envelope after the shared request deadline',async t=>{
 const grant=scopedGrant(),wall=Date.now();let now=0,clockReads=0;
 t.mock.method(performance,'now',()=>now);
 t.mock.method(AbortSignal,'timeout',()=>new AbortController().signal);
 t.mock.method(Date,'now',()=>{if(++clockReads===2)now=10000;return wall;});
 const resolve=createGrantResolver({env,fetchImpl:async()=>jsonResponse(grant.envelope)});
 await assert.rejects(resolve({id:'job',brief:grant.brief}),{name:'TimeoutError'});
});
