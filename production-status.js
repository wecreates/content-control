import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
export function createProductionStatusRouter({root=process.cwd()}={}) {
 const router=express.Router();
 router.get('/v2',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {
   const report=JSON.parse(await fs.readFile(path.join(root,'state/v2-production-status.json'),'utf8'));
   const when=Date.parse(report.recorded_at);
   if(report.schema_version!==1||!Number.isSafeInteger(report.run_id)||report.run_id<=0||report.publication_enabled!==false||report.production_approved!==false||!report.checks||!Number.isFinite(when)||when>Date.now()+60000)throw Error('invalid');
   // This endpoint describes an unapproved build, never a handoff authorization.
   // Project known fields so persisted preview links/ready flags cannot leak through.
   const build=Object.fromEntries(['schema_version','run_id','recorded_at','source_commit','workflow_outcome','workflow_url','candidate_sha256','candidate_generated','checks','scope'].filter(key=>Object.hasOwn(report,key)).map(key=>[key,report[key]]));
   res.json({...build,status:'BLOCKED',publication_enabled:false,production_approved:false,report_age_seconds:Math.max(0,Math.floor((Date.now()-when)/1000)),report_stale:Date.now()-when>86400000,status_scope:'Last recorded build; not a live running-job poll',watch_url:null});
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
