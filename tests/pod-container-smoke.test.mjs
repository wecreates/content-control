import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {waitForDisabledPod} from '../scripts/pod_container_smoke.mjs';

const disabled={status:'DISABLED',publication_enabled:false,publication_requested:false,
 production_status:'DISABLED',outbox:{status:'DISABLED'},adapters_verified:false};
async function serve(t,handler){
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return {server,url:`http://127.0.0.1:${server.address().port}/api/print/status`};
}
test('POD smoke checks only the POD route and accepts strictly disabled defaults',async t=>{
 const {url}=await serve(t,(req,res)=>{
  assert.equal(req.url,'/api/print/status');res.end(JSON.stringify(disabled));
 });
 assert.equal((await waitForDisabledPod({url})).status,'PASS');
});
for(const [name,patch] of [
 ['service active',{status:'DATABASE_CONNECTED_UNVERIFIED_ADAPTERS'}],
 ['publication enabled',{publication_enabled:true}],
 ['publication requested',{publication_requested:true}],
 ['production active',{production_status:'RUNNING'}],
 ['outbox active',{outbox:{status:'RUNNING'}}],
 ['adapters unexpectedly verified',{adapters_verified:true}],
 ['missing publication flag',{publication_enabled:undefined}],
 ['string instead of boolean',{publication_requested:'false'}],
])test(`POD smoke rejects ${name}`,async t=>{
 const {url}=await serve(t,(_req,res)=>res.end(JSON.stringify({...disabled,...patch})));
 await assert.rejects(waitForDisabledPod({url}),/POD_SMOKE_UNSAFE_STATE/);
});
test('POD smoke fails unreachable startup within its deadline',async t=>{
 const {server,url}=await serve(t,()=>{});
 await new Promise(resolve=>server.close(resolve));
 const start=performance.now();
 await assert.rejects(waitForDisabledPod({url,timeoutMs:100,retryMs:10}),/POD_SMOKE_STARTUP_TIMEOUT/);
 assert.ok(performance.now()-start<2000);
});
test('POD smoke waits for actual startup after connection refusal',async t=>{
 const {server,url}=await serve(t,(_req,res)=>res.end(JSON.stringify(disabled)));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 const result=waitForDisabledPod({url,timeoutMs:2000,retryMs:20});
 await new Promise(resolve=>setTimeout(resolve,60));
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 assert.equal((await result).status,'PASS');
});
test('POD smoke bounds a stalled response body',async t=>{
 const {url}=await serve(t,(_req,res)=>{res.writeHead(200);res.write('{');});
 const start=performance.now();
 await assert.rejects(waitForDisabledPod({url,requestTimeoutMs:100}),/POD_SMOKE_INVALID_RESPONSE/);
 assert.ok(performance.now()-start<2000);
});
test('POD smoke bounds a server that never sends response headers',async t=>{
 const {url}=await serve(t,()=>{});
 const start=performance.now();
 await assert.rejects(waitForDisabledPod({url,timeoutMs:150,requestTimeoutMs:40,retryMs:10}),/POD_SMOKE_STARTUP_TIMEOUT/);
 assert.ok(performance.now()-start<2000);
});
for(const [name,send] of [
 ['HTTP failure',res=>{res.writeHead(503);res.end(JSON.stringify(disabled));}],
 ['redirect',res=>{res.writeHead(302,{Location:'/unexpected'});res.end();}],
 ['malformed JSON',res=>res.end('{')],
 ['invalid UTF-8',res=>res.end(Buffer.from([0xff]))],
 ['oversized chunked body',res=>{res.write(' '.repeat(65537));res.end(JSON.stringify(disabled));}],
])test(`POD smoke rejects ${name}`,async t=>{
 let requests=0;
 const {url}=await serve(t,(_req,res)=>{requests++;send(res);});
 await assert.rejects(waitForDisabledPod({url}),/POD_SMOKE_INVALID_RESPONSE/);
 assert.equal(requests,1);
});

function standalone(fetchSource,options){
 const script=`import {waitForDisabledPod} from ${JSON.stringify(new URL('../scripts/pod_container_smoke.mjs',import.meta.url).href)};
 globalThis.fetch=${fetchSource};
 try{console.log(JSON.stringify(await waitForDisabledPod(${JSON.stringify(options)})));}
 catch(error){console.error(error.message);process.exitCode=1;}`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});
 assert.equal(result.error,undefined);assert.equal(result.signal,null);
 assert.doesNotMatch(result.stderr,/unsettled top-level await/i);
 return result;
}
test('standalone smoke stays alive for a delayed body with no other referenced handles',()=>{
 const result=standalone(`async()=>new Response(new ReadableStream({start(controller){
  const timer=setTimeout(()=>{controller.enqueue(new TextEncoder().encode(${JSON.stringify(JSON.stringify(disabled))}));controller.close();},30);
  timer.unref();
 }}))`,{timeoutMs:1000,requestTimeoutMs:500});
 assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).status,'PASS');
});
for(const [name,source,expected] of [
 ['stalled headers','()=>new Promise(()=>{})','POD_SMOKE_STARTUP_TIMEOUT'],
 ['stalled body','async()=>new Response(new ReadableStream({start(){}}))','POD_SMOKE_INVALID_RESPONSE'],
 ['stalled error-body cancellation',"async()=>({status:503,body:{cancel:()=>new Promise(()=>{})}})",'POD_SMOKE_INVALID_RESPONSE']
])test(`standalone smoke bounds ${name} without other referenced handles`,()=>{
 const result=standalone(source,{timeoutMs:120,requestTimeoutMs:40,retryMs:10});
 assert.equal(result.status,1);assert.equal(result.stderr.trim(),expected);
});
