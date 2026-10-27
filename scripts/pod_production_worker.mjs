import {runPythonStage as python} from '../integrations/pod/python-stage.mjs';
import {ArtifactStore} from '../integrations/pod/artifacts.mjs';
import {artifactBudgetBytes} from '../integrations/pod/storage-budget.mjs';
import {readPackageSnapshot} from '../integrations/pod/package-artifacts.mjs';
import {verifyEnvelope,enforceBrief} from '../integrations/pod/policy.mjs';
import {readSignedJSONFile} from '../integrations/pod/signed-file.mjs';
import {validateTemplate,validateInteriorTemplate,kdpCalculatorProfile} from '../integrations/pod/templates.mjs';
import {productionFailure} from '../integrations/pod/failure-reasons.mjs';
import {verifyTemplateSource} from '../integrations/pod/template-source.mjs';
import {verifyProductionSourceEvidence} from '../integrations/pod/source-evidence.mjs';
import {parseSignedJSON} from '../integrations/pod/signed-json.mjs';
export async function produceOnce({db,resolveTask,resolveGrant,upstreamKey,root=process.cwd(),env=process.env,signal}){
 if(env.POD_PRODUCTION_ENABLED!=='true')return {status:'DISABLED'};
 if(signal?.aborted)return {status:'STOPPED'};
 const store=new ArtifactStore(db,{budgetBytes:artifactBudgetBytes(env)});
 const job=await db.claimProduction();if(!job)return {status:signal?.aborted||env.POD_PRODUCTION_ENABLED!=='true'?'STOPPED':'IDLE'};
 let task;
 const enabled=()=>{if(env.POD_PRODUCTION_ENABLED!=='true'||signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 const authorizeProduction=async()=>{
  enabled();
  const envelope=await resolveGrant(job,{signal});
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  await db.assertProducible(job);
  // Local lock waits must not extend upstream authority or ignore cancellation.
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  enabled();
 };
 let result,primaryError;
 try{result=await (async()=>{
 try{
  enabled();
  const grant=verifyEnvelope(await resolveGrant(job,{signal}),upstreamKey,'content-control:pod');
  enabled();
  enforceBrief(grant,job.brief);
  // Resolver owns paths/templates/rights. Never construct command arguments from arbitrary request fields.
  task=await resolveTask(job,{signal});
  enabled();
  if(!task||task.rights_verified!==true)throw Error('RIGHTS_BLOCKED');
  const runStage=(script,args)=>python(script,args,{root,signal,env,workspace:task.stageWorkspace});
  const {sourceSha256,textLayers}=await verifyProductionSourceEvidence(
   task.source,task.assetRights,task.textLayers,env.POD_RIGHTS_KEY,{signal});
  enabled();
  // Scope comes from the hash-bound descriptor; signatures alone do not establish
  // official provenance or authorize a different product/country/platform.
  const scope={...task.templateScope,platform:job.brief.platform};
  const coverEnvelope=await readSignedJSONFile(task.template,{signal});
  enabled();
  const cover=validateTemplate(coverEnvelope,env.POD_TEMPLATE_KEY,scope);
  let interiorTemplate;
  if(job.brief.platform==='kdp'){
   if(!task.interior)throw Error('INTERIOR_REQUIRED');
   if(!task.interior.bookDetails)throw Error('KDP_BOOK_DETAILS_REQUIRED');
   const interiorEnvelope=await readSignedJSONFile(task.interior.template,{signal});
   const interior=validateInteriorTemplate(interiorEnvelope,env.POD_TEMPLATE_KEY,scope);
   interiorTemplate=interior;
   const profile=kdpCalculatorProfile(cover,interior);
   const sourceHash=verifyEnvelope(coverEnvelope,env.POD_TEMPLATE_KEY,'pod:template').source_sha256;
   await verifyTemplateSource(task.templateSource,
    sourceHash,{signal});
   await authorizeProduction();
   // Re-read/hash the retained ZIP inside the bounded child, then check its
   // members and guide against the authenticated profile before rendering.
   await runStage('pod_kdp_template_import.py',['--archive',task.templateSource,
    '--profile-json',JSON.stringify(profile),'--expected-sha256',sourceHash]);
   const interiorRecord=verifyEnvelope(interiorEnvelope,env.POD_TEMPLATE_KEY,'pod:interior-template');
   await verifyTemplateSource(task.interior.source,interiorRecord.source_sha256,{signal});
   await authorizeProduction();
   await runStage('pod_kdp_interior_template_import.py',[
    '--archive',task.interior.source,
    '--trim-width',String(interior.trim_inches[0]),
    '--trim-height',String(interior.trim_inches[1]),
    '--expected-sha256',interiorRecord.source_sha256,
    '--source-member',interiorRecord.source_member]);
  }
  await authorizeProduction();
  await runStage('pod_asset_generator.py',['--source',task.source,'--template',task.template,
   '--text-layers',task.textLayers,'--rights',task.assetRights,'--output-dir',task.output,...(task.assetRoot?['--asset-root',task.assetRoot]:[])]);
  if(job.brief.platform==='kdp'){
   await authorizeProduction();
   await runStage('pod_book_package.py',['--package-dir',task.output,'--template',task.interior.template,
    '--pages',task.interior.pages,'--font',task.interior.font]);
  }
  // Competitive reviewer must inspect the NEW package; it cannot preapprove unknown future bytes.
  const {manifest,artifacts}=await readPackageSnapshot(task.output,
   {platform:job.brief.platform,template:cover,interiorTemplate,sourceSha256,textLayers},
   {platform:job.brief.platform},{beforeArtifacts:authorizeProduction});
  // Persist exact package bytes before marking the job complete. Never rely on Render's local disk.
  await authorizeProduction();
  await store.putMany(artifacts);
  await authorizeProduction();
  if(typeof task.reviewPackage!=='function'){
   await db.holdProduction(job,manifest);
   return {status:'REVIEW_REQUIRED',job_id:job.id,package_sha256:manifest.package_sha256};
  }
  let attestation;
  try{attestation=await task.reviewPackage(manifest,{signal,
   ...(job.brief.platform==='kdp'?{manuscript:task.interior.pages,bookDetails:task.interior.bookDetails}:{})});}
  catch(error){enabled();throw error;}
  // A cooperative reviewer can stop its own I/O. Await settlement before cleanup
  // and reject late results before reading attestation paths or launching QA.
  enabled();
  const args=['--package-dir',task.output,'--reference',task.reference,'--rights',attestation.rights,
   '--competitive-review',attestation.competitive,'--output',task.qaOutput,'--signed-output',task.qaSignedOutput,
   '--source',task.source,'--asset-rights',task.assetRights,'--text-layers',task.textLayers];
  if(task.assetRoot)args.push('--asset-root',task.assetRoot);
  if(job.brief.platform==='kdp')args.push('--country',scope.country,'--product',scope.product,
   '--cover-template',task.template,'--interior-template',task.interior.template,'--template-source',task.templateSource,
   '--interior-template-source',task.interior.source,
   '--manuscript',task.interior.pages,'--font',task.interior.font,
   '--font-rights',task.interior.fontRights,'--font-license',task.interior.fontLicense,
   '--book-details',task.interior.bookDetails,
   '--regional-rights-evidence',task.interior.regionalRightsEvidence);
  for(const id of task.approvedEvaluators||[])args.push('--approved-evaluator',id);
  if(attestation.editorial)args.push('--editorial-review',attestation.editorial);
  for(const id of task.approvedEditorialEvaluators||[])args.push('--approved-editorial-evaluator',id);
  // A failed QA process still emits a signed FAIL when signing is available.
  await authorizeProduction();
  let qaProcessFailed=false;
  try{await runStage('pod_vision_qa.py',args);}catch(error){
   if(error.message!=='PYTHON_STAGE_FAILED')throw error;
   qaProcessFailed=true;
  }
  const qa=await readSignedJSONFile(task.qaSignedOutput,{signal});
  // Nonzero exits may preserve a signed FAIL for diagnosis, never a PASS.
  // completeProduction still authenticates the envelope before persisting it.
  if(qaProcessFailed){
   let verdict;
   try{verdict=parseSignedJSON(qa.payload)?.verdict;}catch{}
   if(verdict!=='FAIL')throw Error('QA_PROCESS_RESULT_CONFLICT');
  }
  await authorizeProduction();
  const result=await db.completeProduction(job,manifest,qa);
  return {status:result.pass?'QA_PASSED':'QA_FAILED',job_id:job.id};
 }catch(error){
  const reason=productionFailure(error);
  await db.failProduction(job,reason);
  return {status:'BLOCKED',job_id:job.id,reason_code:reason};
 }
 })();}catch(error){primaryError=error;}
 let cleanupFailed=false;
 if(task?.cleanup)try{await task.cleanup();}catch{cleanupFailed=true;}
 if(primaryError)throw primaryError;
 return cleanupFailed?{...result,cleanup_failed:true}:result;
}

