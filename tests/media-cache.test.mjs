import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';

// Exercise the actual route/stream bodies without starting background workers.
const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
async function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-media-cache-'));
 const media=path.join(root,'candidate.mp4'),captions=path.join(root,'captions.vtt');
 fs.writeFileSync(media,'accepted candidate A');fs.writeFileSync(captions,'WEBVTT\n\n');
 let ready=true;
 const acceptance=()=>({ready,captionReady:ready,expected:crypto.createHash('sha256').update(fs.readFileSync(media)).digest('hex'),captionHash:'caption-fixture'});
 const app=express();
 const context={app,fs,output:media,v2Output:media,captionsPath:captions,episode3CaptionsPath:captions,acceptance,v2Acceptance:acceptance,episode3Acceptance:acceptance};
 const routes=part('function streamMp4(','app.get("/episode2/health"')+
  part('app.get("/media",','function streamMp4(')+
  part('app.get("/episode3/captions",','app.get("/episode3/watch",')+
  source.split('\n').find(line=>line.startsWith('app.get("/v2/media"'))+
  part('app.get("/v2/watch",','app.get("/clone/health",');
 vm.runInNewContext(routes,context);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{await fn({base:`http://127.0.0.1:${server.address().port}`,media,revoke:()=>{ready=false;}});}
 finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
}
test('mutable review video and caption URLs prohibit caching',()=>fixture(async({base})=>{
 for(const route of ['/media','/v2/media','/captions','/episode3/captions']){
  const response=await fetch(base+route);assert.equal(response.status,200,route);
  assert.match(response.headers.get('cache-control'),/no-store/,route);await response.arrayBuffer();
 }
 for(const route of ['/media','/v2/media']){
  const response=await fetch(base+route,{headers:{Range:'bytes=0-2'}});
  assert.equal(response.status,206);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await response.arrayBuffer()).byteLength,3);
 }
}));
test('replacement remains uncached and rejected V2 responses also prohibit caching',()=>fixture(async({base,media,revoke})=>{
 const first=await fetch(base+'/v2/media'),etag=first.headers.get('etag');await first.arrayBuffer();
 fs.writeFileSync(media,'accepted candidate B');
 const replacement=await fetch(base+'/v2/media');assert.notEqual(replacement.headers.get('etag'),etag);
 assert.match(replacement.headers.get('cache-control'),/no-store/);await replacement.arrayBuffer();
 revoke();const rejected=await fetch(base+'/v2/media',{headers:{Range:'bytes=0-2'}});
 assert.equal(rejected.status,409);assert.match(rejected.headers.get('cache-control'),/no-store/);
}));
test('watch URLs use the accepted hash and cannot silently stream its replacement',()=>fixture(async({base,media})=>{
 const first=await(await fetch(base+'/v2/watch')).text();
 const oldUrl=first.match(/src="(\/v2\/media\?sha256=[a-f0-9]{64})"/)?.[1];assert.ok(oldUrl);
 assert.equal((await fetch(base+oldUrl)).status,200);
 fs.writeFileSync(media,'accepted candidate B');
 const second=await(await fetch(base+'/v2/watch')).text();
 const newUrl=second.match(/src="(\/v2\/media\?sha256=[a-f0-9]{64})"/)?.[1];assert.ok(newUrl);assert.notEqual(oldUrl,newUrl);
 const stale=await fetch(base+oldUrl);assert.equal(stale.status,409);assert.match(stale.headers.get('cache-control'),/no-store/);
 assert.equal((await fetch(base+newUrl)).status,200);
}));
