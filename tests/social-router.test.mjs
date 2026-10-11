import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createSocialRouter} from '../social-router.js';

async function fixture(run,{missing=false}={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'social-http-'));
 const original=process.env.PUBLICATION_ENABLED;process.env.PUBLICATION_ENABLED='true';
 const queue={version:1,queue:[{id:'existing',source_url:'https://www.instagram.com/reel/DeUlQTQxv5O/',publication_enabled:false}]};
 if(!missing){await fs.writeFile(path.join(root,'capability-queue.json'),JSON.stringify(queue));await fs.writeFile(path.join(root,'social-capabilities.json'),JSON.stringify({platforms:[]}));}
 const app=express();app.use('/api/social',createSocialRouter({root}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api/social`;
 try{await run(base,root);}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});if(original===undefined)delete process.env.PUBLICATION_ENABLED;else process.env.PUBLICATION_ENABLED=original;}
}
test('HTTP status returns real queue and explicit locked/missing revenue state',()=>fixture(async(base)=>{
 const r=await fetch(base+'/status');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const d=await r.json();assert.equal(d.records[0].id,'existing');assert.equal(d.publication_enabled,false);assert.equal(d.external_actions_enabled,false);assert.equal(d.automatic_token_renewal,false);assert.equal(d.revenue.net_profit,null);
}));
test('HTTP validation canonicalizes duplicates without persisting a new job',()=>fixture(async(base,root)=>{
 const before=await fs.readFile(path.join(root,'capability-queue.json'),'utf8');
 const r=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://instagram.com/p/DeUlQTQxv5O/?utm_source=test'})});
 const d=await r.json();assert.equal(r.status,200);assert.equal(d.duplicate,true);assert.equal(d.record_id,'existing');assert.equal(d.saved,false);assert.equal(d.publication_enabled,false);
 assert.equal(await fs.readFile(path.join(root,'capability-queue.json'),'utf8'),before);
 const invalid=await fetch(base+'/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://instagram.com.evil.test/reel/id'})});assert.equal(invalid.status,400);
}));
test('external action endpoints reject all mutation methods despite enabled environment and retries',()=>fixture(async(base)=>{
 for(const action of ['publish','schedule','messages','ads','spend','unknown'])for(const method of ['POST','PUT','PATCH','DELETE']) {
  const r=await fetch(`${base}/${action}`,{method});assert.equal(r.status,403,`${method} ${action}`);const d=await r.json();assert.equal(d.error,'PUBLICATION_DISABLED');assert.equal(d.publication_enabled,false);
 }
 const retry=await fetch(base+'/publish',{method:'POST'});assert.equal(retry.status,403);
 for(const action of ['publish','schedule','messages','ads','unknown'])assert.equal((await fetch(base+'/'+action)).status,404);
}));
test('intake explicitly fails without a durable authenticated writer and does not mutate',()=>fixture(async(base,root)=>{
 const before=await fs.readFile(path.join(root,'capability-queue.json'),'utf8');
 const r=await fetch(base+'/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://youtu.be/abcdefghijk'})});
 const d=await r.json();assert.equal(r.status,503);assert.equal(d.saved,false);assert.equal(d.error,'AUTHENTICATED_DURABLE_WRITER_NOT_CONFIGURED');assert.equal(await fs.readFile(path.join(root,'capability-queue.json'),'utf8'),before);
}));
test('missing status data returns 503 rather than empty successful dashboard',()=>fixture(async(base)=>{const r=await fetch(base+'/status');assert.equal(r.status,503);assert.equal((await r.json()).publication_enabled,false);},{missing:true}));
