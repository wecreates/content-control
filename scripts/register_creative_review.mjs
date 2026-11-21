/** Register one retained preview's exact inputs, not generic queue ingestion. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {lstat} from 'node:fs/promises';
import {resolve,dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectDecodedMedia,prepareReview} from './exact_av_review.mjs';
import {readReviewJson,createReviewArtifactVerifier} from '../review-artifacts.js';
import {registeredCreativeReview} from '../creative-review-registration.js';

export async function verifyOfflinePacket(directory,evidence,packets,candidateSha) {
 if(evidence?.candidate_sha256!==candidateSha||packets?.candidate_sha256!==candidateSha||
    [evidence,packets].some(x=>x.full_video_review!==false||x.full_audio_review!==false||
     x.publication_enabled!==false||x.production_approved!==false)||
    evidence.status!=='REVIEW_PENDING'||evidence.technical_decode!=='PASS'||
    !evidence.files||typeof evidence.files!=='object'||Array.isArray(evidence.files)||
    Object.keys(evidence.files).length<1||Object.keys(evidence.files).length>128||
    evidence.files['candidate.mp4']!==candidateSha||
    !Number.isSafeInteger(packets.sample_rate)||packets.sample_rate<=0||
    !Number.isSafeInteger(packets.audio_samples)||packets.audio_samples<=0||
    !Array.isArray(packets.packets)||packets.packets.length<1)throw Error('Invalid offline evidence');
 const verifier=createReviewArtifactVerifier(directory);let bytes=0;
 for(const [relative,expected] of Object.entries(evidence.files)) {
  if(!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*(?:\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)*$/.test(relative)||
     !/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid offline evidence path or digest');
  let current=resolve(directory),info;
  for(const part of relative.split('/')){current=join(current,part);info=await lstat(current);if(info.isSymbolicLink())throw Error('Offline evidence symlink');}
  // Successful ffmpeg decoding legitimately produces an empty diagnostic log.
  const emptyLog=relative.endsWith('.log')&&info.isFile()&&info.size===0;
  const actual=emptyLog?{size:0,sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}:await verifier.digest(relative,512*1024*1024);bytes+=actual.size;
  if(actual.sha256!==expected||bytes>512*1024*1024)throw Error('Offline evidence bytes changed');
 }
 const manifest=await verifier.digest('review-packets.json',512*1024);
 const snapshot=(await readReviewJson(directory,'review-packets.json')).value;
 if(manifest.sha256!==evidence.files['review-packets.json']||JSON.stringify(snapshot)!==JSON.stringify(packets))throw Error('Packet manifest changed');
 let end=0;const audio=new Set();
 for(const packet of packets.packets) {
  if(packet.status!=='NOT_REVIEWED'||packet.start_sample!==end||
     !Number.isSafeInteger(packet.end_sample_exclusive)||packet.end_sample_exclusive<=end||
     packet.end_sample_exclusive>packets.audio_samples||audio.has(packet.audio)||
     evidence.files[packet.audio]!==packet.audio_sha256||
     !Array.isArray(packet.frames)||packet.frames.some(f=>evidence.files[f.path]!==f.sha256))
   throw Error('Packet evidence mismatch or coverage gap');
  audio.add(packet.audio);end=packet.end_sample_exclusive;
 }
 if(end!==packets.audio_samples)throw Error('Incomplete packet audio coverage');
 return manifest.sha256;
}

export async function register({video,render,run,offline,sample,outputRoot}) {
 const read=async file=>(await readReviewJson(dirname(resolve(file)),basename(file))).value;
 const media=inspectDecodedMedia(resolve(video));
 const [renderReceipt,sourceRun,offlineReceipt,sampleReceipt,packets]=await Promise.all([
  read(render),read(run),read(join(offline,'evidence.json')),read(sample),read(join(offline,'review-packets.json'))]);
 const packetDigest=await verifyOfflinePacket(offline,offlineReceipt,packets,media.candidate_sha256);
 const record={schema_version:1,status:'REVIEW_PENDING',recorded_at:new Date().toISOString(),
  candidate_sha256:media.candidate_sha256,artifact_expires_at:'2026-12-05T00:25:49Z',source_run:sourceRun,render:renderReceipt,
  request:prepareReview(media),offline:offlineReceipt,sample:sampleReceipt,
  packet_manifest_sha256:packetDigest,
  audio_packet_count:packets.packets.length,publication_enabled:false,production_approved:false};
 registeredCreativeReview(record,media.candidate_sha256);
 // Exact-hash, create-only review metadata. No arbitrary output filename or update.
 const directory=join(resolve(outputRoot),'state/review-candidates');mkdirSync(directory,{recursive:true});
 const output=join(directory,media.candidate_sha256+'.json');
 writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 return {output,status:'REVIEW_PENDING',candidate_sha256:media.candidate_sha256,publication_enabled:false,production_approved:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const [video,render,run,offline,sample,outputRoot]=process.argv.slice(2);
 if(![video,render,run,offline,sample,outputRoot].every(Boolean))throw Error('Usage: register_creative_review.mjs VIDEO RENDER_JSON RUN_JSON OFFLINE_DIR SAMPLE_JSON OUTPUT_ROOT');
 console.log(JSON.stringify(await register({video,render,run,offline,sample,outputRoot})));
}
