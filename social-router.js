import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeSocialUrl,denyExternalAction,connectionStatus,planTokenRenewal,routeFinding,fullAnalysisCoverage} from './social-intake.js';
export const INTAKE_WORKFLOW_URL='https://github.com/wecreates/content-control/actions/workflows/social-link-intake.yml';

// Public status is a projection, never a serialization of authorization state.
const SECRET_FIELDS=new Set(['accesstoken','refreshtoken','idtoken','clientsecret','apikey','token','tokens','secret','secrets','password','authorization','cookie','cookies','credentials','authentication']);
function publicConnection(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result={};
  for(const key of ['status','connected','last_read_verified_at','expires_at','renewal_supported','error_code']) {
    if(['string','boolean','number'].includes(typeof value[key]))result[key]=value[key];
  }
  if(value.read_check&&typeof value.read_check==='object') {
    result.read_check={};
    for(const key of ['provider','observed','result','checked_at'])if(typeof value.read_check[key]==='string')result.read_check[key]=value.read_check[key];
  }
  return result;
}
function publicStatusData(value) {
  if(Array.isArray(value))return value.map(publicStatusData);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!SECRET_FIELDS.has(key.replace(/[^a-z0-9]/gi,'').toLowerCase())).map(([key,item])=>[key,key==='connection'?publicConnection(item):publicStatusData(item)]));
}

function contentReference(ref) {
  if(!ref||ref.repository!=='wecreates/content-control')return null;
  return Object.fromEntries(['repository','path','id','finding_id','basis','full_analysis'].filter(k=>['string','boolean'].includes(typeof ref[k])).map(k=>[k,ref[k]]));
}
function referenceCheck(ref,queue) {
  const result={...ref,evidence_verified:false,publication_enabled:false};
  if(ref.path!=='capability-queue.json')return {...result,status:'unsupported_reference_path'};
  const record=queue.queue.find(r=>r?.id===ref.id);
  if(!record)return {...result,status:'record_missing'};
  const finding=record.findings?.find(f=>f.id===ref.finding_id);
  if(!finding)return {...result,status:'finding_missing'};
  try {
    if(ref.basis!==undefined&&ref.basis!==finding.basis)throw Error('basis mismatch');
    if(ref.full_analysis!==undefined&&ref.full_analysis!==(finding.full_analysis===true))throw Error('coverage mismatch');
    routeFinding(queue,record.id,finding,{allowedProjects:['Content Control','Money Factory','CYZOR Money Factory / Chrome extensions']});
    return {...result,status:'verified_repository_evidence',evidence_verified:true,basis:finding.basis,full_analysis:finding.full_analysis===true,evidence_refs:finding.evidence_refs};
  }catch{return {...result,status:'evidence_invalid'};}
}

export function createSocialRouter({root=process.cwd(),fetchImpl=fetch}={}) {
  const router=express.Router();
  const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/status',async(req,res)=>{
    try {
      const [queue,capabilities]=await Promise.all([read('capability-queue.json'),read('social-capabilities.json')]);
      if(!Array.isArray(queue.queue)||!Array.isArray(capabilities.platforms))throw Error('schema');
      const connection_health=capabilities.platforms.map(p=>({platform:p.id,...connectionStatus(p.connection),renewal:planTokenRenewal(p.connection||{})}));
      res.json({connection_health,publication_enabled:false,external_actions_enabled:false,storage:'versioned_existing_repository_queue',intake_mode:'owner_authenticated_github_workflow; dashboard_validation_only',intake_workflow_url:INTAKE_WORKFLOW_URL,automatic_token_renewal:false,capabilities:publicStatusData(capabilities),records:publicStatusData(queue.queue.map(record=>({...record,coverage_validation:fullAnalysisCoverage(record)}))),checked_at:new Date().toISOString(),connection_checks_are:'dated_observations_not_live_provider_polling',revenue:{traffic:null,leads:null,sales:null,costs:null,refunds:null,net_profit:null,reason:'No connected attributed financial feed'}});
    } catch {res.status(503).json({error:'STATUS_SOURCE_UNAVAILABLE',publication_enabled:false});}
  });
  router.get('/project-links',async(req,res)=>{
    try {
      const upstream=await fetchImpl('https://raw.githubusercontent.com/wecreates/Money-factory/main/idea-vault/business-ideas.json',{signal:AbortSignal.timeout(8000)});
      if(!upstream.ok)throw Error('upstream');
      const data=await upstream.json();
      if(!data||!Array.isArray(data.ideas)||data.ideas.some(x=>!x||typeof x!=='object'))throw Error('schema');
      const queue=await read('capability-queue.json');
      if(!Array.isArray(queue.queue))throw Error('queue schema');
      const references=data.ideas.flatMap(idea=>{
        const primary=contentReference(idea.source_record),additional=contentReference(idea.additional_content_reference);
        if(!primary&&!additional)return [];
        return [{id:idea.id,status:idea.status,...(primary?{source_record:primary}:{}),...(additional?{additional_content_reference:additional}:{}),reference_checks:[primary,additional].filter(Boolean).map(ref=>referenceCheck(ref,queue)),publication_enabled:false}];
      });
      res.json({retrieved_at:new Date().toISOString(),verification_scope:'repository_references_only_not_runtime_routing_or_revenue',repository:'wecreates/Money-factory',references,publication_enabled:false});
    } catch {res.status(503).json({error:'MONEY_FACTORY_REFERENCE_UNAVAILABLE',publication_enabled:false});}
  });
  router.post('/validate',express.json({limit:'4kb'}),async(req,res)=>{
    try {
      const normalized=normalizeSocialUrl(req.body?.url);
      let queue;
      try {queue=await read('capability-queue.json');if(!Array.isArray(queue.queue))throw Error('schema');} catch {return res.status(503).json({error:'QUEUE_SOURCE_UNAVAILABLE',publication_enabled:false});}
      const existing=queue.queue.find(r=>{try{return normalizeSocialUrl(r.source_url).canonical_id===normalized.canonical_id;}catch{return false;}});
      res.json({...normalized,duplicate:Boolean(existing),record_id:existing?.id||null,saved:false,intake_workflow_url:INTAKE_WORKFLOW_URL,next_action:existing?'Existing intake found':'Copy the canonical link, open secure intake, and run the workflow from your repository-owner GitHub account. Saving a link does not retrieve or analyze its video.',publication_enabled:false});
    } catch {res.status(400).json({error:'INVALID_OR_UNSUPPORTED_CONTENT_URL',publication_enabled:false});}
  });
  // Dashboard storage remains read-only. Durable writes require the owner-authenticated
  // GitHub workflow; never acknowledge a save into ephemeral RAM.
  router.post('/intake',(req,res)=>res.status(503).json({error:'DASHBOARD_WRITE_DISABLED',intake_workflow_url:INTAKE_WORKFLOW_URL,saved:false,publication_enabled:false}));
  router.use((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD') {
      try {denyExternalAction(req.path);} catch(e){return res.status(403).json({error:e.code,publication_enabled:false});}
    }
    res.status(404).json({error:'NOT_FOUND',publication_enabled:false});
  });
  router.use((err,req,res,next)=>{
    if(res.headersSent)return next(err);
    const oversized=err.type==='entity.too.large';
    res.status(oversized?413:400).json({error:oversized?'REQUEST_TOO_LARGE':'INVALID_REQUEST_BODY',publication_enabled:false,external_actions_enabled:false});
  });
  return router;
}
