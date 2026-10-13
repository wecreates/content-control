import {spawn} from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import fs from 'node:fs/promises';
import {verifyEnvelope,enforceBrief} from '../integrations/pod/policy.mjs';
async function python(script,args,{root,signal,env=process.env}){
 return new Promise((resolve,reject)=>{
  const child=spawn(env.POD_PYTHON||'python3',[path.join(root,'scripts',script),...args],
   {cwd:root,env,signal,stdio:['ignore','pipe','pipe']});
  let size=0,output='';
  let forceTimer;
  const timer=setTimeout(()=>{child.kill('SIGTERM');forceTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},8*60*1000);
  child.stdout.on('data',b=>{size+=b.length;if(size>1024*1024)child.kill('SIGTERM');else output+=b;});
  child.stderr.on('data',()=>{}); // Do not leak signed inputs, model paths or credentials into logs.
  child.on('error',e=>{clearTimeout(timer);clearTimeout(forceTimer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);clearTimeout(forceTimer);if(code===0)resolve(output);else reject(Error('PYTHON_STAGE_FAILED'));});
 });
}
export async function produceOnce({db,resolveTask,resolveGrant,upstreamKey,root=process.cwd(),env=process.env,signal}){
 if(env.POD_PRODUCTION_ENABLED!=='true')return {status:'DISABLED'};
 if(signal?.aborted)return {status:'STOPPED'};
 const job=await db.claimProduction();if(!job)return {status:'IDLE'};
 try{
  const grant=verifyEnvelope(await resolveGrant(job),upstreamKey,'content-control:pod');
  enforceBrief(grant,job.brief);
  // Resolver owns paths/templates/rights. Never construct command arguments from arbitrary request fields.
  const task=await resolveTask(job);
  if(!task||task.rights_verified!==true)throw Error('RIGHTS_BLOCKED');
  await python('pod_asset_generator.py',['--source',task.source,'--template',task.template,
   '--text-layers',task.textLayers,'--rights',task.assetRights,'--output-dir',task.output],{root,signal,env});
  if(job.brief.platform==='kdp'){
   if(!task.interior)throw Error('INTERIOR_REQUIRED');
   await python('pod_book_package.py',['--package-dir',task.output,'--template',task.interior.template,
    '--pages',task.interior.pages,'--font',task.interior.font],{root,signal,env});
  }
  // Competitive reviewer must inspect the NEW package; it cannot preapprove unknown future bytes.
  const manifest=JSON.parse(await fs.readFile(path.join(task.output,'manifest.json'),'utf8'));
  const attestation=await task.reviewPackage(manifest);
  const args=['--package-dir',task.output,'--reference',task.reference,'--rights',attestation.rights,
   '--competitive-review',attestation.competitive,'--output',task.qaOutput,'--signed-output',task.qaSignedOutput];
  for(const id of task.approvedEvaluators||[])args.push('--approved-evaluator',id);
  // A failed QA process still emits a signed FAIL when signing is available.
  try{await python('pod_vision_qa.py',args,{root,signal,env});}catch{}
  const qa=JSON.parse(await fs.readFile(task.qaSignedOutput,'utf8'));
  // Persist exact package bytes before marking the job complete. Never rely on Render's local disk.
  const store=new ArtifactStore(db);
  for(const [name,sha] of Object.entries(manifest.files)){
   const base=await fs.realpath(task.output),file=await fs.realpath(path.resolve(base,name));
   if(!file.startsWith(base+path.sep))throw Error('ARTIFACT_PATH_INVALID');
   const body=await fs.readFile(file);
   if(crypto.createHash('sha256').update(body).digest('hex')!==sha)throw Error('ARTIFACT_HASH_MISMATCH');
   await store.put(body,name.endsWith('.pdf')?'application/pdf':name.endsWith('.json')?'application/json':'image/png');
  }
  const result=await db.completeProduction(job,manifest,qa);
  return {status:result.pass?'QA_PASSED':'QA_FAILED',job_id:job.id};
 }catch{
  await db.failProduction(job,'PRODUCTION_BLOCKED');
  return {status:'BLOCKED',job_id:job.id};
 }
}
