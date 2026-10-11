import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeSocialUrl,denyExternalAction,connectionStatus,planTokenRenewal} from './social-intake.js';

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

export function createSocialRouter({root=process.cwd(),fetchImpl=fetch}={}) {
  const router=express.Router();
  const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/status',async(req,res)=>{
    try {
      const [queue,capabilities]=await Promise.all([read('capability-queue.json'),read('social-capabilities.json')]);
      if(!Array.isArray(queue.queue)||!Array.isArray(capabilities.platforms))throw Error('schema');
      const connection_health=capabilities.platforms.map(p=>({platform:p.id,...connectionStatus(p.connection),renewal:planTokenRenewal(p.connection||{})}));
      res.json({connection_health,publication_enabled:false,external_actions_enabled:false,storage:'versioned_existing_repository_queue',intake_mode:'chat_assisted_persistent; dashboard_validation_only',automatic_token_renewal:false,capabilities:publicStatusData(capabilities),records:publicStatusData(queue.queue),checked_at:new Date().toISOString(),connection_checks_are:'dated_observations_not_live_provider_polling',revenue:{traffic:null,leads:null,sales:null,costs:null,refunds:null,net_profit:null,reason:'No connected attributed financial feed'}});
    } catch {res.status(503).json({error:'STATUS_SOURCE_UNAVAILABLE',publication_enabled:false});}
  });
  router.get('/project-links',async(req,res)=>{
    try {
      const upstream=await fetchImpl('https://raw.githubusercontent.com/wecreates/Money-factory/main/idea-vault/business-ideas.json',{signal:AbortSignal.timeout(8000)});
      if(!upstream.ok)throw Error('upstream');
      const data=await upstream.json();
      if(!data||!Array.isArray(data.ideas)||data.ideas.some(x=>!x||typeof x!=='object'))throw Error('schema');
      res.json({retrieved_at:new Date().toISOString(),verification_scope:'repository_references_only_not_runtime_routing_or_revenue',repository:'wecreates/Money-factory',references:(data.ideas||[]).filter(x=>x.source_record?.repository==='wecreates/content-control').map(x=>({id:x.id,status:x.status,source_record:x.source_record,publication_enabled:x.publication_enabled})),publication_enabled:false});
    } catch {res.status(503).json({error:'MONEY_FACTORY_REFERENCE_UNAVAILABLE',publication_enabled:false});}
  });
  router.post('/validate',express.json({limit:'4kb'}),async(req,res)=>{
    try {
      const normalized=normalizeSocialUrl(req.body?.url);
      let queue;
      try {queue=await read('capability-queue.json');if(!Array.isArray(queue.queue))throw Error('schema');} catch {return res.status(503).json({error:'QUEUE_SOURCE_UNAVAILABLE',publication_enabled:false});}
      const existing=queue.queue.find(r=>{try{return normalizeSocialUrl(r.source_url).canonical_id===normalized.canonical_id;}catch{return false;}});
      res.json({...normalized,duplicate:Boolean(existing),record_id:existing?.id||null,saved:false,next_action:existing?'Existing intake found':'Submit this link in the project chat for authorized retrieval and durable intake',publication_enabled:false});
    } catch {res.status(400).json({error:'INVALID_OR_UNSUPPORTED_CONTENT_URL',publication_enabled:false});}
  });
  // Render free storage is ephemeral, and this deployment has no authenticated
  // durable-write provider. Never acknowledge a successful save into ephemeral RAM.
  router.post('/intake',(req,res)=>res.status(503).json({error:'AUTHENTICATED_DURABLE_WRITER_NOT_CONFIGURED',saved:false,publication_enabled:false}));
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
