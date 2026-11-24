import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createServer} from 'node:http';
const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
const sourceParser=source.match(/function renderSourceCommit\(env=process\.env\)\{[\s\S]*?\n\}/)[0];
const parseRenderSourceCommit=vm.runInNewContext(sourceParser+'\nrenderSourceCommit');
test('deployed source identity fails closed unless Render supplies canonical 40-hex',()=>{
 const commit='0123456789abcdef0123456789abcdef01234567';
 assert.equal(parseRenderSourceCommit({RENDER_GIT_COMMIT:commit}),commit);
 for(const value of [undefined,'','A'.repeat(40),'a'.repeat(39),'g'.repeat(40),123]){
  assert.equal(parseRenderSourceCommit({RENDER_GIT_COMMIT:value}),null);
 }
});
test('actual HTTP liveness stays separate from blocked caption/media acceptance',async()=>{
 const routes=new Map();
 const acceptance=source.match(/function acceptance\(\)\{[\s\S]*?\n\}/)[0];
 const handlers=source.slice(source.indexOf('app.get("/livez"'),source.indexOf('app.get("/status"'));
 const media=source.slice(source.indexOf('app.get("/media",'),source.indexOf('app.get("/captions",'));
 const deployedSourceCommit='b'.repeat(40);
 vm.runInNewContext(acceptance+'\n'+handlers+'\n'+media,{
  app:{get:(path,fn)=>routes.set(path,fn)},readHealth:()=>({status:'GREEN',candidate_sha256:'a'.repeat(64),publication_enabled:false}),
  readCaptionHealth:()=>({status:'FAIL',publication_enabled:false}),fileHash:()=> 'a'.repeat(64),
  fs:{existsSync:()=>true},output:'SYNTHETIC video',captionsPath:'SYNTHETIC captions',renderState:{status:'idle'},
  deployedSourceCommit,streamMp4:()=>{throw Error('Blocked media must not stream');}
 });
 const server=createServer((req,res)=>{res.status=n=>{res.statusCode=n;return res;};res.json=value=>res.end(JSON.stringify(value));routes.get(req.url)(req,res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const live=await fetch(base+'/livez');assert.equal(live.status,200);assert.deepEqual(await live.json(),{alive:true,service:'content-control-review',production_approved:false,publication:false});
  const health=await fetch(base+'/health');assert.equal(health.status,200);const h=await health.json();assert.equal(h.evidence_ready,null);assert.equal(h.readiness_url,'/readyz');assert.equal(h.deployed_source_commit,deployedSourceCommit);assert.ok(Number.isSafeInteger(h.observed_at));assert.equal(h.production_approved,false);assert.equal(h.publication,false);
  const readiness=await fetch(base+'/readyz');assert.equal(readiness.status,503);const r=await readiness.json();assert.equal(r.ok,false);assert.equal(r.captionReady,false);assert.equal(r.deployed_source_commit,deployedSourceCommit);assert.ok(Number.isSafeInteger(r.observed_at));assert.equal(r.production_approved,false);assert.equal(r.publication,false);
  const media=await fetch(base+'/media');assert.equal(media.status,409);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
