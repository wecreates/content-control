/** Local exact-media review preparation and validation. Never calls an inference provider. */
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readSync,writeFileSync,mkdirSync,realpathSync,lstatSync,statSync,mkdtempSync,renameSync,rmSync} from 'node:fs';
import {dirname,resolve,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {creativeHandoff,CREATIVE_CHECKS} from '../creative-handoff.js';

const RETAINED_REPAIRS = {
 '38574413400': {sha:'dcb4775fe1891df8d8bcaab477bcb919e6771b50',workflow:'.github/workflows/repair-retained-captions.yml',prefix:'caption-repair',
 short:'3cdb6a504fb72ee12cfe9fc451b68a16c1fb7adc978ae1f94836a540082e31fe',long:'9ff0d9c74843f246307dabb82f19f61962369cf8aa2603c0b9bc1c0d803beeb1'},
 '38583366384': {sha:'b8f22d0be0cd0e2196a892eea07a904898dc43eb',workflow:'.github/workflows/retained-visual-repair.yml',prefix:'visual-repair',
 short:'46a6989bc7a5f3e0c35c552d2a8c635d1c0fadf369c6252d1c66945b452ee17a',long:'41a479dda53d9b926b299e3769493b9082d450e71c4e1e65e12bf9732d649766'},
};
const MAX_MEDIA_BYTES=512*1024*1024;
const MAX_REVIEW_BYTES=512*1024;
const fileIdentity=stat=>[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':');
function readRegularInput(path,maxBytes,consume) {
 // Follow existing ordinary-file symlinks, but never block opening a FIFO.
 // The opened descriptor, not a racy pre-open path stat, determines file type.
 const fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK);
 try {
  const before=fstatSync(fd,{bigint:true});
  if(!before.isFile())throw Error('Input must be a regular file');
  if(before.size<=0n||before.size>BigInt(maxBytes))throw Error('Input size is outside the allowed limit');
  const identity=fileIdentity(before),buffer=Buffer.allocUnsafe(64*1024);
  let size=0,n;
  while((n=readSync(fd,buffer,0,Math.min(buffer.length,maxBytes-size+1),null))>0) {
   size+=n;if(size>maxBytes)throw Error('Input size is outside the allowed limit');
   consume(buffer.subarray(0,n));
  }
  if(size!==Number(before.size)||fileIdentity(fstatSync(fd,{bigint:true}))!==identity||fileIdentity(statSync(path,{bigint:true}))!==identity)throw Error('Input changed during read');
  return {byte_length:size,identity};
 } finally {closeSync(fd);}
}
function mediaDigest(path) {
 const hash=createHash('sha256');
 const metadata=readRegularInput(path,MAX_MEDIA_BYTES,chunk=>hash.update(chunk));
 return {...metadata,sha256:hash.digest('hex')};
}
function readReview(path) {
 const chunks=[];
 readRegularInput(path,MAX_REVIEW_BYTES,chunk=>chunks.push(Buffer.from(chunk)));
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function reviewSource(run, {repository, runId, format}) {
 // This completed, independently recovered repair predates the main-branch workflow.
 // Pin its run, commit and media bytes; do not generally trust PR artifacts.
 const retained=Object.hasOwn(RETAINED_REPAIRS,String(runId))?RETAINED_REPAIRS[String(runId)]:null;
 if(retained){
  if(!['short','long'].includes(format)||run?.id!==Number(runId)||run.repository?.full_name!==repository||repository!=='wecreates/content-control'||run.head_repository?.full_name!==repository||run.head_sha!==retained.sha||run.path!==retained.workflow||run.event!=='pull_request'||run.status!=='completed'||run.conclusion!=='success')throw Error('Untrusted retained repair source');
  return {workflow:run.path,artifact:`${retained.prefix}-${format}`,media:'candidate.mp4',expected_sha256:retained[format],run_id:String(runId),source_sha:run.head_sha,conclusion:run.conclusion,publication_enabled:false,production_approved:false};
 }
 const sources = {
  short: {workflow:'.github/workflows/production-execution.yml',artifact:'production-state-short',media:'candidate.mp4'},
  long: {workflow:'.github/workflows/production-execution.yml',artifact:'production-state-long',media:'candidate.mp4'},
  v2: {workflow:'.github/workflows/content-control-v2.yml',artifact:'content-control-v2-acceptance',media:'render/v2-boss-fight.mp4'},
 };
 const source=Object.hasOwn(sources,format)?sources[format]:null;
 if(!source || !/^[1-9][0-9]*$/.test(String(runId)) || !/^[^/]+\/[^/]+$/.test(repository||''))throw Error('Invalid review source request');
 if(!run || String(run.id)!==String(runId) || run.repository?.full_name!==repository || run.head_repository?.full_name!==repository || run.head_branch!=='main' || run.path!==source.workflow || !['push','workflow_dispatch'].includes(run.event) || run.status!=='completed' || !['success','failure'].includes(run.conclusion) || !/^[a-f0-9]{40}$/.test(run.head_sha||''))throw Error('Untrusted or incomplete review source run');
 // Failed creative QA is a valid source for repair review, never evidence of acceptance.
 return {...source,run_id:String(runId),source_sha:run.head_sha,conclusion:run.conclusion,publication_enabled:false,production_approved:false};
}
export function inspectMedia(path,probe=execFileSync) {
 const before=mediaDigest(path);
 const data=JSON.parse(probe('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8',timeout:30_000,killSignal:'SIGKILL'}));
 const after=mediaDigest(path);
 if(after.sha256!==before.sha256||after.identity!==before.identity)throw Error('Media changed during probe');
 const duration=Number(data.format?.duration);
 if(!Number.isFinite(duration)||duration<=0||!data.streams?.some(s=>s.codec_type==='video')||!data.streams?.some(s=>s.codec_type==='audio'))throw Error('A positive-duration video with audio is required');
 return {verified:true,candidate_sha256:before.sha256,duration_seconds:duration,byte_length:before.byte_length};
}
export function prepareReview(media) {
 return {schema_version:1,status:'REVIEW_REQUIRED',publication_enabled:false,production_approved:false,media,
  scope:'Preparation only. No external upload, inference, creative approval, or listening certification performed.',
  prompt:`Review the exact supplied video AND audio end to end (${media.duration_seconds} seconds; SHA256 ${media.candidate_sha256}). Do not infer review from a script, contact sheet, transcript, or technical metrics. If any portion is inaccessible, report BLOCKED and describe the gap. Inspect hook, story escalation, visual storytelling, character consistency, voice performance, sound mix, pacing, phone readability, payoff and factual accuracy. Record time-located defects and full reviewed intervals. Independently review at least two distinct competitor videos with audio before claiming comparison. For each reference, record its exact SHA256, positive duration, continuous reviewed intervals covering the full duration, and separate concrete video and audio observations. Sampled frames, transcripts, metadata and inaccessible sources cannot satisfy this contract. Return JSON in this schema; only return PASS when actual complete review supports every check and there are no unresolved issues. Never invent evidence, reference access or listening.`,
  response_schema:{candidate_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,status:'PASS | REPAIR | BLOCKED',method:'rendered_video_review',full_video_review:'boolean',full_audio_review:'boolean',reviewer:{identity:'reviewer identifier',method:'actual audiovisual inspection method',evidence:'traceable review session or response identifier'},reviewed_intervals:'[[start,end], ...]',checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:'boolean',evidence:'concrete observed evidence'}])),comparisons:[{url:'https://...',artifact_sha256:'SHA256 of exact reviewed reference bytes',duration_seconds:'positive number',reviewed_intervals:'[[start,end], ...] covering entire reference',video_observation:'specific observed visual action',audio_observation:'specific heard audio evidence',full_video_review:'boolean',full_audio_review:'boolean',access_scope:'full audiovisual review',observation:'specific observed evidence',applied_difference:'specific difference'}],findings:[{start_sec:'number',end_sec:'number',severity:'critical | major | minor',category:'string',evidence:'observed defect',repair:'required change',resolved:'boolean'}],critical_count:'integer',major_count:'integer',unresolved_issues:'array',publication_enabled:false}};
}
export function validateReview(review,media) {
 const {reasons}=creativeHandoff(review,media.candidate_sha256,media);
 return {schema_version:1,status:reasons.length?'BLOCKED':'VALIDATED_REVIEW',ready:reasons.length===0,reasons:[...new Set(reasons)],candidate_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,publication_enabled:false,production_approved:false,scope:'Validates submitted evidence structure and the existing creative handoff gate; does not itself observe audiovisual content or authenticate reviewer claims.'};
}
export function inspectDecodedMedia(path,run=execFileSync) {
 const before=inspectMedia(path,run);
 run('ffmpeg',['-nostdin','-v','error','-xerror','-err_detect','explode','-i',path,'-map','0:v:0','-map','0:a:0','-f','null','-'],{encoding:'utf8',timeout:180_000,killSignal:'SIGKILL'});
 const after=inspectMedia(path,run);
 if(before.candidate_sha256!==after.candidate_sha256||before.duration_seconds!==after.duration_seconds)throw Error('Media changed during decode');
 return {...after,technical_decode:'PASS'};
}
function referenceInputs(manifestPath) {
 const rows=readReview(manifestPath);
 if(!Array.isArray(rows)||rows.length<2||rows.length>20||rows.some(r=>!r||typeof r.url!=='string'||!r.url.trim()||typeof r.path!=='string'||!r.path.trim())||new Set(rows.map(r=>r.url)).size!==rows.length)throw Error('Reference manifest must contain 2..20 distinct URL/local-path mappings');
 return rows.map(r=>({url:r.url,path:resolve(dirname(resolve(manifestPath)),r.path)}));
}
function boundReview(review,media,references,run) {
 const result=validateReview(review,media),reasons=[...result.reasons];
 const comparisons=review?.comparisons;
 if(!Array.isArray(comparisons)||comparisons.length!==references.length||new Set(comparisons.map(r=>r?.url)).size!==comparisons.length)reasons.push('reference_mapping_mismatch');
 const measured=references.map(r=>({...inspectDecodedMedia(r.path,run),url:r.url}));
 for(const ref of measured) {
  const claims=Array.isArray(comparisons)?comparisons.filter(r=>r?.url===ref.url):[];
  if(claims.length!==1||claims[0].artifact_sha256!==ref.candidate_sha256||!Number.isFinite(claims[0].duration_seconds)||Math.abs(claims[0].duration_seconds-ref.duration_seconds)>.05)reasons.push('reference_bytes_or_duration_mismatch');
 }
 if(Array.isArray(comparisons))reasons.push(...validateReview({...review,comparisons:comparisons.map(claim=>{
  const actual=measured.find(r=>r.url===claim?.url);
  return actual?{...claim,duration_seconds:actual.duration_seconds}:claim;
 })},media).reasons);
 return {...result,status:reasons.length?'BLOCKED':'VALIDATED_BOUND_REVIEW',ready:reasons.length===0,reasons:[...new Set(reasons)],
  reference_media:measured.map(r=>({url:r.url,artifact_sha256:r.candidate_sha256,duration_seconds:r.duration_seconds,byte_length:r.byte_length,technical_decode:r.technical_decode})),
  reference_bytes_verified:!reasons.length,perception_verified:false,
  scope:'Local candidate/reference hashes, durations and full-stream decode checked against submitted claims. Does not authenticate source URLs, playback logs, listening, visual perception or creative judgments.'};
}
function inputIdentity(input) {
 let current=resolve(input);const missing=[];
 for(;;) {
  try{return join(realpathSync(current),...missing);}
  catch(error) {
   if(error.code!=='ENOENT')throw error;
   // A dangling symlink is not a missing lexical path: its target identity is
   // unknown here, so reject rather than risk creating a receipt at that target.
   try {if(lstatSync(current).isSymbolicLink())throw Error('Unresolvable input symlink');}
   catch(statError) {if(statError.code!=='ENOENT')throw statError;}
   missing.unshift(basename(current));
   const parent=dirname(current);if(parent===current)throw error;current=parent;
  }
 }
}
export function safeOutputPath(output,inputs) {
 const absolute=resolve(output);
 // Missing inputs must still invalidate an old receipt. Existing inputs retain
 // canonical-path and inode protection, and are checked again before each write.
 const inputPaths=inputs.map(inputIdentity);
 mkdirSync(dirname(absolute),{recursive:true});
 const canonical=join(realpathSync(dirname(absolute)),basename(absolute));
 let info;
 try{info=lstatSync(canonical);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(info?.isSymbolicLink())throw Error('Output must not be a symlink');
 if(info&&!info.isFile())throw Error('Output must be a regular file');
 if(inputPaths.includes(canonical)||info&&inputPaths.some(p=>{try{const st=statSync(p);return st.dev===info.dev&&st.ino===info.ino;}catch(error){if(error.code!=='ENOENT')throw error;return false;}}))throw Error('Output must not overwrite review or media input');
 return canonical;
}
function writeReceipt(destination,inputs,result) {
 const temporary=mkdtempSync(join(dirname(destination),'.exact-review-'));
 try {
  const staged=join(temporary,'receipt.json');writeFileSync(staged,JSON.stringify(result,null,2)+'\n');
  safeOutputPath(destination,inputs);
  renameSync(staged,destination);
 } finally {rmSync(temporary,{recursive:true,force:true});}
}
export function main(args,{probe=execFileSync}={}) {
 const [mode,video,output,reviewPath,manifestPath]=args;
 const bound=mode==='validate-bound',validating=mode==='validate'||bound;
 if(!['prepare','validate','validate-bound'].includes(mode)||!video||!output||(validating&&!reviewPath)||(bound&&!manifestPath))throw Error('Usage: exact_av_review.mjs prepare VIDEO OUTPUT | validate VIDEO OUTPUT REVIEW_JSON | validate-bound VIDEO OUTPUT REVIEW_JSON REFERENCES_JSON');
 const inputs=validating?[video,reviewPath]:[video];
 let references=[],manifestError;
 if(bound){inputs.push(manifestPath);try{references=referenceInputs(manifestPath);inputs.push(...references.map(r=>r.path));}catch(error){manifestError=error;}}
 const destination=safeOutputPath(output,inputs);
 // Fail closed before probing or parsing. A failed attempt must not leave an
 // earlier VALIDATED_REVIEW receipt looking like the result of this attempt.
 writeReceipt(destination,inputs,{schema_version:1,status:'BLOCKED',ready:false,reasons:['review_attempt_incomplete'],publication_enabled:false,production_approved:false});
 if(manifestError)throw manifestError;
 const media=bound?inspectDecodedMedia(resolve(video),probe):inspectMedia(resolve(video),probe);
 const result=mode==='prepare'?prepareReview(media):bound?boundReview(readReview(reviewPath),media,references,probe):validateReview(readReview(reviewPath),media);
 if(bound){
  // A reference or candidate changed while another file was processed must not
  // receive a successful binding receipt from the earlier snapshot.
  if(mediaDigest(resolve(video)).sha256!==media.candidate_sha256)throw Error('Candidate changed during comparison');
  for(let i=0;i<references.length;i++)if(mediaDigest(references[i].path).sha256!==result.reference_media[i].artifact_sha256)throw Error('Reference changed during comparison');
 }
 // Recheck aliases immediately before atomic replace; never follow a destination symlink.
 writeReceipt(destination,inputs,result);
 console.log(JSON.stringify({status:result.status,candidate_sha256:media.candidate_sha256,publication_enabled:false}));
 return validating&&!result.ready?2:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
