import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createServer} from 'node:http';
test('actual HTTP liveness stays separate from blocked caption/media acceptance',async()=>{
 const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8'),routes=new Map();
 const acceptance=source.match(/function acceptance\(\)\{[\s\S]*?\n\}/)[0];
 const handlers=source.slice(source.indexOf('app.get("/livez"'),source.indexOf('app.get("/status"'));
 const media=source.slice(source.indexOf('app.get("/media",'),source.indexOf('app.get("/captions",'));
 vm.runInNewContext(acceptance+'\n'+handlers+'\n'+media,{
  app:{get:(path,fn)=>routes.set(path,fn)},readHealth:()=>({status:'GREEN',candidate_sha256:'a'.repeat(64),publication_enabled:false}),
  readCaptionHealth:()=>({status:'FAIL',publication_enabled:false}),fileHash:()=> 'a'.repeat(64),
  fs:{existsSync:()=>true},output:'SYNTHETIC video',captionsPath:'SYNTHETIC captions',renderState:{status:'idle'},
  streamMp4:()=>{throw Error('Blocked media must not stream');}
 });
 const server=createServer((req,res)=>{res.status=n=>{res.statusCode=n;return res;};res.json=value=>res.end(JSON.stringify(value));routes.get(req.url)(req,res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const live=await fetch(base+'/livez');assert.equal(live.status,200);assert.deepEqual(await live.json(),{alive:true,service:'content-control-review',production_approved:false,publication:false});
  const health=await fetch(base+'/health');assert.equal(health.status,503);const h=await health.json();assert.equal(h.captionReady,false);assert.equal(h.publication,false);
  const media=await fetch(base+'/media');assert.equal(media.status,409);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
