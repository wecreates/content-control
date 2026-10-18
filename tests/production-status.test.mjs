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


async function revalidationFixture(change,fn){
 const {createHash}=await import('node:crypto');const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'revalidation-status-'));
 const candidate=Buffer.from('fixture bytes'),candidateHash=hash(candidate);
 const rubric=Object.fromEntries(['typography','character_scale','staging','character_consistency','phone_readability'].map(key=>[key,{pass:false,evidence:'Observed issue '+key}]));
 const references=Array.from({length:4},(_,i)=>({path:`reference/frames/ref-${i}.jpg`,sha256:hash('reference '+i)}));
 const review={candidate:{sha256:candidateHash},reference_frames:references,decision:'FAIL',rubric,unresolved_issues:['Needs creative repair']};
 const reviewBytes=JSON.stringify(review);
 const draft={status:'DRAFT',candidate_sha256:candidateHash,run_id:123,production_approved:false,publication_enabled:false};
 const report={schema_version:1,status:'BLOCKED',candidate_sha256:candidateHash,original_run_id:123,visual_review_sha256:hash(reviewBytes),production_approved:false,publication_enabled:false,full_av_review:false,render_attempted:false,visual_review:{status:'FAIL',rubric:Object.fromEntries(Object.entries(rubric).map(([k,v])=>[k,{status:'MISMATCH',observation:v.evidence}]))},media_url:'/unsafe',watch_url:'/unsafe'};
 const files={'state/v2-revalidation.json':JSON.stringify(report),'state/v2-draft.json':JSON.stringify(draft),'state/visual-analysis/frame-review.json':reviewBytes,'public-review/v2-draft.mp4':candidate};
 for(let i=0;i<references.length;i++)files[references[i].path]='reference '+i;
 if(change)change(files,report,draft);
 for(const [name,bytes] of Object.entries(files)){const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
 const app=express();app.use(createProductionStatusRouter({root}));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{await fn(`http://127.0.0.1:${server.address().port}/v2/revalidation`,root);}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
}
test('exact revalidation exposes safe findings without media or approval',()=>revalidationFixture(null,async url=>{
 const response=await fetch(url),data=await response.json();assert.equal(response.status,200);assert.equal(data.status,'BLOCKED');assert.equal(data.rubric.staging.status,'MISMATCH');assert.deepEqual(data.blockers,['Needs creative repair']);assert.equal(data.watch_url,null);assert.equal(data.media_url,undefined);assert.equal(data.full_av_review,false);assert.equal(data.production_approved,false);
}));
test('stale candidate, review, run and forged approval fail closed',async()=>{
 for(const mutate of [
 files=>files['public-review/v2-draft.mp4']='changed video',
 files=>files['state/visual-analysis/frame-review.json']+=' ',
 (files,report)=>{report.original_run_id=124;files['state/v2-revalidation.json']=JSON.stringify(report);},
 (files,report)=>{report.status='VISUAL_REVALIDATED';files['state/v2-revalidation.json']=JSON.stringify(report);},
 (files,report)=>{report.production_approved=true;files['state/v2-revalidation.json']=JSON.stringify(report);},
 (files,report)=>{report.visual_review.rubric.staging.observation='forged';files['state/v2-revalidation.json']=JSON.stringify(report);}
 ])await revalidationFixture(mutate,async url=>{const response=await fetch(url),data=await response.json();assert.equal(response.status,503);assert.equal(data.watch_url,null);assert.equal(data.rubric,undefined);assert.equal(data.production_approved,false);});
});

async function executionFixture(report,fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'execution-status-'));await fs.mkdir(path.join(root,'state/production-execution'),{recursive:true});
 if(report)await fs.writeFile(path.join(root,'state/production-execution/long.json'),JSON.stringify(report));
 const app=express();app.use(createProductionStatusRouter({root}));const s=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
 try{await fn(`http://127.0.0.1:${s.address().port}/execution/long`)}finally{await new Promise(r=>s.close(r));await fs.rm(root,{recursive:true,force:true});}
}
const executionBase={...base,format:'long',source_commit:'b'.repeat(40),run_attempt:1,candidate_sha256:'a'.repeat(64),candidate_generated:true,workflow_outcome:'success',technical_status:'PASS',checks:{technical_video:{status:'PASS',hash_bound:true},openmontage_probe:{status:'PASS',hash_bound:true}}};
test('format-specific technical evidence stays pending review with no playback',()=>executionFixture({...executionBase,production_ready:true,watch_url:'https://bad',creative_review:'APPROVED'},async url=>{
 const r=await fetch(url);const d=await r.json();assert.equal(r.status,200);assert.equal(d.technical_status,'PASS');assert.equal(d.status,'REVIEW_PENDING');assert.equal(d.creative_review,'PENDING');assert.equal(d.audio_listening_review,'PENDING');assert.equal(d.watch_url,null);assert.equal(d.media_url,null);assert.equal(d.production_approved,false);assert.equal(Object.hasOwn(d,'production_ready'),false);
}));
test('stale or failed format summaries cannot claim current success',async()=>{
 for(const change of [{recorded_at:'2020-01-01T00:00:00Z'},{workflow_outcome:'failure'},{checks:{}}])await executionFixture({...executionBase,...change},async url=>{assert.equal((await(await fetch(url)).json()).status,'BLOCKED')});
});
test('missing or invalid execution summaries fail closed',async()=>{
 for(const report of [null,{...executionBase,publication_enabled:true},{...executionBase,format:'short'},{...executionBase,candidate_sha256:'bad'}])await executionFixture(report,async url=>{assert.equal((await fetch(url)).status,503)});
});

async function canonicalFindingsFixture(tamper,fn){
 const {createHash}=await import('node:crypto');
 return revalidationFixture((files,report)=>{
  const review=JSON.parse(files['state/visual-analysis/frame-review.json']);
  review.findings=Object.entries(review.rubric).map(([dimension,item])=>({dimension,status:'MISMATCH',candidate_frames:[0],observation:item.evidence}));delete review.rubric;
  report.visual_review.rubric=Object.fromEntries(review.findings.map(item=>[item.dimension,{...item}]));
  if(tamper)tamper(review,report);
  files['state/visual-analysis/frame-review.json']=JSON.stringify(review);
  report.visual_review_sha256=createHash('sha256').update(files['state/visual-analysis/frame-review.json']).digest('hex');
  files['state/v2-revalidation.json']=JSON.stringify(report);
 },fn);
}
test('canonical sampled findings schema exposes exact current findings',()=>canonicalFindingsFixture(null,async url=>{
 const response=await fetch(url),data=await response.json();assert.equal(response.status,200);assert.equal(data.rubric.typography.status,'MISMATCH');assert.equal(data.production_approved,false);assert.equal(data.watch_url,null);
}));
test('canonical findings reject forged status, observation, frames and duplicate dimensions',async()=>{
 for(const tamper of [
 (review,report)=>report.visual_review.rubric.typography.status='PASS',
 (review,report)=>report.visual_review.rubric.typography.observation='invented observation',
 (review,report)=>report.visual_review.rubric.typography.candidate_frames=[1],
 review=>review.findings[1]={...review.findings[0]},
 review=>review.findings.pop(),
 (review,report)=>{review.decision='PASS';report.status='VISUAL_REVALIDATED';report.visual_review.status='PASS';}
 ])await canonicalFindingsFixture(tamper,async url=>{const response=await fetch(url);assert.equal(response.status,503);assert.equal((await response.json()).production_approved,false);});
});

test('complete recorded technical checks distinguish review work from render failure',async()=>{
 const checks=Object.fromEntries(['voices','sound_mix','transcription','captions','caption_frames','technical_video','character_binding','phone_viewport'].map(name=>[name,{status:'PASS'}]));
 for(const [visual,status,review] of [['PASS','REVIEW_REQUIRED','FULL_AUDIOVISUAL_REVIEW_REQUIRED'],['BLOCKED','AWAITING_REVIEW','CURRENT_CANDIDATE_VISUAL_REVIEW_REQUIRED'],['FAIL','BLOCKED','CREATIVE_REPAIR_REQUIRED']])await fixture({...base,candidate_generated:true,candidate_sha256:'a'.repeat(64),checks:{...checks,style_parity:{status:visual}},technical_status:'FORGED'},async url=>{
  const d=await(await fetch(url)).json();assert.equal(d.status,status);assert.equal(d.review_status,review);assert.equal(d.technical_status,'PASS');assert.equal(d.production_approved,false);assert.equal(d.watch_url,null);
 });
});

test('revalidation invalidates changed or missing references after the digest cache is populated',()=>revalidationFixture(null,async(url,root)=>{
 assert.equal((await fetch(url)).status,200);
 const reference=path.join(root,'reference/frames/ref-0.jpg'),before=await fs.stat(reference);
 await fs.writeFile(reference,'reference X');await fs.utimes(reference,before.atime,before.mtime);
 let response=await fetch(url);assert.equal(response.status,503);assert.equal((await response.json()).production_approved,false);
 await fs.writeFile(reference,'reference 0');assert.equal((await fetch(url)).status,200);
 await fs.rm(path.join(root,'reference'),{recursive:true});response=await fetch(url);
 assert.equal(response.status,503);assert.equal((await response.json()).error,'REVALIDATION_STALE_OR_UNAVAILABLE');
}));

test('array and object candidate hashes cannot be coerced into technical success',async()=>{
 const checks=Object.fromEntries(['voices','sound_mix','transcription','captions','caption_frames','technical_video','character_binding','phone_viewport','style_parity'].map(name=>[name,{status:'PASS'}]));
 for(const candidate_sha256 of [['a'.repeat(64)],{},42,true,'bad']){
  await fixture({...base,candidate_generated:true,candidate_sha256,checks},async url=>assert.equal((await fetch(url)).status,503));
  await executionFixture({...executionBase,candidate_sha256},async url=>assert.equal((await fetch(url)).status,503));
 }
});
test('recorded time and source commit provenance must have string types',async()=>{
 for(const change of [{source_commit:['b'.repeat(40)]},{source_commit:42},{recorded_at:[new Date().toISOString()]},{recorded_at:42}]){
  await fixture({...base,...change},async url=>assert.equal((await fetch(url)).status,503));
  await executionFixture({...executionBase,...change},async url=>assert.equal((await fetch(url)).status,503));
 }
});

