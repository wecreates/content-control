/** Local exact-media review preparation and validation. Never calls an inference provider. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {creativeHandoff,CREATIVE_CHECKS} from '../creative-handoff.js';

export function inspectMedia(path) {
 const bytes=readFileSync(path);
 const data=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
 const duration=Number(data.format?.duration);
 if(!Number.isFinite(duration)||duration<=0||!data.streams?.some(s=>s.codec_type==='video')||!data.streams?.some(s=>s.codec_type==='audio'))throw Error('A positive-duration video with audio is required');
 return {verified:true,candidate_sha256:createHash('sha256').update(bytes).digest('hex'),duration_seconds:duration,byte_length:bytes.length};
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
export function main(args) {
 const [mode,video,output,reviewPath]=args;
 if(!['prepare','validate'].includes(mode)||!video||!output||(mode==='validate'&&!reviewPath))throw Error('Usage: exact_av_review.mjs prepare VIDEO OUTPUT | validate VIDEO OUTPUT REVIEW_JSON');
 const media=inspectMedia(resolve(video));
 const result=mode==='prepare'?prepareReview(media):validateReview(JSON.parse(readFileSync(reviewPath,'utf8')),media);
 mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,candidate_sha256:media.candidate_sha256,publication_enabled:false}));
 return mode==='validate'&&!result.ready?2:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=2;}}
