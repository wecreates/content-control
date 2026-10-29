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
import {validOpaqueText} from '../integrations/pod/text-identity.mjs';
import {types as utilTypes} from 'node:util';

function snapshotData(value){
 try{
  const state={nodes:0};
  const copy=(item,depth)=>{
   if(depth>64||++state.nodes>10000)throw Error();
   if(item===null||typeof item==='string'||typeof item==='boolean')return item;
   if(typeof item==='number'){
    if(!Number.isFinite(item)||(Number.isInteger(item)&&!Number.isSafeInteger(item)))throw Error();
    return item;
   }
   if(typeof item!=='object'||utilTypes.isProxy(item))throw Error();
   const prototype=Object.getPrototypeOf(item),keys=Reflect.ownKeys(item);
   if(Array.isArray(item)){
    const length=Object.getOwnPropertyDescriptor(item,'length');
    if(prototype!==Array.prototype||!Object.hasOwn(length||{},'value')||
     !Number.isInteger(length.value)||length.value<0||length.value>10000||keys.length!==length.value+1)throw Error();
    const result=[];
    for(let index=0;index<length.value;index++){
     const descriptor=Object.getOwnPropertyDescriptor(item,String(index));
     if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error();
     result.push(copy(descriptor.value,depth+1));
    }
    return result;
   }
   if(prototype!==Object.prototype||keys.length>10000||keys.some(key=>typeof key!=='string'))throw Error();
   const result={};
   for(const key of keys){
    const descriptor=Object.getOwnPropertyDescriptor(item,key);
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error();
    Object.defineProperty(result,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});
   }
   return result;
  };
  return copy(value,0);
 }catch{return null;}
}
const CLAIMED_PRODUCTION_FIELDS=Object.freeze(['id','account_id','platform','fencing_token','brief']);
function validFencingToken(value){
 if(Number.isSafeInteger(value))return value>0;
 if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value))return false;
 return value.length<19||value<='9223372036854775807';
}
function snapshotClaimedProduction(value){
 try{
  if(value===null||typeof value!=='object'||Array.isArray(value)||utilTypes.isProxy(value)||
   Object.getPrototypeOf(value)!==Object.prototype)return null;
  const result={};
  for(const key of CLAIMED_PRODUCTION_FIELDS){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return null;
   Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
  }
  const snapshot=snapshotData(result);
  if(!snapshot||typeof snapshot.id!=='string'||typeof snapshot.account_id!=='string'||
   typeof snapshot.platform!=='string'||!validFencingToken(snapshot.fencing_token)||
   snapshot.brief===null||typeof snapshot.brief!=='object'||
   Array.isArray(snapshot.brief))return null;
  return snapshot;
 }catch{return null;}
}
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  let current=target;
  while(current!==null){
   if(utilTypes.isProxy(current))return {valid:false};
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(descriptor)return Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
   current=Object.getPrototypeOf(current);
  }
  return {valid:true,value:undefined};
 }catch{return {valid:false};}
}
function taskEvaluatorIds(task,key){
 const capability=dataProperty(task,key);
 if(!capability.valid)return null;
 const snapshot=snapshotData(capability.value===undefined?[]:capability.value);
 if(!Array.isArray(snapshot)||snapshot.length>100||
  snapshot.some(id=>!validOpaqueText(id)))return null;
 return Object.freeze(snapshot);
}
function snapshotReviewAttestation(value){
 const snapshot=snapshotData(value);
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
 const keys=Object.keys(snapshot),allowed=new Set(['rights','competitive','editorial']);
 if(keys.length<2||keys.length>3||keys.some(key=>!allowed.has(key))||
  !Object.hasOwn(snapshot,'rights')||!Object.hasOwn(snapshot,'competitive')||
  !validOpaqueText(snapshot.rights,{maxLength:4096})||
  !validOpaqueText(snapshot.competitive,{maxLength:4096})||
  (Object.hasOwn(snapshot,'editorial')&&!validOpaqueText(snapshot.editorial,{maxLength:4096})))return null;
 return Object.freeze(snapshot);
}
function snapshotStageEnvironment(env){
 try{
  if(env===null||typeof env!=='object'||utilTypes.isProxy(env))return null;
  const keys=Reflect.ownKeys(env);
  if(keys.length>10000||keys.some(key=>typeof key!=='string'))return null;
  const result=Object.create(null);
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(env,key);
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return null;
   if(descriptor.value===undefined)continue;
   if(typeof descriptor.value!=='string')return null;
   Object.defineProperty(result,key,{value:descriptor.value,enumerable:true});
  }
  return Object.freeze(result);
 }catch{return null;}
}
function productionDatabaseReceiver(db){
 try{
  const transaction=dataProperty(db,'tx'),active=dataProperty(db,'active'),pool=dataProperty(db,'pool'),
   qaKey=dataProperty(db,'qaKey'),expiresAt=dataProperty(db,'expiresAt');
  if([transaction,active,pool,qaKey,expiresAt].some(capability=>!capability.valid))return null;
  const poolConnect=pool.value===undefined||pool.value===null?
   {valid:true,value:undefined}:dataProperty(pool.value,'connect');
  if(!poolConnect.valid)return null;
  const receiver=Object.create(db);
  const poolCapability=typeof poolConnect.value==='function'?
   Object.freeze(Object.assign(Object.create(null),{
    connect:(...args)=>Reflect.apply(poolConnect.value,pool.value,args)
   })):pool.value;
  const boundTransaction=typeof transaction.value==='function'?
   (...args)=>Reflect.apply(transaction.value,receiver,args):transaction.value;
  const boundActive=typeof active.value==='function'?
   (...args)=>Reflect.apply(active.value,receiver,args):active.value;
  Object.defineProperties(receiver,{
   tx:{value:boundTransaction},active:{value:boundActive},pool:{value:poolCapability},
   qaKey:{value:qaKey.value},expiresAt:{value:expiresAt.value}
  });
  return Object.freeze(receiver);
 }catch{return null;}
}
export async function produceOnce({db,resolveTask,resolveGrant,upstreamKey,root=process.cwd(),env=process.env,signal}){
 if(env.POD_PRODUCTION_ENABLED!=='true')return {status:'DISABLED'};
 if(signal?.aborted)return {status:'STOPPED'};
 // Bind the complete data-only child environment before claim, grant and task
 // callbacks can replace an interpreter, signing key or stage configuration.
 // The enabled flag below remains a live stop control on the caller-owned object.
 const stageEnv=snapshotStageEnvironment(env);
 if(!stageEnv)throw Error('PRODUCTION_ENVIRONMENT_UNVERIFIED');
 const rightsKey=stageEnv.POD_RIGHTS_KEY,templateKey=stageEnv.POD_TEMPLATE_KEY;
 const budgetBytes=artifactBudgetBytes(stageEnv);
 // Bind every production database endpoint and its receiver dependencies before
 // the caller-owned claim wait can replace any durable guard or settlement path.
 const databaseReceiver=productionDatabaseReceiver(db);
 const claimCapability=dataProperty(db,'claimProduction'),assertCapability=dataProperty(db,'assertProducible'),
  failCapability=dataProperty(db,'failProduction'),holdCapability=dataProperty(db,'holdProduction'),
  completeCapability=dataProperty(db,'completeProduction');
 if(!databaseReceiver||[claimCapability,assertCapability,failCapability,holdCapability,completeCapability]
  .some(capability=>!capability.valid)||typeof claimCapability.value!=='function')
  throw Error('PRODUCTION_DATABASE_UNVERIFIED');
 const claimProduction=claimCapability.value,assertProducible=assertCapability.value,
  failProduction=failCapability.value,holdProduction=holdCapability.value,
  completeProduction=completeCapability.value;
 const store=new ArtifactStore(databaseReceiver,{budgetBytes});
 const claimedJob=await Reflect.apply(claimProduction,databaseReceiver,[]);
 if(!claimedJob)return {status:signal?.aborted||env.POD_PRODUCTION_ENABLED!=='true'?'STOPPED':'IDLE'};
 // Preserve the exact fenced identity before authority, task or database callbacks
 // can retain and mutate caller-visible objects.
 const job=snapshotClaimedProduction(claimedJob);
 if(!job)throw Error('PRODUCTION_SETTLEMENT_UNCERTAIN');
 const jobCopy=()=>snapshotClaimedProduction(job)??(()=>{throw Error('PRODUCTION_SETTLEMENT_UNCERTAIN');})();
 let task,cleanupTask;
 const enabled=()=>{if(env.POD_PRODUCTION_ENABLED!=='true'||signal?.aborted)throw Error('PRODUCTION_STOPPED');};
 const authorizeProduction=async()=>{
  enabled();
  const envelope=await resolveGrant(jobCopy(),{signal});
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  await Reflect.apply(assertProducible,databaseReceiver,[jobCopy()]);
  // Local lock waits must not extend upstream authority or ignore cancellation.
  enforceBrief(verifyEnvelope(envelope,upstreamKey,'content-control:pod'),job.brief);
  enabled();
  return envelope;
 };
 let result,primaryError;
 try{result=await (async()=>{
 try{
  enabled();
  const grant=verifyEnvelope(await resolveGrant(jobCopy(),{signal}),upstreamKey,'content-control:pod');
  enabled();
  enforceBrief(grant,job.brief);
  // Resolver owns paths/templates/rights. Never construct command arguments from arbitrary request fields.
  task=await resolveTask(jobCopy(),{signal});
  enabled();
  if(!task)throw Error('RIGHTS_BLOCKED');
  // Cleanup is a resolver-authorized lifecycle capability. Bind its data
  // descriptor before validation or production callbacks can replace the task
  // member, while preserving cleanup for later rights-validation failures.
  const cleanupCapability=dataProperty(task,'cleanup');
  if(!cleanupCapability.valid)throw Error('TASK_CLEANUP_INVALID');
  cleanupTask=cleanupCapability.value;
  if(task.rights_verified!==true)throw Error('RIGHTS_BLOCKED');
  // Bind the resolver-authorized reviewer identities before grant, database or
  // independent-review callbacks can replace the task's allowlists.
  const approvedEvaluators=taskEvaluatorIds(task,'approvedEvaluators');
  const approvedEditorialEvaluators=taskEvaluatorIds(task,'approvedEditorialEvaluators');
  if(!approvedEvaluators||!approvedEditorialEvaluators)throw Error('TASK_EVALUATORS_INVALID');
  const runStage=(script,args)=>python(script,args,{root,signal,env:stageEnv,workspace:task.stageWorkspace});
  const {sourceSha256,textLayers}=await verifyProductionSourceEvidence(
   task.source,task.assetRights,task.textLayers,rightsKey,{signal});
  enabled();
  // Scope comes from the hash-bound descriptor; signatures alone do not establish
  // official provenance or authorize a different product/country/platform.
  const scope={...task.templateScope,platform:job.brief.platform};
  const coverEnvelope=await readSignedJSONFile(task.template,{signal});
  enabled();
  const cover=validateTemplate(coverEnvelope,templateKey,scope);
  let interiorTemplate;
  if(job.brief.platform==='kdp'){
   if(!task.interior)throw Error('INTERIOR_REQUIRED');
   if(!task.interior.bookDetails)throw Error('KDP_BOOK_DETAILS_REQUIRED');
   const interiorEnvelope=await readSignedJSONFile(task.interior.template,{signal});
   enabled();
   const interior=validateInteriorTemplate(interiorEnvelope,templateKey,scope);
   interiorTemplate=interior;
   const profile=kdpCalculatorProfile(cover,interior);
   const sourceHash=verifyEnvelope(coverEnvelope,templateKey,'pod:template').source_sha256;
   await verifyTemplateSource(task.templateSource,
    sourceHash,{signal});
   await authorizeProduction();
   // Re-read/hash the retained ZIP inside the bounded child, then check its
   // members and guide against the authenticated profile before rendering.
   await runStage('pod_kdp_template_import.py',['--archive',task.templateSource,
    '--profile-json',JSON.stringify(profile),'--expected-sha256',sourceHash]);
   enabled();
   const interiorRecord=verifyEnvelope(interiorEnvelope,templateKey,'pod:interior-template');
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
  enabled();
  if(job.brief.platform==='kdp'){
   await authorizeProduction();
   await runStage('pod_book_package.py',['--package-dir',task.output,'--template',task.interior.template,
    '--pages',task.interior.pages,'--font',task.interior.font]);
   enabled();
  }
  // Competitive reviewer must inspect the NEW package; it cannot preapprove unknown future bytes.
  const {manifest,artifacts}=await readPackageSnapshot(task.output,
   {platform:job.brief.platform,template:cover,interiorTemplate,sourceSha256,textLayers},
   {platform:job.brief.platform},{beforeArtifacts:authorizeProduction});
  // Persist exact package bytes before marking the job complete. Never rely on Render's local disk.
  await authorizeProduction();
  await store.putMany(artifacts);
  const reviewGrant=await authorizeProduction();
  const reviewCapability=dataProperty(task,'reviewPackage');
  if(!reviewCapability.valid)throw Error('TASK_REVIEWER_INVALID');
  const reviewPackage=reviewCapability.value;
  if(typeof reviewPackage!=='function'){
   // A review hold is durable package exposure. Database lease and rights locks
   // can wait after the grant lookup, so revalidate that exact grant and the
   // local stop boundary at the final pre-write hook without external I/O.
   const beforeStateChange=()=>{
    enabled();
    enforceBrief(verifyEnvelope(reviewGrant,upstreamKey,'content-control:pod'),job.brief);
   };
   await Reflect.apply(holdProduction,databaseReceiver,[jobCopy(),manifest,{beforeStateChange}]);
   return {status:'REVIEW_REQUIRED',job_id:job.id,package_sha256:manifest.package_sha256};
  }
  // Bind every resolver-authorized QA input before the caller-owned reviewer can
  // retain and mutate the task object. The live publication and cancellation
  // controls remain outside this snapshot and are rechecked at each boundary.
  const qaInterior=job.brief.platform==='kdp'?Object.freeze({
   template:task.interior.template,source:task.interior.source,pages:task.interior.pages,
   font:task.interior.font,fontRights:task.interior.fontRights,fontLicense:task.interior.fontLicense,
   bookDetails:task.interior.bookDetails,regionalRightsEvidence:task.interior.regionalRightsEvidence
  }):undefined;
  const qaTask=Object.freeze({
   output:task.output,reference:task.reference,qaOutput:task.qaOutput,qaSignedOutput:task.qaSignedOutput,
   source:task.source,assetRights:task.assetRights,textLayers:task.textLayers,assetRoot:task.assetRoot,
   template:task.template,templateSource:task.templateSource,stageWorkspace:task.stageWorkspace,
   interior:qaInterior
  });
  let reviewResult;
  try{reviewResult=await Reflect.apply(reviewPackage,task,[manifest,{signal,
   ...(job.brief.platform==='kdp'?{manuscript:qaInterior.pages,bookDetails:qaInterior.bookDetails}:{})}]);}
  catch(error){enabled();throw error;}
  // A cooperative reviewer can stop its own I/O. Await settlement before cleanup
  // and reject late results before inspecting or snapshotting its response.
  enabled();
  const attestation=snapshotReviewAttestation(reviewResult);
  if(!attestation)throw Error('REVIEW_ATTESTATION_INVALID');
  const args=['--package-dir',qaTask.output,'--reference',qaTask.reference,'--rights',attestation.rights,
   '--competitive-review',attestation.competitive,'--output',qaTask.qaOutput,'--signed-output',qaTask.qaSignedOutput,
   '--source',qaTask.source,'--asset-rights',qaTask.assetRights,'--text-layers',qaTask.textLayers];
  if(qaTask.assetRoot)args.push('--asset-root',qaTask.assetRoot);
  if(job.brief.platform==='kdp')args.push('--country',scope.country,'--product',scope.product,
   '--cover-template',qaTask.template,'--interior-template',qaInterior.template,'--template-source',qaTask.templateSource,
   '--interior-template-source',qaInterior.source,
   '--manuscript',qaInterior.pages,'--font',qaInterior.font,
   '--font-rights',qaInterior.fontRights,'--font-license',qaInterior.fontLicense,
   '--book-details',qaInterior.bookDetails,
   '--regional-rights-evidence',qaInterior.regionalRightsEvidence);
  for(const id of approvedEvaluators)args.push('--approved-evaluator',id);
  if(attestation.editorial)args.push('--editorial-review',attestation.editorial);
  for(const id of approvedEditorialEvaluators)args.push('--approved-editorial-evaluator',id);
  // A failed QA process still emits a signed FAIL when signing is available.
  await authorizeProduction();
  let qaProcessFailed=false;
  try{await python('pod_vision_qa.py',args,{root,signal,env:stageEnv,workspace:qaTask.stageWorkspace});}catch(error){
   if(error.message!=='PYTHON_STAGE_FAILED')throw error;
   qaProcessFailed=true;
  }
  enabled();
  // Re-reading the live descriptor preserves the stop/mutation boundary while
  // refusing to consume a reviewer-replaced output path.
  const currentQaSignedOutput=task.qaSignedOutput;
  enabled();
  if(currentQaSignedOutput!==qaTask.qaSignedOutput)throw Error('TASK_QA_INPUTS_CHANGED');
  const qa=await readSignedJSONFile(qaTask.qaSignedOutput,{signal});
  enabled();
  // Nonzero exits may preserve a signed FAIL for diagnosis, never a PASS.
  // completeProduction still authenticates the envelope before persisting it.
  if(qaProcessFailed){
   let verdict;
   try{verdict=parseSignedJSON(qa.payload)?.verdict;}catch{}
   if(verdict!=='FAIL')throw Error('QA_PROCESS_RESULT_CONFLICT');
  }
  const completionGrant=await authorizeProduction();
  // Database locking and live-rights checks can wait after the last grant
  // lookup. Recheck the local stop boundary and that exact signed grant's
  // current lifetime and scope inside the completion transaction, immediately
  // before it changes durable QA state. Do not perform external authority I/O
  // while holding the production lease and rights locks.
  const beforeStateChange=()=>{
   enabled();
   enforceBrief(verifyEnvelope(completionGrant,upstreamKey,'content-control:pod'),job.brief);
  };
  const result=await Reflect.apply(completeProduction,databaseReceiver,[jobCopy(),manifest,qa,{beforeStateChange}]);
  return {status:result.pass?'QA_PASSED':'QA_FAILED',job_id:job.id};
 }catch(error){
  const reason=productionFailure(error);
  await Reflect.apply(failProduction,databaseReceiver,[jobCopy(),reason]);
  return {status:'BLOCKED',job_id:job.id,reason_code:reason};
 }
 })();}catch(error){primaryError=error;}
 let cleanupFailed=false;
 if(cleanupTask)try{
  if(typeof cleanupTask!=='function')throw Error('TASK_CLEANUP_INVALID');
  await Reflect.apply(cleanupTask,task,[]);
 }catch{cleanupFailed=true;}
 if(primaryError)throw primaryError;
 return cleanupFailed?{...result,cleanup_failed:true}:result;
}

