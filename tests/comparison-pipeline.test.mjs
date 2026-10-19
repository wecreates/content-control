// SYNTHETIC transport/contract evidence only. Never real-media creative acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {inspectMedia,prepareReview} from '../scripts/exact_av_review.mjs';
import {CREATIVE_CHECKS} from '../creative-handoff.js';

test('SYNTHETIC audiovisual files -> exact identities -> prepared contract -> CLI validation',t=>{
 const dir=mkdtempSync(join(tmpdir(),'synthetic-comparison-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const files=[0,1,2].map(i=>{
  const file=join(dir,`SYNTHETIC-${i}.mp4`);
  execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i',`color=c=${['red','green','blue'][i]}:size=64x64:rate=10`,'-f','lavfi','-i',`sine=frequency=${440+i*110}:sample_rate=48000`,'-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file],{timeout:30000});
  execFileSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-'],{timeout:30000});
  return {file,media:inspectMedia(file)};
 });
 const candidate=files[0].media;
 const prepared=prepareReview(candidate);
 assert.equal(prepared.production_approved,false);
 assert.ok(prepared.response_schema.comparisons[0].audio_observation);
 // The following prose and claimed observation intervals are synthetic test data.
 const review={candidate_sha256:candidate.candidate_sha256,duration_seconds:candidate.duration_seconds,
  status:'PASS',method:'rendered_video_review',full_video_review:true,full_audio_review:true,
  reviewed_intervals:[[0,candidate.duration_seconds]],publication_enabled:false,
  reviewer:{identity:'SYNTHETIC test reviewer',method:'SYNTHETIC contract fixture only',evidence:'SYNTHETIC fixture; no human review performed'},
  checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:true,evidence:'SYNTHETIC test observation for '+k}])),
  comparisons:files.slice(1).map(({media},i)=>({url:`https://youtube.com/watch?v=${['abcdefghijk','lmnopqrstuv'][i]}`,
   artifact_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,reviewed_intervals:[[0,media.duration_seconds]],
   full_video_review:true,full_audio_review:true,access_scope:'full audiovisual review',
   video_observation:'SYNTHETIC colored fixture',audio_observation:'SYNTHETIC sine tone fixture',
   observation:'SYNTHETIC comparison observation',applied_difference:'SYNTHETIC different color and pitch'})),
  findings:[],critical_count:0,major_count:0,unresolved_issues:[]};
 const input=join(dir,'SYNTHETIC-review.json'),output=join(dir,'receipt.json');
 const run=()=>{
  writeFileSync(input,JSON.stringify(review));
  const result=spawnSync(process.execPath,['scripts/exact_av_review.mjs','validate',files[0].file,output,input],{encoding:'utf8',timeout:30000});
  assert.ifError(result.error);
  const receipt=JSON.parse(readFileSync(output));
  assert.equal(receipt.publication_enabled,false);assert.equal(receipt.production_approved,false);
  return {result,receipt};
 };
 const valid=run();assert.equal(valid.result.status,0,valid.result.stderr);assert.equal(valid.receipt.status,'VALIDATED_REVIEW');
 // Local bound mode recomputes reference bytes rather than trusting declarations.
 const mapping=join(dir,'references.json');
 const mappings=files.slice(1).map(({file},i)=>({url:review.comparisons[i].url,path:file}));
 writeFileSync(mapping,JSON.stringify(mappings));
 const bound=()=>{
  writeFileSync(input,JSON.stringify(review));
  const result=spawnSync(process.execPath,['scripts/exact_av_review.mjs','validate-bound',files[0].file,output,input,mapping],{encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return {result,receipt:JSON.parse(readFileSync(output))};
 };
 const boundValid=bound();assert.equal(boundValid.result.status,0,boundValid.result.stderr);
 assert.equal(boundValid.receipt.status,'VALIDATED_BOUND_REVIEW');assert.equal(boundValid.receipt.reference_bytes_verified,true);
 assert.equal(boundValid.receipt.perception_verified,false);assert.equal(boundValid.receipt.production_approved,false);
 const original=review.comparisons[0].artifact_sha256;
 review.comparisons[0].artifact_sha256='f'.repeat(64);
 assert.equal(bound().receipt.status,'BLOCKED');review.comparisons[0].artifact_sha256=original;
 // Claimed short coverage cannot exploit the duration roundoff allowance.
 const duration=review.comparisons[0].duration_seconds;
 review.comparisons[0].duration_seconds=duration-.01;review.comparisons[0].reviewed_intervals=[[0,duration-.01]];
 assert.equal(bound().receipt.status,'BLOCKED');
 review.comparisons[0].duration_seconds=duration;review.comparisons[0].reviewed_intervals=[[0,duration]];
 writeFileSync(mapping,JSON.stringify([{...mappings[0],path:files[2].file},mappings[1]]));
 assert.equal(bound().receipt.status,'BLOCKED');
 writeFileSync(mapping,JSON.stringify([{...mappings[0],path:join(dir,'missing.mp4')},mappings[1]]));
 const missing=bound();assert.equal(missing.result.status,2);assert.equal(missing.receipt.status,'BLOCKED');
 writeFileSync(mapping,'{invalid');assert.equal(bound().receipt.status,'BLOCKED');
 const silent=join(dir,'SYNTHETIC-no-audio.mp4');
 execFileSync('ffmpeg',['-nostdin','-v','error','-i',files[1].file,'-an','-c:v','copy',silent],{timeout:30000});
 writeFileSync(mapping,JSON.stringify([{...mappings[0],path:silent},mappings[1]]));
 const silentResult=bound();assert.equal(silentResult.result.status,2);assert.equal(silentResult.receipt.status,'BLOCKED');

 writeFileSync(mapping,JSON.stringify(mappings));
 const referenceBefore=readFileSync(files[1].file);
 const alias=spawnSync(process.execPath,['scripts/exact_av_review.mjs','validate-bound',files[0].file,files[1].file,input,mapping],{encoding:'utf8',timeout:30000});
 assert.equal(alias.status,2);assert.deepEqual(readFileSync(files[1].file),referenceBefore);

 review.comparisons[0].reviewed_intervals=[[0,.1]];
 const partial=run();assert.equal(partial.result.status,2);assert.equal(partial.receipt.status,'BLOCKED');
 assert.ok(partial.receipt.reasons.includes('competitor_comparison_pending'));
 review.comparisons=[];
 assert.equal(run().receipt.status,'BLOCKED');
});
