/** Local exact-media review preparation and validation. Never calls an inference provider. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync,statSync,mkdtempSync,renameSync,rmSync} from 'node:fs';
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
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
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
 const bytes=readFileSync(path);
 const data=JSON.parse(probe('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
 const hash=digest(bytes);
 if(digest(readFileSync(path))!==hash)throw Error('Media changed during probe');
 const duration=Number(data.format?.duration);
 if(!Number.isFinite(duration)||duration<=0||!data.streams?.some(s=>s.codec_type==='video')||!data.streams?.some(s=>s.codec_type==='audio'))throw Error('A positive-duration video with audio is required');
 return {verified:true,candidate_sha256:hash,duration_seconds:duration,byte_length:bytes.length};
}
export function prepareReview(media) {
 return {schema_version:1,status:'REVIEW_REQUIRED',publication_enabled:false,production_approved:false,media,
  scope:'Preparation only. No external upload, inference, creative approval, or listening certification performed.',
  prompt:`Review the exact supplied video AND audio end to end (${media.duration_seconds} seconds; SHA256 ${media.candidate_sha256}). Do not infer review from a script, contact sheet, transcript, or technical metrics. If any portion is inaccessible, report BLOCKED and describe the gap. Inspect hook, story escalation, visual storytelling, character consistency, voice performance, sound mix, pacing, phone readability, payoff and factual accuracy. Record time-located defects and full reviewed intervals. Independently review at least two distinct competitor videos with audio before claiming comparison. Return JSON in this schema; only return PASS when actual complete review supports every check and there are no unresolved issues. Never invent evidence, reference access or listening.`,
  response_schema:{candidate_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,status:'PASS | REPAIR | BLOCKED',method:'rendered_video_review',full_video_review:'boolean',full_audio_review:'boolean',reviewer:{identity:'reviewer identifier',method:'actual audiovisual inspection method',evidence:'traceable review session or response identifier'},reviewed_intervals:'[[start,end], ...]',checks:Object.fromEntries(CREATIVE_CHECKS.map(k=>[k,{pass:'boolean',evidence:'concrete observed evidence'}])),comparisons:[{url:'https://...',full_video_review:'boolean',full_audio_review:'boolean',access_scope:'full audiovisual review',observation:'specific observed evidence',applied_difference:'specific difference'}],findings:[{start_sec:'number',end_sec:'number',severity:'critical | major | minor',category:'string',evidence:'observed defect',repair:'required change',resolved:'boolean'}],critical_count:'integer',major_count:'integer',unresolved_issues:'array',publication_enabled:false}};
}
export function validateReview(review,media) {
 const reasons=[];const documented=x=>typeof x==='string'&&x.trim().length>=12;
 if(review?.publication_enabled!==false)reasons.push('publication_lock_missing');
 if(!documented(review?.reviewer?.identity)||!documented(review?.reviewer?.method)||!documented(review?.reviewer?.evidence))reasons.push('reviewer_provenance_missing');
 const findings=review?.findings;
 if(!Array.isArray(findings))reasons.push('findings_missing');
 else {
  for(const f of findings) {
   if(!f||!['critical','major','minor'].includes(f.severity)||!Number.isFinite(f.start_sec)||!Number.isFinite(f.end_sec)||f.start_sec<0||f.end_sec<=f.start_sec||f.end_sec>media.duration_seconds||!documented(f.evidence)||!documented(f.repair)||typeof f.category!=='string'||!f.category.trim()||typeof f.resolved!=='boolean')reasons.push('invalid_timestamped_finding');
  }
  for(const severity of ['critical','major'])if(!Number.isInteger(review[severity+'_count'])||review[severity+'_count']!==findings.filter(f=>f?.severity===severity).length)reasons.push(severity+'_count_mismatch');
  if(findings.some(f=>f?.resolved!==true))reasons.push('unresolved_findings');
  if(findings.some(f=>['critical','major'].includes(f?.severity)))reasons.push('material_findings_require_repair_and_new_review');
 }
 const gate=creativeHandoff(review,media.candidate_sha256,media);
 reasons.push(...gate.reasons);
 return {schema_version:1,status:reasons.length?'BLOCKED':'VALIDATED_REVIEW',ready:reasons.length===0,reasons:[...new Set(reasons)],candidate_sha256:media.candidate_sha256,duration_seconds:media.duration_seconds,publication_enabled:false,production_approved:false,scope:'Validates submitted evidence structure and the existing creative handoff gate; does not itself observe audiovisual content or authenticate reviewer claims.'};
}
export function safeOutputPath(output,inputs) {
 const absolute=resolve(output);
 const inputPaths=inputs.map(p=>realpathSync(resolve(p)));
 mkdirSync(dirname(absolute),{recursive:true});
 const canonical=join(realpathSync(dirname(absolute)),basename(absolute));
 let info;
 try{info=lstatSync(canonical);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(info?.isSymbolicLink())throw Error('Output must not be a symlink');
 if(inputPaths.includes(canonical)||info&&inputPaths.some(p=>{const st=statSync(p);return st.dev===info.dev&&st.ino===info.ino;}))throw Error('Output must not overwrite review or media input');
 return canonical;
}
export function main(args) {
 const [mode,video,output,reviewPath]=args;
 if(!['prepare','validate'].includes(mode)||!video||!output||(mode==='validate'&&!reviewPath))throw Error('Usage: exact_av_review.mjs prepare VIDEO OUTPUT | validate VIDEO OUTPUT REVIEW_JSON');
 const inputs=mode==='validate'?[video,reviewPath]:[video];
 const destination=safeOutputPath(output,inputs);
 const media=inspectMedia(resolve(video));
 const result=mode==='prepare'?prepareReview(media):validateReview(JSON.parse(readFileSync(reviewPath,'utf8')),media);
 // Recheck aliases immediately before atomic replace; never follow a destination symlink.
 safeOutputPath(destination,inputs);
 const temporary=mkdtempSync(join(dirname(destination),'.exact-review-'));
 try {const staged=join(temporary,'receipt.json');writeFileSync(staged,JSON.stringify(result,null,2)+'\n');renameSync(staged,destination);}
 finally {rmSync(temporary,{recursive:true,force:true});}
 console.log(JSON.stringify({status:result.status,candidate_sha256:media.candidate_sha256,publication_enabled:false}));
 return mode==='validate'&&!result.ready?2:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
