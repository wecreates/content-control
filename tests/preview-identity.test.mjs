import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildPreviewIdentity,previewRequestMatches,selectCurrentPreview} from '../preview-identity.js';

const CANDIDATE='a'.repeat(64);
const CAPTIONS='b'.repeat(64);
const config={id:'episode3',engine:'free',watchPath:'/episode3/watch',mediaPath:'/episode3/media',captionsPath:'/episode3/captions'};
const accepted=()=>({
 expected:CANDIDATE,actual:CANDIDATE,captionHash:CAPTIONS,captionCandidateSha256:CANDIDATE,
 videoReady:true,captionReady:true,publicationLocked:true,evidencePresent:true,ready:true,qaStatus:'GREEN'
});

test('accepted preview exposes one exact candidate, caption and route identity',()=>{
 const preview=buildPreviewIdentity(config,accepted());
 assert.equal(preview.ready,true);
 assert.equal(preview.identityConsistent,true);
 assert.deepEqual(preview.failedChecks,[]);
 assert.equal(preview.watchUrl,`/episode3/watch?sha256=${CANDIDATE}&caption_sha256=${CAPTIONS}`);
 assert.equal(preview.mediaUrl,`/episode3/media?sha256=${CANDIDATE}`);
 assert.equal(preview.captionsUrl,`/episode3/captions?sha256=${CAPTIONS}`);
});

for(const [name,mutate,failed] of [
 ['candidate bytes',v=>v.actual='c'.repeat(64),'candidate_bytes_exact'],
 ['caption bytes',v=>v.captionHash=null,'caption_sha256_valid'],
 ['caption candidate',v=>v.captionCandidateSha256='d'.repeat(64),'caption_candidate_exact'],
 ['caption gate',v=>v.captionReady=false,'caption_gate_ready'],
 ['publication lock',v=>v.publicationLocked=false,'publication_locked']
])test(`preview fails closed for mismatched ${name}`,()=>{
 const value=accepted();mutate(value);
 const preview=buildPreviewIdentity(config,value);
 assert.equal(preview.ready,false);
 assert.equal(preview.identityConsistent,false);
 assert.ok(preview.failedChecks.includes(failed));
 assert.equal(preview.watchUrl,null);
 assert.equal(preview.mediaUrl,null);
 assert.equal(preview.captionsUrl,null);
});

test('retained newer evidence blocks fallback to an older green preview',()=>{
 const current=buildPreviewIdentity(config,{...accepted(),actual:'c'.repeat(64),ready:false});
 const older=buildPreviewIdentity({...config,id:'episode1',watchPath:'/watch'},accepted());
 const selected=selectCurrentPreview([current,older]);
 assert.equal(selected.id,'episode3');
 assert.equal(selected.ready,false);
 assert.ok(selected.failedChecks.includes('candidate_bytes_exact'));
});

test('selector uses canonical preview only when no newer evidence exists',()=>{
 const absent=buildPreviewIdentity(config,{evidencePresent:false});
 const canonical=buildPreviewIdentity({...config,id:'episode1',watchPath:'/watch'},accepted());
 assert.equal(selectCurrentPreview([absent,canonical]).id,'episode1');
});

test('hash-bound watch requests require a complete exact candidate and caption pair',()=>{
 assert.equal(previewRequestMatches({},CANDIDATE,CAPTIONS),true);
 assert.equal(previewRequestMatches({sha256:CANDIDATE,caption_sha256:CAPTIONS},CANDIDATE,CAPTIONS),true);
 assert.equal(previewRequestMatches({sha256:CANDIDATE},CANDIDATE,CAPTIONS),false);
 assert.equal(previewRequestMatches({caption_sha256:CAPTIONS},CANDIDATE,CAPTIONS),false);
 assert.equal(previewRequestMatches({sha256:'c'.repeat(64),caption_sha256:CAPTIONS},CANDIDATE,CAPTIONS),false);
});

test('episode 3 watch rejects a stale candidate or caption pair without rendering a player',()=>{
 const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
 const route=source.slice(source.indexOf('app.get("/episode3/watch"'),source.indexOf('app.post("/v2/run"'));
 let handler;
 vm.runInNewContext(route,{
  app:{get:(_path,fn)=>{handler=fn;}},
  episode3Acceptance:()=>({...accepted(),captionHash:CAPTIONS}),
  previewRequestMatches,
 });
 const invoke=query=>{
  const result={statusCode:200,headers:{},body:null};
  const res={
   setHeader:(name,value)=>{result.headers[name.toLowerCase()]=value;return res;},
   status:value=>{result.statusCode=value;return res;},
   type:value=>{result.headers['content-type']=value;return res;},
   send:value=>{result.body=value;return res;}
  };
  handler({query},res);return result;
 };
 const exact=invoke({sha256:CANDIDATE,caption_sha256:CAPTIONS});
 assert.equal(exact.statusCode,200);
 assert.match(exact.body,new RegExp(`<meta name="review-candidate-sha256" content="${CANDIDATE}">`));
 assert.match(exact.body,/id="player"/);
 const staleCandidate=invoke({sha256:'c'.repeat(64),caption_sha256:CAPTIONS});
 assert.equal(staleCandidate.statusCode,503);
 assert.doesNotMatch(staleCandidate.body,/id="player"/);
 const missingCaption=invoke({sha256:CANDIDATE});
 assert.equal(missingCaption.statusCode,503);
 assert.doesNotMatch(missingCaption.body,/id="player"/);
});
