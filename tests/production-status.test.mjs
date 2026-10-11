import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createProductionStatusRouter,createDraftPreviewHoldRouter} from '../production-status.js';
async function fixture(report,fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'production-status-'));await fs.mkdir(path.join(root,'state'));if(report)await fs.writeFile(path.join(root,'state/v2-production-status.json'),JSON.stringify(report));const app=express();app.use(createProductionStatusRouter({root}));const s=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});try{await fn(`http://127.0.0.1:${s.address().port}/v2`)}finally{await new Promise(r=>s.close(r));await fs.rm(root,{recursive:true,force:true});}}
const base={schema_version:1,run_id:123,recorded_at:new Date().toISOString(),publication_enabled:false,production_approved:false,checks:{technical_video:{status:'PASS'},style_parity:{status:'FAIL'}},status:'BLOCKED'};
test('actual mixed results remain blocked and do not offer a preview',()=>fixture(base,async url=>{const r=await fetch(url);const d=await r.json();assert.equal(r.status,200);assert.equal(d.checks.technical_video.status,'PASS');assert.equal(d.checks.style_parity.status,'FAIL');assert.equal(d.watch_url,null);assert.equal(d.production_approved,false)}));
test('stale build reports are explicitly dated',()=>fixture({...base,recorded_at:'2020-01-01T00:00:00Z'},async url=>{assert.equal((await(await fetch(url)).json()).report_stale,true)}));
test('missing or publication-enabled reports cannot appear healthy',async()=>{for(const report of [null,{...base,publication_enabled:true},{...base,recorded_at:'2099-01-01'}])await fixture(report,async url=>{const r=await fetch(url);assert.equal(r.status,503);assert.equal((await r.json()).production_approved,false)})});

test('old draft watch and ranged media URLs cannot expose an unfinished preview',async()=>{const app=express();app.use('/draft',createDraftPreviewHoldRouter());const s=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});try{const base=`http://127.0.0.1:${s.address().port}/draft`;const media=await fetch(base+'/media',{headers:{Range:'bytes=0-100'}});assert.equal(media.status,409);assert.equal((await media.json()).production_approved,false);const watch=await fetch(base+'/watch');assert.equal(watch.status,409);assert.equal((await watch.text()).includes('<video'),false)}finally{await new Promise(r=>s.close(r));}});


test('unapproved report cannot advertise readiness or inject preview URLs',()=>fixture({...base,status:'APPROVED',ready:true,watch_url:'/unsafe',preview_url:'/unsafe',media_url:'/unsafe',watchUrl:'/unsafe'},async url=>{
 const r=await fetch(url);const d=await r.json();assert.equal(r.status,200);assert.equal(d.status,'BLOCKED');assert.equal(d.production_approved,false);assert.equal(d.watch_url,null);
 for(const key of ['ready','preview_url','media_url','watchUrl'])assert.equal(Object.hasOwn(d,key),false);
 assert.equal(d.checks.technical_video.status,'PASS');
}));

test('preview hold blocks every method before downstream media handlers',async()=>{
 const app=express();app.use('/draft',createDraftPreviewHoldRouter());app.all('/draft/:route',(req,res)=>res.status(200).send('unfinished media'));
 const s=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
 try{for(const route of ['media','watch'])for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']){
  const r=await fetch(`http://127.0.0.1:${s.address().port}/draft/${route}`,{method});assert.equal(r.status,409,`${method} ${route}`);assert.equal(r.headers.get('cache-control'),'no-store');
 }}finally{await new Promise(r=>s.close(r));}
});
