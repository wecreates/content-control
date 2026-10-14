import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ArtifactStore} from './artifacts.mjs';
import {createGrantResolver} from './grant-client.mjs';
const hash=/^[a-f0-9]{64}$/;
export function validateTask(task){
 if(task?.schema_version!==1||!task.files||typeof task.files!=='object'||Array.isArray(task.files))throw Error('TASK_INVALID');
 const entries=Object.entries(task.files);
 if(!entries.length||entries.length>32||entries.some(([name,sha])=>!/^[-a-zA-Z0-9_.]{1,100}$/.test(name)||name==='.'||name==='..'||!hash.test(sha)))throw Error('TASK_FILES_INVALID');
 const roles=['source','template','textLayers','assetRights','reference'];
 const has=n=>typeof n==='string'&&Object.hasOwn(task.files,n);
 if(roles.some(role=>!has(task[role])))throw Error('TASK_ROLE_INVALID');
 if(task.interior&&['template','pages','font'].some(role=>!has(task.interior[role])))throw Error('TASK_INTERIOR_INVALID');
 return task;
}
export function createStoredTaskResolvers(db,{store=new ArtifactStore(db),approvedEvaluators=[],env=process.env}={}){
 let resolveGrant=async job=>job.upstream_envelope;
 if(env.POD_GRANT_URL){
  try{resolveGrant=createGrantResolver({env});}catch{resolveGrant=async()=>{throw Error('GRANT_AUTHORITY_INVALID');};}
 }
 return {
  resolveGrant,
  resolveTask:async job=>{
   if(!hash.test(job.brief.task_sha256||''))throw Error('TASK_REQUIRED');
   const descriptor=await store.get(job.brief.task_sha256);
   if(descriptor.media_type!=='application/json'||descriptor.body.length>262144)throw Error('TASK_INVALID');
   const task=validateTask(JSON.parse(descriptor.body.toString('utf8')));
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cyzor-pod-'));
   const cleanup=()=>fs.rm(directory,{recursive:true,force:true});
   try{
    let total=0;
    for(const [name,sha] of Object.entries(task.files)){
     const artifact=await store.get(sha);total+=artifact.body.length;
     if(total>64*1024*1024)throw Error('TASK_BUDGET_EXCEEDED');
     await fs.writeFile(path.join(directory,name),artifact.body,{flag:'wx',mode:0o600});
    }
    const resolved={rights_verified:true,assetRoot:directory,output:path.join(directory,'package'),
     qaOutput:path.join(directory,'qa.json'),qaSignedOutput:path.join(directory,'qa-signed.json'),
     approvedEvaluators,cleanup};
    for(const role of ['source','template','textLayers','assetRights','reference'])resolved[role]=path.join(directory,task[role]);
    if(task.interior)resolved.interior=Object.fromEntries(Object.entries(task.interior).map(([k,v])=>[k,path.join(directory,v)]));
    // New packages await a hash-bound external QA review; no preapproved future bytes.
    return resolved;
   }catch(e){await cleanup();throw e;}
  }
 };
}

