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
 // Bind signature authorities before claim, grant and task callbacks can mutate
 // the caller-owned environment. The enabled flag remains a live stop control.
 const rightsKey=env.POD_RIGHTS_KEY,templateKey=env.POD_TEMPLATE_KEY;
 const budgetBytes=artifactBudgetBytes(env);
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
 let task;
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
  if(!task||task.rights_verified!==true)throw Error('RIGHTS_BLOCKED');
  const runStage=(script,args)=>python(script,args,{root,signal,env,workspace:task.stageWorkspace});
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
  if(typeof task.reviewPackage!=='function'){
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
  enabled();
  const qa=await readSignedJSONFile(task.qaSignedOutput,{signal});
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
 if(task?.cleanup)try{await task.cleanup();}catch{cleanupFailed=true;}
 if(primaryError)throw primaryError;
 return cleanupFailed?{...result,cleanup_failed:true}:result;
}

