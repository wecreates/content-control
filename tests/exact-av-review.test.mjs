import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReview,validateReview} from '../scripts/exact_av_review.mjs';
import {CREATIVE_CHECKS} from '../creative-handoff.js';
const media={verified:true,candidate_sha256:'a'.repeat(64),duration_seconds:35.042};
function valid(){return {candidate_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,publication_enabled:false,reviewer:{identity:'Independent test reviewer',method:'Full audiovisual playback inspection',evidence:'Traceable review response identifier'},reviewed_intervals:[[0,35.042]],checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'Specific observed test evidence'}])),comparisons:['https://youtube.com/watch?v=abcdefghijk','https://youtube.com/watch?v=lmnopqrstuv'].map(url=>({url,full_video_review:true,full_audio_review:true,access_scope:'full audiovisual review',observation:'Specific observed competitor evidence',applied_difference:'Specific candidate comparison evidence'})),findings:[],critical_count:0,major_count:0,unresolved_issues:[]};}
test('preparation binds exact media and cannot approve',()=>{const r=prepareReview(media);assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.production_approved,false);assert.equal(r.media.candidate_sha256,media.candidate_sha256);assert.match(r.prompt,/audio end to end/);});
test('complete submitted evidence passes existing gate without publishing',()=>{const r=validateReview(valid(),media);assert.equal(r.ready,true,JSON.stringify(r));assert.equal(r.publication_enabled,false);assert.equal(r.production_approved,false);});
test('legacy stale-hash review rejected',()=>{const r=valid();r.candidate_sha256='b'.repeat(64);assert.ok(validateReview(r,media).reasons.includes('exact_render_review_missing'));});
test('contact sheet and partial listening cannot certify complete review',()=>{const r=valid();r.method='contact_sheet';r.full_audio_review=false;r.reviewed_intervals=[[0,3],[8,35.042]];assert.equal(validateReview(r,media).ready,false);});
test('unresolved timed finding blocks even forged zero counts',()=>{const r=valid();r.findings=[{start_sec:4,end_sec:5,severity:'major',category:'voice',evidence:'Observed repeated clipped pronunciation',repair:'Regenerate and independently listen',resolved:false}];const out=validateReview(r,media);assert.ok(out.reasons.includes('major_count_mismatch'));assert.ok(out.reasons.includes('unresolved_findings'));});
test('out-of-runtime findings and missing provenance reject',()=>{const r=valid();delete r.reviewer;r.findings=[{start_sec:34,end_sec:40,severity:'minor',category:'voice',evidence:'Observed late pronunciation defect',repair:'Repair then review exact new artifact',resolved:true}];assert.equal(validateReview(r,media).ready,false);});
test('comparison and publication restrictions remain enforced',()=>{const r=valid();r.comparisons=[];r.publication_enabled=true;assert.equal(validateReview(r,media).ready,false);});

import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectMedia,safeOutputPath,main} from '../scripts/exact_av_review.mjs';
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'exact-av-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const video=join(dir,'video.mp4'),review=join(dir,'review.json');writeFileSync(video,'original media');writeFileSync(review,'original review');return {dir,video,review};}
test('output equality and relative normalization cannot destroy media or review',t=>{const {dir,video,review}=fixture(t);assert.throws(()=>main(['prepare',video,join(dir,'.','video.mp4')]),/must not overwrite/);assert.throws(()=>main(['validate',video,review,review]),/must not overwrite/);assert.equal(readFileSync(video,'utf8'),'original media');assert.equal(readFileSync(review,'utf8'),'original review');});
test('symlink output, symlink parent and hardlink aliases reject',t=>{const {dir,video}=fixture(t);const link=join(dir,'alias.mp4');symlinkSync(video,link);assert.throws(()=>safeOutputPath(link,[video]),/symlink/);const parent=join(dir,'alias-dir');symlinkSync(dir,parent);assert.throws(()=>safeOutputPath(join(parent,'video.mp4'),[video]),/must not overwrite/);const hard=join(dir,'hard.mp4');linkSync(video,hard);assert.throws(()=>safeOutputPath(hard,[video]),/must not overwrite/);assert.equal(readFileSync(video,'utf8'),'original media');});
test('input symlinks also protect their real file',t=>{const {dir,video}=fixture(t);const input=join(dir,'input-link');symlinkSync(video,input);assert.throws(()=>safeOutputPath(video,[input]),/must not overwrite/);});
test('media mutation during ffprobe rejects stale hash binding',t=>{const {video}=fixture(t);const probe=()=>{writeFileSync(video,'modified media');return JSON.stringify({format:{duration:1},streams:[{codec_type:'video'},{codec_type:'audio'}]});};assert.throws(()=>inspectMedia(video,probe),/Media changed during probe/);});
test('unchanged media probe binds exact bytes',t=>{const {video}=fixture(t);const probe=()=>JSON.stringify({format:{duration:1},streams:[{codec_type:'video'},{codec_type:'audio'}]});assert.equal(inspectMedia(video,probe).duration_seconds,1);});

import {reviewSource} from '../scripts/exact_av_review.mjs';
const sourceRun=()=>({id:123,repository:{full_name:'wecreates/content-control'},head_repository:{full_name:'wecreates/content-control'},head_branch:'main',path:'.github/workflows/content-control-v2.yml',event:'workflow_dispatch',status:'completed',conclusion:'failure',head_sha:'a'.repeat(40)});
const sourceRequest={repository:'wecreates/content-control',runId:'123',format:'v2'};
test('V2 failed QA artifacts can be reviewed without approval or publication',()=>{const r=reviewSource(sourceRun(),sourceRequest);assert.equal(r.artifact,'content-control-v2-acceptance');assert.equal(r.media,'render/v2-boss-fight.mp4');assert.equal(r.production_approved,false);assert.equal(r.publication_enabled,false);});
test('short and long retain their exact existing artifact paths',()=>{for(const format of ['short','long']){const run=sourceRun();run.path='.github/workflows/production-execution.yml';run.conclusion='success';const r=reviewSource(run,{...sourceRequest,format});assert.equal(r.artifact,'production-state-'+format);assert.equal(r.media,'candidate.mp4');}});
test('foreign repository, fork, PR, other branch, workflow and incomplete runs rejected',()=>{
 const changes=[{repository:{full_name:'other/repo'}},{head_repository:{full_name:'fork/repo'}},{head_branch:'untrusted'},{path:'.github/workflows/other.yml'},{event:'pull_request'},{status:'in_progress'},{conclusion:'cancelled'},{head_sha:'bad'},{id:124}];
 for(const change of changes)assert.throws(()=>reviewSource({...sourceRun(),...change},sourceRequest),/Untrusted/);
});
test('format and run identifier cannot select arbitrary artifacts or inject paths',()=>{for(const format of ['../v2','constructor','unknown','short'])assert.throws(()=>reviewSource(sourceRun(),{...sourceRequest,format}));for(const runId of ['123\nmedia=evil','0','123/../../'])assert.throws(()=>reviewSource(sourceRun(),{...sourceRequest,runId}));});

test('verified retained repair is allowed only by pinned run and commit',()=>{
 const run={...sourceRun(),id:38574413400,head_branch:'codex/retained-caption-repair',path:'.github/workflows/repair-retained-captions.yml',event:'pull_request',conclusion:'success',head_sha:'dcb4775fe1891df8d8bcaab477bcb919e6771b50'};
 const request={...sourceRequest,runId:'38574413400',format:'short'};
 const out=reviewSource(run,request);
 assert.equal(out.artifact,'caption-repair-short');
 assert.equal(out.expected_sha256,'3cdb6a504fb72ee12cfe9fc451b68a16c1fb7adc978ae1f94836a540082e31fe');
 assert.equal(out.publication_enabled,false);
 assert.equal(reviewSource(run,{...request,format:'long'}).expected_sha256,'9ff0d9c74843f246307dabb82f19f61962369cf8aa2603c0b9bc1c0d803beeb1');
 for(const delta of [{head_sha:'a'.repeat(40)},{conclusion:'failure'},{head_repository:{full_name:'fork/repo'}},{event:'push'}])assert.throws(()=>reviewSource({...run,...delta},request));
 assert.throws(()=>reviewSource(run,{...request,format:'v2'}));
});

test('latest verified visual repairs reach review with exact hashes and no approval',()=>{
 const run={...sourceRun(),id:38583366384,head_branch:'fix/offline-av-recovery-review',path:'.github/workflows/retained-visual-repair.yml',event:'pull_request',conclusion:'success',head_sha:'b8f22d0be0cd0e2196a892eea07a904898dc43eb'};
 const request={...sourceRequest,runId:'38583366384',format:'short'};
 const hashes={short:'46a6989bc7a5f3e0c35c552d2a8c635d1c0fadf369c6252d1c66945b452ee17a',long:'41a479dda53d9b926b299e3769493b9082d450e71c4e1e65e12bf9732d649766'};
 for(const format of ['short','long']){
  const out=reviewSource(run,{...request,format});
  assert.equal(out.artifact,'visual-repair-'+format);
  assert.equal(out.expected_sha256,hashes[format]);
  assert.equal(out.media,'candidate.mp4');
  assert.equal(out.production_approved,false);
  assert.equal(out.publication_enabled,false);
 }
 for(const delta of [{id:38583366385},{head_sha:'a'.repeat(40)},{conclusion:'failure'},{status:'in_progress'},{repository:{full_name:'other/repo'}},{head_repository:{full_name:'fork/repo'}},{event:'push'},{path:'.github/workflows/other.yml'}])assert.throws(()=>reviewSource({...run,...delta},request));
 assert.throws(()=>reviewSource(run,{...request,format:'v2'}));
 assert.throws(()=>reviewSource(run,{...request,repository:'other/repo'}));
 assert.throws(()=>reviewSource({...run,id:38583366385},{...request,runId:'38583366385'}));
});
