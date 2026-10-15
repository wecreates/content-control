import {runPythonStage as python} from '../integrations/pod/python-stage.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import fs from 'node:fs/promises';
import {verifyEnvelope,enforceBrief} from '../integrations/pod/policy.mjs';
import {validateTemplate,validateInteriorTemplate} from '../integrations/pod/templates.mjs';
export async function produceOnce({db,resolveTask,resolveGrant,upstreamKey,root=process.cwd(),env=process.env,signal}){
 if(env.POD_PRODUCTION_ENABLED!=='true')return {status:'DISABLED'};
 if(signal?.aborted)return {status:'STOPPED'};
 const job=await db.claimProduction();if(!job)return {status:'IDLE'};
 let task;
 const authorizeProduction=async()=>{
  const enabled=()=>{if(env.POD_PRODUCTION_ENABLED!=='true'||signal?.aborted)throw Error('PRODUCTION_STOPPED');};
  enabled();
  const envelope=await resolveGrant(job,{signal});
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  await db.assertProducible(job);
  // Local lock waits must not extend upstream authority or ignore cancellation.
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  enabled();
 };
 try{
  const grant=verifyEnvelope(await resolveGrant(job,{signal}),upstreamKey,'content-control:pod');
  enforceBrief(grant,job.brief);
  // Resolver owns paths/templates/rights. Never construct command arguments from arbitrary request fields.
  task=await resolveTask(job);
  if(!task||task.rights_verified!==true)throw Error('RIGHTS_BLOCKED');
  // Scope comes from the hash-bound descriptor; signatures alone do not establish
  // official provenance or authorize a different product/country/platform.
  const scope={...task.templateScope,platform:job.brief.platform};
  validateTemplate(JSON.parse(await fs.readFile(task.template,'utf8')),env.POD_TEMPLATE_KEY,scope);
  if(job.brief.platform==='kdp'){
   if(!task.interior)throw Error('INTERIOR_REQUIRED');
   validateInteriorTemplate(JSON.parse(await fs.readFile(task.interior.template,'utf8')),env.POD_TEMPLATE_KEY,scope);
  }
  await authorizeProduction();
  await python('pod_asset_generator.py',['--source',task.source,'--template',task.template,
   '--text-layers',task.textLayers,'--rights',task.assetRights,'--output-dir',task.output,...(task.assetRoot?['--asset-root',task.assetRoot]:[])],{root,signal,env});
  if(job.brief.platform==='kdp'){
   await authorizeProduction();
   await python('pod_book_package.py',['--package-dir',task.output,'--template',task.interior.template,
    '--pages',task.interior.pages,'--font',task.interior.font],{root,signal,env});
  }
  // Competitive reviewer must inspect the NEW package; it cannot preapprove unknown future bytes.
  const manifest=JSON.parse(await fs.readFile(path.join(task.output,'manifest.json'),'utf8'));
  // Persist exact package bytes before marking the job complete. Never rely on Render's local disk.
  await authorizeProduction();
  const store=new ArtifactStore(db);
  for(const [name,sha] of Object.entries(manifest.files)){
   const base=await fs.realpath(task.output),file=await fs.realpath(path.resolve(base,name));
   if(!file.startsWith(base+path.sep))throw Error('ARTIFACT_PATH_INVALID');
   const body=await fs.readFile(file);
   if(crypto.createHash('sha256').update(body).digest('hex')!==sha)throw Error('ARTIFACT_HASH_MISMATCH');
   await store.put(body,name.endsWith('.pdf')?'application/pdf':name.endsWith('.json')?'application/json':'image/png');
  }
  await authorizeProduction();
  if(typeof task.reviewPackage!=='function'){
   await db.holdProduction(job,manifest);
   return {status:'REVIEW_REQUIRED',job_id:job.id,package_sha256:manifest.package_sha256};
  }
  const attestation=await task.reviewPackage(manifest);
  const args=['--package-dir',task.output,'--reference',task.reference,'--rights',attestation.rights,
   '--competitive-review',attestation.competitive,'--output',task.qaOutput,'--signed-output',task.qaSignedOutput];
  for(const id of task.approvedEvaluators||[])args.push('--approved-evaluator',id);
  // A failed QA process still emits a signed FAIL when signing is available.
  await authorizeProduction();
  let qaProcessFailed=false;
  try{await python('pod_vision_qa.py',args,{root,signal,env});}catch(error){
   if(error.message!=='PYTHON_STAGE_FAILED')throw error;
   qaProcessFailed=true;
  }
  const qa=JSON.parse(await fs.readFile(task.qaSignedOutput,'utf8'));
  // Nonzero exits may preserve a signed FAIL for diagnosis, never a PASS.
  // completeProduction still authenticates the envelope before persisting it.
  if(qaProcessFailed&&JSON.parse(qa.payload).verdict!=='FAIL')throw Error('QA_PROCESS_RESULT_CONFLICT');
  await authorizeProduction();
  const result=await db.completeProduction(job,manifest,qa);
  return {status:result.pass?'QA_PASSED':'QA_FAILED',job_id:job.id};
 }catch{
  await db.failProduction(job,'PRODUCTION_BLOCKED');
  return {status:'BLOCKED',job_id:job.id};
 }finally{if(task?.cleanup)await task.cleanup();}
}
