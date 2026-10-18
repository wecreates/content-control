import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeHandoff as gate,CREATIVE_CHECKS} from '../creative-handoff.js';
import {validateReview} from '../scripts/exact_av_review.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const hash='a'.repeat(64);
const media={verified:true,candidate_sha256:hash,duration_seconds:50};
const creativeHandoff=(review,hash)=>gate(review,hash,media);
const review=()=>({candidate_sha256:hash,status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,duration_seconds:50,reviewed_intervals:[[0,25],[25,50]],checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'Timestamped observed evidence for '+k}])),comparisons:['abcdefghijk','lmnopqrstuv'].map(id=>({url:`https://www.youtube.com/watch?v=${id}`,access_scope:'full audiovisual review',full_video_review:true,full_audio_review:true,observation:'Specific observation',applied_difference:'Specific application'})),unresolved_issues:[],publication_enabled:false,reviewer:{identity:'Independent test reviewer',method:'Full audiovisual playback inspection',evidence:'Traceable review session identifier'},findings:[],critical_count:0,major_count:0});
test('only fully reviewed exact render can be offered',()=>{assert.equal(creativeHandoff(review(),hash).ready,true);assert.equal(creativeHandoff(review(),'b'.repeat(64)).ready,false);assert.equal(creativeHandoff(null,hash).ready,false)});
test('samples, transcript and technical success do not replace audiovisual review',()=>{for(const field of ['full_audio_review','full_video_review']){const r=review();r[field]=false;assert.equal(creativeHandoff(r,hash).ready,false)}const r=review();r.reviewed_intervals=[[0,2],[45,50]];assert.equal(creativeHandoff(r,hash).ready,false)});
test('unresolved issues, undocumented criteria and repeated reference block handoff',()=>{const r=review();r.unresolved_issues=['bad mix'];assert.equal(creativeHandoff(r,hash).ready,false);r.unresolved_issues=[];r.checks.hook.evidence='';assert.equal(creativeHandoff(r,hash).ready,false);r.checks=review().checks;r.comparisons=[r.comparisons[0],r.comparisons[0]];assert.equal(creativeHandoff(r,hash).ready,false)});

test('malformed persisted review fails closed',()=>{const r=review();r.reviewed_intervals={start:0,end:50};r.comparisons=[null];assert.equal(creativeHandoff(r,hash).ready,false)});

test('metadata-only competitors cannot certify competitive handoff',()=>{const r=review();r.comparisons.forEach(c=>{c.full_video_review=false;c.access_scope='metadata only'});assert.equal(creativeHandoff(r,hash).ready,false)});

test('review duration must match independently recorded exact media duration',()=>{
 assert.equal(gate(review(),hash).ready,false);
 for(const evidence of [{...media,verified:false},{...media,candidate_sha256:'b'.repeat(64)},{...media,duration_seconds:NaN}])assert.equal(gate(review(),hash,evidence).ready,false);
 const r=review();r.duration_seconds=.01;r.reviewed_intervals=[[0,.01]];assert.equal(gate(r,hash,media).ready,false);
});
test('sub-frame media cannot validate a nonpositive claimed review duration',()=>{
 const shortMedia={...media,duration_seconds:.01};
 for(const duration_seconds of [0,-.01,-.03]){
  const r={...review(),duration_seconds,reviewed_intervals:[[0,.01]]};
  assert.equal(gate(r,hash,shortMedia).ready,false,String(duration_seconds));
  assert.equal(validateReview(r,shortMedia).ready,false,String(duration_seconds));
 }
 const r={...review(),duration_seconds:.01,reviewed_intervals:[[0,.01]]};
 assert.equal(gate(r,hash,shortMedia).ready,true);
});
test('tracking variants and platform aliases are one competitor',()=>{
 const r=review();for(const urls of [
 ['https://www.instagram.com/reel/ABC/?a=1','https://instagram.com/p/ABC/?a=2'],
 ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk&tracking=1'],
 ['https://example.org/video/1?a=1','https://www.example.org/video/1/?a=2']
 ]) {r.comparisons=urls.map(url=>({...review().comparisons[0],url}));assert.equal(creativeHandoff(r,hash).ready,false);}
});
test('competitor access and written observations must be explicit',()=>{
 for(const patch of [{access_scope:'metadata only'},{observation:true},{applied_difference:true},{url:'https://user:pass@example.org/video/1'}]){
  const r=review();r.comparisons[0]={...r.comparisons[0],...patch};assert.equal(creativeHandoff(r,hash).ready,false);
 }
});

test('per-gap tolerance cannot turn near-zero samples into complete review',()=>{
 const r=review();r.reviewed_intervals=Array.from({length:1000},(_,i)=>[i*.05,i*.05+.000001]);
 assert.ok(r.reviewed_intervals.reduce((total,[start,end])=>total+end-start,0)<.002);
 assert.equal(gate(r,hash,media).ready,false);
 assert.equal(validateReview(r,media).ready,false);
});
test('missing frames at the start, middle or end block full coverage',()=>{
 for(const intervals of [[[.04,50]],[[0,25],[25.04,50]],[[0,49.96]]]){
  const r=review();r.reviewed_intervals=intervals;
  assert.ok(gate(r,hash,media).reasons.includes('review_coverage_incomplete'),JSON.stringify(intervals));
 }
});
test('coverage is the interval union, independent of input order and overlaps',()=>{
 const r=review();r.reviewed_intervals=[[25,50],[0,30],[10,20]];
 assert.equal(gate(r,hash,media).ready,true);
});
test('floating point roundoff is allowed once, without accumulating arbitrary gaps',()=>{
 const r=review();r.reviewed_intervals=[[0,.3],[.1+.2,50]];
 assert.equal(gate(r,hash,media).ready,true);
 r.reviewed_intervals=Array.from({length:1000},(_,i)=>[i*.05,i*.05+.05-1e-12]);
 assert.equal(gate(r,hash,media).ready,false);
});
test('hosted gate and exact validator both require provenance and publication lock',()=>{
 for(const mutate of [r=>delete r.reviewer,r=>r.reviewer.evidence='unverified',r=>delete r.publication_enabled,r=>r.publication_enabled=true]){
  const r=review();mutate(r);
  assert.equal(gate(r,hash,media).ready,false);
  assert.deepEqual(gate(r,hash,media).reasons,validateReview(r,media).reasons);
 }
});
test('hosted gate rejects unresolved, material and malformed findings and forged counts',()=>{
 const finding={start_sec:1,end_sec:2,severity:'minor',category:'voice',evidence:'Observed clipped pronunciation',repair:'Replace the track and review it',resolved:true};
 for(const patch of [
  {findings:[{...finding,resolved:false}]},
  {findings:[{...finding,severity:'critical'}],critical_count:1},
  {findings:[{...finding,severity:'major'}],major_count:1},
  {findings:[{...finding,start_sec:2,end_sec:1}]},
  {findings:[{...finding,end_sec:51}]},
  {findings:[null]}, {findings:{}}, {findings:null}, {critical_count:1}, {major_count:'0'}
 ]){
  const r={...review(),...patch};
  assert.equal(gate(r,hash,media).ready,false,JSON.stringify(patch));
  assert.deepEqual(gate(r,hash,media).reasons,validateReview(r,media).reasons);
 }
 const r=review();r.findings=[finding];assert.equal(gate(r,hash,media).ready,true);
});
test('known-site non-content URLs and ambiguous unknown identities cannot certify competitors',()=>{
 for(const urls of [
  ['https://youtube.com/','https://youtube.com/about'],
  ['https://youtube.com/watch?v=abcdefghijk','https://youtube.com./watch?v=abcdefghijk'],
  ['https://youtu.be/abcdefghijk','https://youtu.be/%61bcdefghijk'],
  ['https://example.org/video/1','https://example.org/video/%31'],
  ['https://example.org/video/1','https://example.org/video/2'],
  ['https://fb.watch/abc','https://fb.watch/def']
 ]){
  const r=review();r.comparisons=urls.map(url=>({...r.comparisons[0],url}));
  assert.equal(gate(r,hash,media).ready,false,JSON.stringify(urls));
  assert.equal(validateReview(r,media).ready,false,JSON.stringify(urls));
 }
});
test('known social providers retain concrete distinct content identities',()=>{
 for(const urls of [
  ['https://youtube.com/shorts/abcdefghijk','https://youtu.be/lmnopqrstuv'],
  ['https://instagram.com/reel/ABC/','https://instagram.com/p/XYZ/'],
  ['https://facebook.com/reel/123/','https://m.facebook.com/watch?v=456'],
  ['https://tiktok.com/@user/video/123','https://tiktok.com/@user/video/456'],
  ['https://threads.net/@user/post/ABC','https://threads.com/@user/post/XYZ'],
  ['https://x.com/user/status/123','https://twitter.com/user/status/456'],
  ['https://pinterest.com/pin/123/','https://pinterest.com/pin/456/'],
  ['https://linkedin.com/feed/update/urn:li:activity:123','https://linkedin.com/feed/update/urn:li:activity:456'],
  ['https://reddit.com/comments/abc/','https://redd.it/xyz']
 ]){
  const r=review();r.comparisons=urls.map(url=>({...r.comparisons[0],url}));
  assert.equal(gate(r,hash,media).ready,true,JSON.stringify(urls));
 }
});
test('synthetic concrete IDs beginning short- are not confused with unresolved redirects',()=>{
 // These exercise URL identity syntax only; no real video existence is asserted.
 for(const url of ['https://youtube.com/watch?v=short-12345','https://instagram.com/reel/short-12345/','https://threads.com/@user/post/short-12345']){
  const r=review();r.comparisons[0].url=url;
  assert.equal(gate(r,hash,media).ready,true,url);
 }
 for(const host of ['fb.watch','vm.tiktok.com','vt.tiktok.com','pin.it']){
  const r=review();r.comparisons[0].url=`https://${host}/unresolved`;
  assert.equal(gate(r,hash,media).ready,false,host);
 }
});
test('malformed hashes cannot establish an exact-media identity',()=>{
 for(const invalid of ['x',123,true,{},'A'.repeat(64)]){
  const r=review();r.candidate_sha256=invalid;
  assert.equal(gate(r,invalid,{...media,candidate_sha256:invalid}).ready,false);
 }
});

// Exercise the actual hosted acceptance function without starting unrelated
// OAuth/POD services or opening sockets. Only persisted I/O is substituted.
const serverSource=readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
const hostedAcceptanceSource=serverSource.match(/function v2Acceptance\(\)\s*\{[\s\S]*?\n\}/)?.[0];
function hostedAcceptance(reviewPatch={},healthPatch={},runtimePatch={}){
 assert.ok(hostedAcceptanceSource,'Hosted v2Acceptance function must remain covered');
 assert.match(serverSource,/import\s*\{creativeHandoff\}\s*from\s*["']\.\/creative-handoff\.js["']/);
 const health={status:'READY',publication_enabled:false,creative_qa:true,technical_qa:true,visual_parity_qa:true,candidate_sha256:hash,creative_review:{...review(),...reviewPatch},media_evidence:media,...healthPatch};
 const runtime={status:'READY',candidate_sha256:hash,...runtimePatch};
 return vm.runInNewContext(hostedAcceptanceSource+'\nv2Acceptance()',{
  readJson:file=>file==='health.json'?health:runtime,fileHash:()=>hash,
  v2HealthPath:'health.json',v2Output:'candidate.mp4',path,creativeHandoff:gate,
 });
}
test('hosted V2 acceptance uses the same strict evidence gate as exact validation',()=>{
 assert.equal(hostedAcceptance().ready,true);
 const material={start_sec:1,end_sec:2,severity:'critical',category:'voice',evidence:'Entire dialogue track is missing',repair:'Replace the track and review it',resolved:false};
 for(const patch of [
  {reviewer:null}, {publication_enabled:true}, {findings:[material],critical_count:1},
  {reviewed_intervals:[[0,1],[1.04,50]]},
  {comparisons:review().comparisons.map((r,i)=>({...r,url:i?'https://youtube.com/about':'https://youtube.com/'}))},
 ])assert.equal(hostedAcceptance(patch).ready,false,JSON.stringify(patch));
});
test('hosted V2 acceptance still blocks stale runtime and media evidence identities',()=>{
 assert.equal(hostedAcceptance({}, {}, {candidate_sha256:'b'.repeat(64)}).ready,false);
 assert.equal(hostedAcceptance({}, {candidate_sha256:'b'.repeat(64)}).ready,false);
 assert.equal(hostedAcceptance({}, {media_evidence:{...media,candidate_sha256:'b'.repeat(64)}}).ready,false);
 assert.equal(hostedAcceptance({}, {publication_enabled:true}).ready,false);
});
