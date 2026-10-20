import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ArtifactStore} from './artifacts.mjs';
import {createGrantResolver} from './grant-client.mjs';
import {parseSignedJSON} from './signed-json.mjs';
const hash=/^[a-f0-9]{64}$/;
const outputNames=new Set(['package','qa.json','qa-signed.json']);
const interiorRoles=['template','pages','font','fontRights','fontLicense'];
export function validateTask(task){
 if(task?.schema_version!==1||!task.files||typeof task.files!=='object'||Array.isArray(task.files))throw Error('TASK_INVALID');
 const entries=Object.entries(task.files);
 if(!entries.length||entries.length>32||entries.some(([name,sha])=>!/^[-a-zA-Z0-9_.]{1,100}$/.test(name)||name==='.'||name==='..'||
  outputNames.has(name.toLowerCase())||typeof sha!=='string'||!hash.test(sha)))throw Error('TASK_FILES_INVALID');
 if(typeof task.templateScope?.product!=='string'||!task.templateScope.product.trim()||task.templateScope.product.length>128||
  typeof task.templateScope?.country!=='string'||!/^[A-Z]{2}$/.test(task.templateScope.country))throw Error('TASK_TEMPLATE_SCOPE_REQUIRED');
 const roles=['source','template','textLayers','assetRights','reference'];
 const has=n=>typeof n==='string'&&Object.hasOwn(task.files,n);
 if(roles.some(role=>!has(task[role])))throw Error('TASK_ROLE_INVALID');
 if(Object.hasOwn(task,'templateSource')&&!has(task.templateSource))throw Error('TASK_ROLE_INVALID');
 if(Object.hasOwn(task,'interior')&&(!task.interior||typeof task.interior!=='object'||Array.isArray(task.interior)||
  Object.keys(task.interior).length!==interiorRoles.length||
  interiorRoles.some(role=>!Object.hasOwn(task.interior,role)||!has(task.interior[role]))))throw Error('TASK_INTERIOR_INVALID');
 return task;
}
export function createStoredTaskResolvers(db,{store=new ArtifactStore(db),approvedEvaluators=[],approvedEditorialEvaluators=[],env=process.env,fetchImpl=fetch}={}){
 // A signed queue envelope records intake authority, not current revocation.
 // Missing configuration must never silently switch to cached approvals.
 let resolveGrant,authorityReady=false;
 try{resolveGrant=createGrantResolver({env,fetchImpl});authorityReady=true;}
 catch(error){const code=error.message==='GRANT_AUTHORITY_REQUIRED'?'GRANT_AUTHORITY_REQUIRED':'GRANT_AUTHORITY_INVALID';
  resolveGrant=async()=>{throw Error(code);};}
 return {
  resolveGrant,authorityReady,
  resolveTask:async(job,{signal}={})=>{
   const active=()=>{if(signal?.aborted)throw Error('PRODUCTION_STOPPED');};
   active();
   if(typeof job.brief?.task_sha256!=='string'||!hash.test(job.brief.task_sha256))throw Error('TASK_REQUIRED');
   const descriptor=await store.get(job.brief.task_sha256);
   active();
   if(descriptor.media_type!=='application/json'||descriptor.body.length>262144)throw Error('TASK_INVALID');
   // ArtifactStore authenticates the stored bytes by hash. Do not change those
   // bytes through replacement decoding or choose among duplicate JSON fields.
   let parsed;
   try{parsed=parseSignedJSON(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(descriptor.body));}
   catch{throw Error('TASK_INVALID');}
   const task=validateTask(parsed);
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cyzor-pod-'));
   const cleanup=()=>fs.rm(directory,{recursive:true,force:true});
   try{
    active();
    let total=0;
    for(const [name,sha] of Object.entries(task.files)){
     const artifact=await store.get(sha);active();total+=artifact.body.length;
     if(total>64*1024*1024)throw Error('TASK_BUDGET_EXCEEDED');
     await fs.writeFile(path.join(directory,name),artifact.body,{flag:'wx',mode:0o600});
     active();
    }
    const resolved={rights_verified:true,assetRoot:directory,output:path.join(directory,'package'),
     qaOutput:path.join(directory,'qa.json'),qaSignedOutput:path.join(directory,'qa-signed.json'),
     approvedEvaluators,approvedEditorialEvaluators,cleanup,templateScope:{product:task.templateScope.product,country:task.templateScope.country}};
    for(const role of ['source','template','textLayers','assetRights','reference'])resolved[role]=path.join(directory,task[role]);
    if(Object.hasOwn(task,'templateSource'))resolved.templateSource=path.join(directory,task.templateSource);
    if(task.interior)resolved.interior=Object.fromEntries(interiorRoles.map(role=>[role,path.join(directory,task.interior[role])]));
    // New packages await a hash-bound external QA review; no preapproved future bytes.
    return resolved;
   }catch(e){await cleanup();throw e;}
  }
 };
}
