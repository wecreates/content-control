import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {registeredCreativeReview} from '../creative-review-registration.js';
import {createProductionStatusRouter} from '../production-status.js';
import {createHash} from 'node:crypto';
import {verifyOfflinePacket} from '../scripts/register_creative_review.mjs';
const digest='56deda2a2b4c7ba6a590983693a4e6b85afe50e38520141c0b05f8d3f49e597e';
const original=JSON.parse(await fs.readFile(new URL(`../state/review-candidates/${digest}.json`,import.meta.url)));
const record=()=>structuredClone(original);
test('exact new candidate registration is metadata and sampled evidence, never playback or approval',()=>{
 const r=registeredCreativeReview(record(),digest);
 assert.equal(r.status,'REVIEW_PENDING');assert.equal(r.candidate_sha256,digest);
 assert.equal(r.sampled_frame_review.frame_numbers.length,10);assert.equal(r.review_packet.audio_packet_count,4);
 assert.equal(r.artifact_availability,'NOT_LIVE_VERIFIED');assert.equal(r.artifact_bytes_available_here,false);
 for(const key of ['full_av_review','full_video_review','full_audio_review','production_approved','publication_enabled'])assert.equal(r[key],false);
 assert.equal(r.watch_url,null);assert.equal(r.media_url,null);
});

test('failed provider attempt is exposed as scoped diagnostics without identifiers or approval',()=>{
 const input=record();input.provider_diagnostic.event_id='private-event';input.provider_diagnostic.signed_url='https://private.invalid';
 const r=registeredCreativeReview(input,digest),d=r.provider_diagnostic;
 assert.equal(r.status,'REVIEW_PENDING');assert.equal(d.status,'REMOTE_EVENT_ERROR');
 assert.equal(d.remote_execution_status,'UNKNOWN');assert.equal(d.result_error_code,'EVENT_RESULT_NOT_FOUND');assert.equal(d.response_received,false);
 assert.equal(d.full_av_review,false);assert.equal(d.candidate_sha256,digest);
 assert.equal(d.decoded_audio_sha256,input.offline.files['final-mix.wav']);
 assert.deepEqual(d.uploaded_modalities,['video','audio']);
 assert.deepEqual(d.audio_only_control.uploaded_modalities,['audio']);
 assert.equal(d.audio_only_control.result_error_code,'EVENT_ERROR_WITHOUT_DETAILS');
 assert.equal(d.audio_only_control.response_received,false);
 assert.equal(d.event_id,undefined);assert.equal(d.signed_url,undefined);
 const previous=record();delete previous.provider_diagnostic;assert.equal(registeredCreativeReview(previous,digest).provider_diagnostic,null);
});
test('audio-only control cannot inherit other media, claim review or leak capability identifiers',()=>{
 for(const change of [d=>d.candidate_sha256='a'.repeat(64),d=>d.decoded_audio_sha256='a'.repeat(64),
  d=>d.source_application_sha256='a'.repeat(64),d=>d.source_receipt_sha256='bad',
  d=>d.response_received=true,d=>d.full_av_review=true,d=>d.production_approved=true,
  d=>d.publication_enabled=true,d=>d.remote_execution_status='STOPPED',d=>d.status='PASS',
  d=>d.uploaded_modalities=['audio','video'],d=>d.finished_at='invalid']) {
  const r=record();change(r.provider_diagnostic.audio_only_control);
  assert.throws(()=>registeredCreativeReview(r,digest),/PROVIDER_CONTROL_DIAGNOSTIC_INVALID/);
 }
 const r=record();r.provider_diagnostic.audio_only_control.event_id='private';
 assert.equal(registeredCreativeReview(r,digest).provider_diagnostic.audio_only_control.event_id,undefined);
});
test('provider diagnostic stale identity, wrong audio, success claims and approval flags fail closed',()=>{
 for(const change of [d=>d.candidate_sha256='f'.repeat(64),d=>d.decoded_audio_sha256='f'.repeat(64),
  d=>d.source_receipt_sha256='bad',d=>d.source_application_sha256='bad',d=>d.status='PASS',
  d=>d.result_error_code='NONE',d=>d.remote_execution_status='STOPPED',d=>d.response_received=true,d=>d.full_av_review=true,
  d=>d.production_approved=true,d=>d.publication_enabled=true,d=>d.finished_at='invalid',
  d=>d.finished_at='2020-01-01T00:00:00Z',d=>d.uploaded_modalities=['video']]) {
  const r=record();change(r.provider_diagnostic);assert.throws(()=>registeredCreativeReview(r,digest),/PROVIDER_DIAGNOSTIC_INVALID/);
 }
});

test('packet registration verifies original bytes, unreviewed coverage, paths and source identity',async()=>{
 const hash=x=>createHash('sha256').update(x).digest('hex');
 for(const change of ['none','audio','candidate','gap','reviewed','path','symlink','stale']) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'review-packet-binding-'));
  try {
   await fs.mkdir(path.join(root,'packets'));const candidate='synthetic video',audio='synthetic audio';
   const candidateSha=hash(candidate),audioSha=hash(audio);
   const flags={full_audio_review:false,full_video_review:false,publication_enabled:false,production_approved:false};
   const packets={...flags,candidate_sha256:candidateSha,sample_rate:100,audio_samples:100,
    packets:[{audio:'packets/0000.wav',audio_sha256:audioSha,start_sample:0,end_sample_exclusive:100,frames:[],status:'NOT_REVIEWED'}]};
   if(change==='gap')packets.packets[0].start_sample=1;
   if(change==='reviewed')packets.packets[0].status='PASS';
   if(change==='stale')packets.candidate_sha256='f'.repeat(64);
   const manifest=JSON.stringify(packets);
   const evidence={...flags,candidate_sha256:candidateSha,status:'REVIEW_PENDING',technical_decode:'PASS',
    files:{'candidate.mp4':candidateSha,'packets/0000.wav':audioSha,'review-packets.json':hash(manifest),'decode.log':hash('')}};
   await fs.writeFile(path.join(root,'decode.log'),'');
   await fs.writeFile(path.join(root,'candidate.mp4'),change==='candidate'?'changed':candidate);
   await fs.writeFile(path.join(root,'packets/0000.wav'),change==='audio'?'changed':audio);
   await fs.writeFile(path.join(root,'review-packets.json'),manifest);
   if(change==='path')evidence.files['../escape']=hash('x');
   if(change==='symlink'){await fs.rename(path.join(root,'packets/0000.wav'),path.join(root,'audio'));await fs.symlink('../audio',path.join(root,'packets/0000.wav'));}
   const check=()=>verifyOfflinePacket(root,evidence,packets,candidateSha);
   if(change==='none')assert.equal(await check(),hash(manifest));else await assert.rejects(check(),change);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 }
});
test('prior-candidate evidence, altered provenance, approval claims and invalid durations reject',()=>{
 const changes=[r=>r.candidate_sha256='f'.repeat(64),r=>r.render.candidate_sha256='f'.repeat(64),
  r=>r.sample.candidate_sha256='f'.repeat(64),r=>r.offline.candidate_sha256='f'.repeat(64),
  r=>r.request.media.candidate_sha256='f'.repeat(64),r=>r.source_run.head_sha='a'.repeat(40),
  r=>r.source_run.head_repository.full_name='fork/repo',r=>r.source_run.conclusion='failure',
  r=>r.production_approved=true,r=>r.render.publication_enabled=true,r=>r.sample.production_approved=true,
  r=>r.offline.full_audio_review=true,r=>r.render.full_decode_passed=false,r=>r.sample.status='PASS',
  r=>r.request.media.duration_seconds=null,r=>r.render.video_duration_seconds=null,r=>r.render.video_frames=840,
  r=>r.artifact_expires_at='2099-01-01T00:00:00Z'];
 for(const change of changes){const r=record();change(r);assert.throws(()=>registeredCreativeReview(r,digest));}
 assert.throws(()=>registeredCreativeReview(record(),'f'.repeat(64)));
});
test('expired artifact metadata never offers a working artifact URL',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-12-06T00:00:00Z'));
 const r=registeredCreativeReview(record(),digest);assert.equal(r.status,'REVIEW_PENDING_ARTIFACT_EXPIRED');
 assert.equal(r.artifact_expired,true);assert.equal(r.artifact_url,null);assert.equal(r.watch_url,null);
});
test('HTTP status is exact-hash only; missing, invalid and stale records fail closed',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'creative-registration-'));
 const directory=path.join(root,'state/review-candidates');await fs.mkdir(directory,{recursive:true});
 const file=path.join(directory,digest+'.json');await fs.writeFile(file,JSON.stringify(record()));
 const app=express();app.use('/api/production',createProductionStatusRouter({root}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api/production/review-candidates/`;
 try{
  let response=await fetch(base+digest);assert.equal(response.status,200);assert.equal((await response.json()).candidate_sha256,digest);
  assert.equal((await fetch(base+'bad')).status,400);assert.equal((await fetch(base+'f'.repeat(64))).status,404);
  const changed=record();changed.sample.candidate_sha256='f'.repeat(64);await fs.writeFile(file,JSON.stringify(changed));
  response=await fetch(base+digest);assert.equal(response.status,503);assert.equal((await response.json()).production_approved,false);
 }finally{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
});
