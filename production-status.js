import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
export function createProductionStatusRouter({root=process.cwd()}={}) {
 const router=express.Router();
 router.get('/v2/revalidation',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const locked={publication_enabled:false,production_approved:false,full_av_review:false,watch_url:null};
  try {
   const read=relative=>fs.readFile(path.join(root,relative));
   const [reportBytes,draftBytes,videoBytes,reviewBytes]=await Promise.all([
    read('state/v2-revalidation.json'),read('state/v2-draft.json'),read('public-review/v2-draft.mp4'),read('state/visual-analysis/frame-review.json')]);
   const report=JSON.parse(reportBytes),draft=JSON.parse(draftBytes),review=JSON.parse(reviewBytes);
   const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
   const candidate=hash(videoBytes),decision=review.decision;
   if(!videoBytes.length||report.schema_version!==1||!['BLOCKED','VISUAL_REVALIDATED'].includes(report.status)||
      [report,draft].some(x=>x.publication_enabled!==false||x.production_approved!==false)||
      report.full_av_review!==false||report.render_attempted!==false||draft.status!=='DRAFT'||
      report.candidate_sha256!==candidate||draft.candidate_sha256!==candidate||review.candidate?.sha256!==candidate||
      report.visual_review_sha256!==hash(reviewBytes)||!Number.isSafeInteger(report.original_run_id)||report.original_run_id<=0||report.original_run_id!==draft.run_id||
      !['PASS','FAIL','BLOCKED'].includes(decision)||report.visual_review?.status!==decision||
      (report.status==='VISUAL_REVALIDATED')!==(decision==='PASS'))throw Error('stale_or_invalid');
   const rubric={};
   const dimensions=['typography','character_scale','staging','character_consistency','phone_readability'];
   const findings=Array.isArray(review.findings)?review.findings.filter(x=>dimensions.includes(x?.dimension)):null;
   if(findings&&(findings.length!==dimensions.length||new Set(findings.map(x=>x.dimension)).size!==dimensions.length))throw Error('invalid_findings');
   for(const key of ['typography','character_scale','staging','character_consistency','phone_readability']){
    const item=report.visual_review.rubric?.[key];
    const source=findings?.find(x=>x.dimension===key);
    if(!item||typeof item.observation!=='string')throw Error('invalid_rubric');
    if(findings){
     if(!['PASS','MISMATCH','NOT_VERIFIED'].includes(item.status)||item.status!==source.status||item.observation!==source.observation||JSON.stringify(item.candidate_frames)!==JSON.stringify(source.candidate_frames))throw Error('invalid_rubric');
    }else if(item.observation!==review.rubric?.[key]?.evidence||!['MATCH','MISMATCH','NOT_VERIFIED'].includes(item.status)||(item.status==='MATCH')!==(review.rubric?.[key]?.pass===true))throw Error('invalid_rubric');
    rubric[key]={status:item.status,observation:item.observation};
   }
   const blockers=Array.isArray(review.unresolved_issues)?review.unresolved_issues.filter(x=>typeof x==='string'):[];
   if(decision==='PASS'&&(blockers.length||Object.values(rubric).some(x=>!['PASS','MATCH'].includes(x.status))))throw Error('contradictory_pass');
   res.json({schema_version:1,status:report.status,...locked,candidate_sha256:candidate,original_run_id:report.original_run_id,
    visual_status:decision,rubric,blockers,scope:'Exact existing candidate revalidation; sampled visual findings only. Full audiovisual and competitor approval remain required.'});
  }catch{res.status(503).json({status:'UNAVAILABLE',...locked,error:'REVALIDATION_STALE_OR_UNAVAILABLE'});}
 });

 router.get('/execution/:format',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['short','long'].includes(req.params.format))return res.status(404).json({error:'UNKNOWN_FORMAT'});
  try {
   const report=JSON.parse(await fs.readFile(path.join(root,`state/production-execution/${req.params.format}.json`),'utf8'));
   const when=Date.parse(report.recorded_at);
   if(report.schema_version!==1||report.format!==req.params.format||!/^[a-f0-9]{40}$/.test(report.source_commit)||!Number.isSafeInteger(report.run_id)||report.run_id<=0||!Number.isSafeInteger(report.run_attempt)||report.run_attempt<=0||report.publication_enabled!==false||report.production_approved!==false||!Number.isFinite(when)||when>Date.now()+60000||!['PASS','BLOCKED'].includes(report.technical_status)||report.candidate_sha256!==null&&!/^[a-f0-9]{64}$/.test(report.candidate_sha256))throw Error('invalid');
   const checks=Object.fromEntries(['technical_video','openmontage_probe'].map(key=>[key,{status:report.checks?.[key]?.status==='PASS'?'PASS':'BLOCKED',hash_bound:report.checks?.[key]?.hash_bound===true}]));
   const stale=Date.now()-when>86400000;
   const technical=report.technical_status==='PASS'&&report.workflow_outcome==='success'&&report.candidate_generated===true&&!!report.candidate_sha256&&Object.values(checks).every(check=>check.status==='PASS'&&check.hash_bound);
   const build=Object.fromEntries(['schema_version','format','run_id','run_attempt','recorded_at','source_commit','workflow_outcome','candidate_sha256','candidate_generated'].map(key=>[key,report[key]]));
   res.json({...build,checks,technical_status:technical?'PASS':'BLOCKED',status:technical&&!stale?'REVIEW_PENDING':'BLOCKED',creative_review:'PENDING',audio_listening_review:'PENDING',publication_enabled:false,production_approved:false,watch_url:null,media_url:null,report_age_seconds:Math.max(0,Math.floor((Date.now()-when)/1000)),report_stale:stale,status_scope:'Last recorded execution; not a live job poll or playback approval'});
  } catch {res.status(503).json({status:'UNAVAILABLE',publication_enabled:false,production_approved:false,watch_url:null,media_url:null,error:'EXECUTION_REPORT_UNAVAILABLE'});}
 });
 router.get('/v2',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {
   const report=JSON.parse(await fs.readFile(path.join(root,'state/v2-production-status.json'),'utf8'));
   const when=Date.parse(report.recorded_at);
   if(report.schema_version!==1||!Number.isSafeInteger(report.run_id)||report.run_id<=0||report.publication_enabled!==false||report.production_approved!==false||!report.checks||!Number.isFinite(when)||when>Date.now()+60000)throw Error('invalid');
   // This endpoint describes an unapproved build, never a handoff authorization.
   // Project known fields so persisted preview links/ready flags cannot leak through.
   const build=Object.fromEntries(['schema_version','run_id','recorded_at','source_commit','workflow_outcome','workflow_url','candidate_sha256','candidate_generated','checks','scope'].filter(key=>Object.hasOwn(report,key)).map(key=>[key,report[key]]));
   const technicalNames=['voices','sound_mix','transcription','captions','caption_frames','technical_video','character_binding','phone_viewport'];
   const stale=Date.now()-when>86400000;
   const technical=report.candidate_generated===true&&/^[a-f0-9]{64}$/.test(report.candidate_sha256)&&technicalNames.every(name=>report.checks[name]?.status==='PASS');
   const visual=report.checks.style_parity;
   const invalid=visual?.failed_checks?.some(name=>['publication_disabled_not_verified','exact_candidate_binding_missing'].includes(name));
   const reviewStatus=!technical?'TECHNICAL_PREREQUISITES_MISSING':visual?.status==='PASS'?'FULL_AUDIOVISUAL_REVIEW_REQUIRED':visual?.status==='FAIL'?'CREATIVE_REPAIR_REQUIRED':!invalid&&['BLOCKED','NOT_RUN'].includes(visual?.status)?'CURRENT_CANDIDATE_VISUAL_REVIEW_REQUIRED':'REVIEW_EVIDENCE_INVALID';
   const status=stale||!technical?'BLOCKED':reviewStatus==='FULL_AUDIOVISUAL_REVIEW_REQUIRED'?'REVIEW_REQUIRED':reviewStatus==='CURRENT_CANDIDATE_VISUAL_REVIEW_REQUIRED'?'AWAITING_REVIEW':'BLOCKED';
   res.json({...build,status,technical_status:technical?'PASS':'BLOCKED',review_status:reviewStatus,publication_enabled:false,production_approved:false,report_age_seconds:Math.max(0,Math.floor((Date.now()-when)/1000)),report_stale:stale,status_scope:'Last recorded build; not a live running-job poll or creative approval',watch_url:null});
  } catch {res.status(503).json({status:'UNAVAILABLE',publication_enabled:false,production_approved:false,watch_url:null,error:'BUILD_REPORT_UNAVAILABLE'});}
 });
 return router;
}
export function createDraftPreviewHoldRouter(){
 const router=express.Router();
 router.all('/media',(req,res)=>{res.setHeader('Cache-Control','no-store');res.status(409).json({error:'PREVIEW_WITHHELD_PENDING_CREATIVE_REVIEW',publication:false,production_approved:false});});
 router.all('/watch',(req,res)=>{res.setHeader('Cache-Control','no-store');res.status(409).type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creative review pending</title><style>body{font:18px system-ui;line-height:1.6;max-width:38rem;margin:3rem auto;padding:1rem;color:#111;background:#fff}</style><h1>Creative review pending</h1><p>The unfinished draft is withheld. A preview will be offered only after the completed video clears review.</p><p>Publishing remains disabled.</p><a href="/social">Production status</a></html>');});
 return router;
}
