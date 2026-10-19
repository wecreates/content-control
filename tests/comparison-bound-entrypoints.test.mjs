// All media and all observation prose here are SYNTHETIC, never real creative acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {execFileSync,spawnSync} from 'node:child_process';
import {inspectMedia,validateBoundHandoff} from '../scripts/exact_av_review.mjs';
import {creativeHandoff,CREATIVE_CHECKS} from '../creative-handoff.js';
import {syntheticSessions} from './comparison-fixtures.mjs';
import {createHostedComparisonGate} from '../scripts/hosted_comparison_receipt.mjs';
import {exerciseHostedHttp} from './comparison-http-fixture.mjs';

test('actual hosted acceptance and scorer CLI require bytes, sessions, coverage AND separate observations',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-bound-entrypoints-'));
 try{
 const files=Array.from({length:8},(_,i)=>{
  const file=join(dir,`SYNTHETIC-${i}.mp4`);
  execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=red:size=64x64:rate=10','-f','lavfi','-i',`sine=frequency=${440+i*100}:sample_rate=48000`,'-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file],{timeout:30000});
  return {file,media:inspectMedia(file)};
 });
 const m=files[0].media,manifest=join(dir,'manifest.json'),sessionPath=join(dir,'sessions.json');
 const candidatePath=join(dir,'candidate.json'),out=join(dir,'score.json');
 const semantics={source_av_access:{visual:true,audio:true,complete_end_to_end:true},
  video_observation:'SYNTHETIC visual test description',audio_observation:'SYNTHETIC audio test description',
  opening:{first_3_seconds:'SYNTHETIC physical conflict opens immediately',first_15_seconds:'SYNTHETIC physical conflict establishes clear stakes and an entertainment promise.'},
  motion_language:{meaningful_visual_change_est_sec:1.8},
  story_and_retention:{why_it_does_not_feel_like_a_lecture:'SYNTHETIC action carries explanation through physical consequences and escalating comic conflict.',retention_resets:[1,2,3],callbacks:[1,2],ending_payoff:'SYNTHETIC final callback closes the opening conflict with a physical reversal.'},
  humor:{mechanisms:['visual','callback','deadpan']},sound:{sfx_density:'SYNTHETIC dense',sfx_sync:'SYNTHETIC contact'},
  credit_card_adaptations:['fees','APR','points'],distinctive_elements_not_to_copy:['SYNTHETIC creator characters'],slideshow_detected:false,lecture_detected:false};
 const review={...semantics,candidate_sha256:m.candidate_sha256,artifact_sha256:m.candidate_sha256,duration_seconds:m.duration_seconds,
  status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,publication_enabled:false,
  reviewed_intervals:[[0,m.duration_seconds]],reviewer:{identity:'SYNTHETIC reviewer identity',method:'SYNTHETIC fixture methodology',evidence:'SYNTHETIC schema fixture only'},
  checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'SYNTHETIC observation for '+k}])),
  findings:[],critical_count:0,major_count:0,unresolved_issues:[],
  comparisons:files.slice(1).map(({media},i)=>({...semantics,url:`https://instagram.com/reel/SYNTHETIC_${i}/`,source_url:`https://instagram.com/reel/SYNTHETIC_${i}/`,creator:`SYNTHETIC_${i%5}`,
   artifact_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,reviewed_intervals:[[0,media.duration_seconds]],
   full_video_review:true,full_audio_review:true,access_scope:'full audiovisual review',observation:'SYNTHETIC reference difference',applied_difference:'SYNTHETIC application of difference'}))};
 const sessions=syntheticSessions(files,review),baseline=structuredClone(sessions),originalReview=structuredClone(review);
 const mappings=files.slice(1).map(({file},i)=>({url:review.comparisons[i].url,path:file}));
 writeFileSync(manifest,JSON.stringify(mappings));
 const healthPath=join(dir,'health.json'),runtimePath=join(dir,'runtime.json');
 writeFileSync(runtimePath,JSON.stringify({status:'READY',candidate_sha256:m.candidate_sha256}));
 const source=readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
 const body=source.match(/function v2Acceptance\(\)\s*\{[\s\S]*?\n\}/)[0];
 assert.match(body,/hostedComparisonGate/);
 const receiptPath=join(dir,'bound-receipt.json'),gate=createHostedComparisonGate();
 const validate=()=>{const result=validateBoundHandoff(review,files[0].file,manifest,sessionPath);writeFileSync(receiptPath,JSON.stringify(result));return result;};
 const hosted=()=>{
  writeFileSync(healthPath,JSON.stringify({status:'READY',publication_enabled:false,creative_qa:true,technical_qa:true,visual_parity_qa:true,candidate_sha256:m.candidate_sha256,media_evidence:m,creative_review:review,comparison_evidence:{receipt_path:receiptPath}}));
  return vm.runInNewContext(body+'\nv2Acceptance()',{
   readJson:p=>JSON.parse(readFileSync(p)),fileHash:p=>createHash('sha256').update(readFileSync(p)).digest('hex'),
   v2HealthPath:healthPath,v2Output:files[0].file,path:{resolve:()=>runtimePath},creativeHandoff,hostedComparisonGate:gate});
 };
 const scorer=(omitBinding=false)=>{
  writeFileSync(candidatePath,JSON.stringify(review));
  const paths=review.comparisons.map((r,i)=>{const p=join(dir,`reference-${i}.json`);writeFileSync(p,JSON.stringify(r));return p;});
  const run=spawnSync('python',['scripts/creator_parity_compare.py','--candidate',candidatePath,...paths.flatMap(p=>['--competitor',p]),...(omitBinding?[]:['--candidate-media',files[0].file,'--references-manifest',manifest,'--sessions',sessionPath]),'--out',out],{encoding:'utf8',timeout:60000});
  assert.ifError(run.error);return {run,result:JSON.parse(readFileSync(out))};
 };
 const save=()=>writeFileSync(sessionPath,JSON.stringify(sessions));save();
 assert.equal(validate().ready,true);
 assert.equal(hosted().ready,false,'Cold admission must fail closed');await gate.settled();
 assert.equal(hosted().ready,true);
 await exerciseHostedHttp({source,healthPath,runtimePath,video:files[0].file,receiptPath,review,reference:files[1].file});
 // The HTTP invalidation regression restores reference bytes, so regenerate its receipt.
 assert.equal(validate().ready,true);hosted();await gate.settled();assert.equal(hosted().ready,true);
 const good=scorer();assert.equal(good.run.status,0,good.run.stderr);assert.equal(good.result.status,'PASS');
 assert.equal(good.result.binding.imported_sessions.length,8);assert.equal(good.result.perception_verified,false);assert.equal(good.result.production_approved,false);assert.equal(good.result.publication_enabled,false);
 assert.equal(scorer(true).result.approval_allowed,false,'Missing CLI binding arguments must reject');
 const failures=[
  ['missing sessions',()=>sessions.splice(0)],
  ['stale candidate bytes claim',()=>{review.candidate_sha256='f'.repeat(64);review.artifact_sha256='f'.repeat(64);}],
  ['session identity reused across media',()=>sessions[1].playback_sessions.reference.session_id=sessions[0].playback_sessions.reference.session_id],
  ['stale session ID',()=>review.comparisons[0].review_session_id='f'.repeat(32)],
  ['session bytes mismatch',()=>sessions[0].playback_sessions.reference.artifact_sha256='f'.repeat(64)],
  ['partial visual playback',()=>sessions[0].playback_sessions.reference.video_playback_intervals=[[0,.1]]],
  ['muted reference',()=>sessions[0].playback_sessions.reference.unmuted_playback_intervals=[]],
  ['partial observed coverage',()=>review.comparisons[0].reviewed_intervals=[[0,.1]]],
  ['missing independent audio observation',()=>review.comparisons[0].audio_observation=''],
  ['candidate not actually reviewed',()=>{review.full_audio_review=false;review.source_av_access.audio=false;}],
 ];
 for(const [label,mutate] of failures){
  sessions.splice(0,sessions.length,...structuredClone(baseline));Object.assign(review,structuredClone(originalReview));mutate();save();
  assert.equal(hosted().ready,false,label);
  const bad=scorer();assert.equal(bad.run.status,2,label+bad.run.stderr);assert.equal(bad.result.approval_allowed,false,label);assert.equal(bad.result.publication_enabled,false);
 }
 sessions.splice(0,sessions.length,...structuredClone(baseline));Object.assign(review,structuredClone(originalReview));save();
 // Change actual reference bytes while reports and session identities remain stale.
 const original=readFileSync(files[1].file);writeFileSync(files[1].file,readFileSync(files[2].file));
 assert.equal(hosted().ready,false);assert.equal(scorer().result.approval_allowed,false);writeFileSync(files[1].file,original);
 // Missing local footage cannot be rescued by full-review assertions.
 writeFileSync(manifest,JSON.stringify([{...mappings[0],path:join(dir,'absent.mp4')},...mappings.slice(1)]));
 assert.equal(hosted().ready,false);assert.equal(scorer().result.approval_allowed,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
