import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeHandoff,CREATIVE_CHECKS} from '../creative-handoff.js';
const hash='a'.repeat(64);
const review=()=>({candidate_sha256:hash,status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,duration_seconds:50,reviewed_intervals:[[0,25],[25,50]],checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'Timestamped observed evidence for '+k}])),comparisons:[1,2].map(n=>({url:`https://example.org/video/${n}`,access_scope:'full audiovisual review',full_video_review:true,full_audio_review:true,observation:'Specific observation',applied_difference:'Specific application'})),unresolved_issues:[]});
test('only fully reviewed exact render can be offered',()=>{assert.equal(creativeHandoff(review(),hash).ready,true);assert.equal(creativeHandoff(review(),'b'.repeat(64)).ready,false);assert.equal(creativeHandoff(null,hash).ready,false)});
test('samples, transcript and technical success do not replace audiovisual review',()=>{for(const field of ['full_audio_review','full_video_review']){const r=review();r[field]=false;assert.equal(creativeHandoff(r,hash).ready,false)}const r=review();r.reviewed_intervals=[[0,2],[45,50]];assert.equal(creativeHandoff(r,hash).ready,false)});
test('unresolved issues, undocumented criteria and repeated reference block handoff',()=>{const r=review();r.unresolved_issues=['bad mix'];assert.equal(creativeHandoff(r,hash).ready,false);r.unresolved_issues=[];r.checks.hook.evidence='';assert.equal(creativeHandoff(r,hash).ready,false);r.checks=review().checks;r.comparisons=[r.comparisons[0],r.comparisons[0]];assert.equal(creativeHandoff(r,hash).ready,false)});

test('malformed persisted review fails closed',()=>{const r=review();r.reviewed_intervals={start:0,end:50};r.comparisons=[null];assert.equal(creativeHandoff(r,hash).ready,false)});

test('metadata-only competitors cannot certify competitive handoff',()=>{const r=review();r.comparisons.forEach(c=>{c.full_video_review=false;c.access_scope='metadata only'});assert.equal(creativeHandoff(r,hash).ready,false)});
