import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {deliverOutbox} from '../integrations/pod/outbox.mjs';
import {createGrantResolver} from '../integrations/pod/grant-client.mjs';
import {readBridgeJSON} from '../integrations/pod/http-response.mjs';

const key='k'.repeat(32);
const env={POD_GRANT_URL:'https://authority.example/grant',POD_GRANT_AUTH_KEY:'a'.repeat(32),POD_UPSTREAM_KEY:key};
function streamResponse({status=200,headers={},chunks=[]}={}){
 let cancelled=0;
 const body=new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(Buffer.from(chunk));},cancel(){cancelled++;}});
 return {response:new Response(body,{status,headers}),cancelled:()=>cancelled};
}
function dbFixture(){const updated=[];return {updated,active(){},pool:{query:async()=>({rows:[{id:'event'}]})},tx:async fn=>fn({query:async(_sql,args)=>updated.push(args[0])})};}
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
  assert.equal(f.cancelled(),1);return new Response(JSON.stringify({accepted_event_id:'ok'}));
 }});
 assert.deepEqual(result,{delivered:1,failed:1,nextCursor:null});assert.deepEqual(db.updated,['ok']);
});
test('bounded grant transport still checks signature, scope, revocation and lifetime',async()=>{
 const brief={id:'job',account_id:'account',business_id:'business',platform:'redbubble',destination_platform:'redbubble',mode:'PRELAUNCH'};
 const base={schema_version:1,audience:'content-control:pod',issued_at_ms:Date.now()-1000,expires_at_ms:Date.now()+60000,
  job_id:brief.id,account_id:brief.account_id,business_id:brief.business_id,platform:brief.platform,max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false};
 for(const [patch,error] of [[{},null],[{revoked:true},/APPROVAL_REVOKED/],[{job_id:'other'},/GRANT_SCOPE_MISMATCH/],[{expires_at_ms:Date.now()+10000},/GRANT_LIFETIME_TOO_SHORT/]]){
  const payload=JSON.stringify({...base,...patch}),envelope={payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};
  const resolve=createGrantResolver({env,fetchImpl:async()=>new Response(JSON.stringify(envelope))});
  if(error)await assert.rejects(resolve({id:brief.id,brief}),error);
  else assert.deepEqual(await resolve({id:brief.id,brief}),envelope);
 }
 const payload=JSON.stringify(base),resolve=createGrantResolver({env,fetchImpl:async()=>new Response(JSON.stringify({payload,signature:'0'.repeat(64)}))});
 await assert.rejects(resolve({id:brief.id,brief}),/SIGNATURE_INVALID/);
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
  const body=new ReadableStream({pull(){reading();return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}});
  const fetchImpl=async()=>new Response(body);
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
