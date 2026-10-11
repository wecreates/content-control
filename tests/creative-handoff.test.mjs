import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeHandoff as gate,CREATIVE_CHECKS} from '../creative-handoff.js';
const hash='a'.repeat(64);
const media={verified:true,candidate_sha256:hash,duration_seconds:50};
const creativeHandoff=(review,hash)=>gate(review,hash,media);
const review=()=>({candidate_sha256:hash,status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,duration_seconds:50,reviewed_intervals:[[0,25],[25,50]],checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'Timestamped observed evidence for '+k}])),comparisons:[1,2].map(n=>({url:`https://example.org/video/${n}`,access_scope:'full audiovisual review',full_video_review:true,full_audio_review:true,observation:'Specific observation',applied_difference:'Specific application'})),unresolved_issues:[]});
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
