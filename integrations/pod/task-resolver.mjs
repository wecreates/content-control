import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {types as utilTypes} from 'node:util';
import {ArtifactStore} from './artifacts.mjs';
import {createGrantResolver} from './grant-client.mjs';
import {parseSignedJSON} from './signed-json.mjs';
import {validOpaqueText} from './text-identity.mjs';
const hash=/^[a-f0-9]{64}$/;
const outputNames=new Set(['package','qa.json','qa-signed.json']);
const interiorRoles=['template','pages','font','fontRights','fontLicense','source','bookDetails','regionalRightsEvidence'];
const roleMediaTypes={source:'image/png',template:'application/json',textLayers:'application/json',
 assetRights:'application/json',reference:'image/png'};
const interiorMediaTypes={template:'application/json',pages:'application/json',font:'font/ttf',
 fontRights:'application/json',fontLicense:'text/plain',source:'application/zip',
 bookDetails:'application/json',regionalRightsEvidence:'text/plain'};
const directoryFlags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW;
const missingCodes=new Set(['ENOENT']);
const replacedDirectoryCodes=new Set(['ENOENT','ENOTEMPTY','EEXIST']);
const identity=stat=>`${stat.dev}:${stat.ino}`;
async function clearHeldDirectory(handle){
 const heldPath=`/proc/self/fd/${handle.fd}`;
 let names;
 try{names=await fs.readdir(heldPath);}catch(error){if(missingCodes.has(error.code))return;throw error;}
 for(const name of names){
  const entry=path.join(heldPath,name);
  let before;
  try{before=await fs.lstat(entry);}catch(error){if(missingCodes.has(error.code))continue;throw error;}
  if(!before.isDirectory()){
   try{await fs.unlink(entry);}catch(error){if(!missingCodes.has(error.code))throw error;}
   continue;
  }
  let child;
  try{child=await fs.open(entry,directoryFlags);}catch(error){
   if(missingCodes.has(error.code))continue;
   // A non-directory or symlink replacement is removed non-recursively. If it
   // changed back into a directory, leave it for the final fail-closed rmdir.
   if(error.code==='ENOTDIR'||error.code==='ELOOP'){
    try{await fs.unlink(entry);}catch(replacementError){
     if(!missingCodes.has(replacementError.code)&&replacementError.code!=='EISDIR'&&replacementError.code!=='EPERM')throw replacementError;
    }
    continue;
   }
   throw error;
  }
  let opened;
  try{opened=await child.stat();await clearHeldDirectory(child);}finally{await child.close();}
  let current;
  try{current=await fs.lstat(entry);}catch(error){if(missingCodes.has(error.code))continue;throw error;}
  if(identity(current)!==identity(opened))continue;
  try{await fs.rmdir(entry);}catch(error){if(!replacedDirectoryCodes.has(error.code))throw error;}
 }
}
function createWorkspaceCleanup(directory,handle,owned){
 let pending;
 return ()=>pending??=(async()=>{
  try{await clearHeldDirectory(handle);}finally{await handle.close();}
  let current;
  try{current=await fs.lstat(directory);}catch(error){if(missingCodes.has(error.code))return;throw error;}
  if(identity(current)!==identity(owned))return;
  // Never recurse through the pathname. A concurrent nonempty replacement
  // makes rmdir fail and is preserved.
  try{await fs.rmdir(directory);}catch(error){if(!replacedDirectoryCodes.has(error.code))throw error;}
 })();
}
function snapshotEvaluatorIds(value){
 try{
  if(!Array.isArray(value)||utilTypes.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype)throw Error();
  const length=Object.getOwnPropertyDescriptor(value,'length'),keys=Reflect.ownKeys(value);
  if(!Object.hasOwn(length||{},'value')||!Number.isInteger(length.value)||length.value<0||
   length.value>100||keys.length!==length.value+1||keys.some(key=>typeof key!=='string'))throw Error();
  const result=[];
  for(let index=0;index<length.value;index++){
   const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')||!validOpaqueText(descriptor.value))throw Error();
   result.push(descriptor.value);
  }
  return Object.freeze(result);
 }catch{throw Error('TASK_EVALUATORS_INVALID');}
}
function requiredMediaTypes(task){
 const expected=new Map();
 const bind=(name,mediaType)=>{
  const prior=expected.get(name);
  if(prior&&prior!==mediaType)throw Error('TASK_MEDIA_TYPE_INVALID');
  expected.set(name,mediaType);
 };
 for(const [role,mediaType] of Object.entries(roleMediaTypes))bind(task[role],mediaType);
 if(Object.hasOwn(task,'templateSource'))bind(task.templateSource,'application/zip');
 if(task.interior)for(const role of interiorRoles)bind(task.interior[role],interiorMediaTypes[role]);
 return expected;
}
export function validateTask(task){
 if(task?.schema_version!==1||!task.files||typeof task.files!=='object'||Array.isArray(task.files))throw Error('TASK_INVALID');
 const entries=Object.entries(task.files);
 if(!entries.length||entries.length>32||entries.some(([name,sha])=>!/^[-a-zA-Z0-9_.]{1,100}$/.test(name)||name==='.'||name==='..'||
  outputNames.has(name.toLowerCase())||typeof sha!=='string'||!hash.test(sha)))throw Error('TASK_FILES_INVALID');
 if(!validOpaqueText(task.templateScope?.product,{maxLength:128})||
  typeof task.templateScope?.country!=='string'||!/^[A-Z]{2}$/.test(task.templateScope.country))throw Error('TASK_TEMPLATE_SCOPE_REQUIRED');
 const roles=['source','template','textLayers','assetRights','reference'];
 const has=n=>typeof n==='string'&&Object.hasOwn(task.files,n);
 if(roles.some(role=>!has(task[role])))throw Error('TASK_ROLE_INVALID');
 if(Object.hasOwn(task,'templateSource')&&!has(task.templateSource))throw Error('TASK_ROLE_INVALID');
 if(Object.hasOwn(task,'interior')&&(!task.interior||typeof task.interior!=='object'||Array.isArray(task.interior)||
  Object.keys(task.interior).length!==interiorRoles.length||
  interiorRoles.some(role=>!Object.hasOwn(task.interior,role)||!has(task.interior[role]))))throw Error('TASK_INTERIOR_INVALID');
 requiredMediaTypes(task);
 return task;
}
export function createStoredTaskResolvers(db,{store=new ArtifactStore(db),approvedEvaluators=[],approvedEditorialEvaluators=[],env=process.env,fetchImpl=fetch}={}){
 const evaluatorIds=snapshotEvaluatorIds(approvedEvaluators);
 const editorialEvaluatorIds=snapshotEvaluatorIds(approvedEditorialEvaluators);
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
   const mediaTypes=requiredMediaTypes(task);
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cyzor-pod-'));
   let workspace,owned,workspaceRoot;
   try{
    workspace=await fs.open(directory,directoryFlags);owned=await workspace.stat();
    workspaceRoot=`/proc/self/fd/${workspace.fd}`;
    const alias=await fs.stat(workspaceRoot);
    if(!alias.isDirectory()||identity(alias)!==identity(owned))throw Error('TASK_WORKSPACE_INVALID');
   }catch{
    try{await workspace?.close();}catch{}
    if(owned)try{
     const current=await fs.lstat(directory);
     if(identity(current)===identity(owned))await fs.rmdir(directory);
    }catch{}
    throw Error('TASK_WORKSPACE_INVALID');
   }
   const cleanup=createWorkspaceCleanup(directory,workspace,owned);
   try{
    active();
    let total=0;
    for(const [name,sha] of Object.entries(task.files)){
     const artifact=await store.get(sha);active();
     const expected=mediaTypes.get(name);
     if(expected&&artifact.media_type!==expected)throw Error('TASK_MEDIA_TYPE_INVALID');
     total+=artifact.body.length;
     if(total>64*1024*1024)throw Error('TASK_BUDGET_EXCEEDED');
     await fs.writeFile(path.join(workspaceRoot,name),artifact.body,{flag:'wx',mode:0o600});
     active();
    }
    const resolved={rights_verified:true,assetRoot:workspaceRoot,output:path.join(workspaceRoot,'package'),
     qaOutput:path.join(workspaceRoot,'qa.json'),qaSignedOutput:path.join(workspaceRoot,'qa-signed.json'),
     stageWorkspace:Object.freeze({fd:workspace.fd,root:workspaceRoot}),
     approvedEvaluators:evaluatorIds,approvedEditorialEvaluators:editorialEvaluatorIds,cleanup,
     templateScope:{product:task.templateScope.product,country:task.templateScope.country}};
    for(const role of ['source','template','textLayers','assetRights','reference'])resolved[role]=path.join(workspaceRoot,task[role]);
    if(Object.hasOwn(task,'templateSource'))resolved.templateSource=path.join(workspaceRoot,task.templateSource);
    if(task.interior)resolved.interior=Object.fromEntries(interiorRoles.map(role=>[role,path.join(workspaceRoot,task.interior[role])]));
    // New packages await a hash-bound external QA review; no preapproved future bytes.
    return resolved;
   }catch(e){await cleanup();throw e;}
  }
 };
}
