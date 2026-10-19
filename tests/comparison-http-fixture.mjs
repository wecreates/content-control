// Real loopback HTTP and file ranges through the production route handlers.
// Unrelated service startup is excluded; fixture media/observations are SYNTHETIC.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {creativeHandoff} from '../creative-handoff.js';
import {createHostedComparisonGate} from '../scripts/hosted_comparison_receipt.mjs';
export async function exerciseHostedHttp({source,healthPath,runtimePath,video,receiptPath,review,reference}){
 let release,calls=0;const barrier=new Promise(r=>release=r);
 const hash=async(path,signal)=>{
  calls++;await barrier;
  const h=createHash('sha256');for await(const chunk of fs.createReadStream(path,{signal}))h.update(chunk);return h.digest('hex');
 };
 const gate=createHostedComparisonGate({hash}),routes=new Map();
 const acceptance=source.match(/function v2Acceptance\(\)\s*\{[\s\S]*?\n\}/)[0];
 const stream=source.match(/function streamMp4\([^]*?\n\}/)[0];
 const handlers=source.slice(source.indexOf('app.get("/v2/health"'),source.indexOf('app.get("/clone/health"'));
 vm.runInNewContext(acceptance+'\n'+stream+'\n'+handlers,{
  app:{get:(p,h)=>routes.set(p,h)},fs,creativeHandoff,hostedComparisonGate:gate,
  readJson:p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):null,v2HealthPath:healthPath,v2Output:video,
  path:{resolve:p=>p==='state/v2-runtime-validation.json'?runtimePath:resolve(p)},v2Draft:()=>({ready:false}),
  fileHash:()=>{throw Error('Request must not synchronously hash media');}
 });
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
  res.status=n=>{res.statusCode=n;return res;};res.json=x=>res.end(JSON.stringify(x));res.type=()=>res;res.send=x=>res.end(x);
  if(url.pathname==='/ping')return res.end('responsive');
  try{routes.get(url.pathname)(req,res);}catch(e){res.statusCode=500;res.end(e.message);}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path)=>{const r=await fetch(base+path,{headers:{range:'bytes=0-31'}});return {status:r.status,body:Buffer.from(await r.arrayBuffer())};};
 const batch=()=>Promise.all(Array.from({length:30},(_,i)=>request(['/v2/health','/v2/watch','/v2/media'][i%3])));
 try{
  let start=performance.now();const tick=new Promise(r=>setTimeout(()=>r(performance.now()-start),10));
  const cold=await batch();assert.equal((await request('/ping')).status,200);
  const lag=await tick;assert.ok(lag<500,`HTTP timer delayed ${lag}ms`);
  assert.equal(calls,1,'Concurrent cold requests share one admission');
  cold.forEach((r,i)=>assert.equal(r.status,[503,200,409][i%3]));
  release();await gate.settled();assert.equal(gate(review,video,receiptPath).ready,true);
  const admittedCalls=calls;assert.equal(admittedCalls,10);
  for(let round=0;round<3;round++){
   const warm=await batch();warm.forEach((r,i)=>{assert.equal(r.status,[200,200,206][i%3]);if(i%3===2)assert.deepEqual(r.body,fs.readFileSync(video).subarray(0,32));});
  }
  assert.equal(calls,admittedCalls,'Repeated HTTP ranges do not rehash or decode');
  const timed=createHostedComparisonGate({admissionBudgetMs:10,hash:(_path,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('deadline')),{once:true}))});
  assert.equal(timed(review,video,receiptPath).ready,false);await timed.settled();
  assert.deepEqual(timed(review,video,receiptPath).reasons,['bound_receipt_admission_failed']);
  const failed=createHostedComparisonGate({hash:()=>{throw Error('read failed');}});
  failed(review,video,receiptPath);await failed.settled();assert.equal(failed(review,video,receiptPath).ready,false);
  assert.equal(gate({...review,status:'REPAIR'},video,receiptPath).ready,false,'Changed review invalidates admission');
  const receipt=JSON.parse(fs.readFileSync(receiptPath));
  try{
   const bad=structuredClone(receipt);bad.runtime_binding.files.pop();fs.writeFileSync(receiptPath,JSON.stringify(bad));
   assert.equal((await request('/v2/media')).status,409,'Incomplete seal cannot bypass reference binding');
  }finally{fs.writeFileSync(receiptPath,JSON.stringify(receipt));}
  // Replacing the receipt itself requires fresh asynchronous admission.
  assert.equal((await request('/v2/media')).status,409);await gate.settled();assert.equal((await request('/v2/media')).status,206);
  const original=fs.readFileSync(reference),stat=fs.statSync(reference),changed=Buffer.from(original);changed[changed.length-1]^=1;
  try{
   fs.writeFileSync(reference,changed);fs.utimesSync(reference,stat.atime,stat.mtime);
   assert.equal((await request('/v2/media')).status,409,'Same-size mutation with restored mtime invalidates receipt');
   assert.equal((await request('/v2/health')).status,503);
  }finally{fs.writeFileSync(reference,original);}
  assert.equal((await request('/v2/media')).status,409,'Restoring bytes requires explicit revalidation');
  console.log(`SYNTHETIC HTTP: 120 concurrent requests; 30 successful batched ranges; cold timer ${lag.toFixed(1)}ms; ${admittedCalls} initial async hashes, no repeat hashes before receipt replacement, zero request decodes`);
 }finally{release();await gate.settled();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
