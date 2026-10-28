// Compatibility filename requested by the owner. No stealth or detection bypass.
import crypto from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {types as utilTypes} from 'node:util';
import {verifyEnvelope,enforceBrief,enforceQA} from '../integrations/pod/policy.mjs';
import {enforceKdpListPrice,enforceReleaseEconomics} from '../integrations/pod/economics.mjs';
import {validOpaqueText} from '../integrations/pod/text-identity.mjs';
function snapshotManifest(value){
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
const CLAIMED_RELEASE_FIELDS=Object.freeze(['id','platform','account_id','fencing_token','brief','manifest','qa_envelope','idempotency_key']);
function snapshotClaimedRelease(value){
 try{
  if(value===null||typeof value!=='object'||Array.isArray(value)||utilTypes.isProxy(value)||
   Object.getPrototypeOf(value)!==Object.prototype)return null;
  const result={};
  for(const key of CLAIMED_RELEASE_FIELDS){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))return null;
   Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
  }
  return snapshotManifest(result);
 }catch{return null;}
}
function providerReceiptId(receipt){
 try{
  if(receipt===null||typeof receipt!=='object'||Array.isArray(receipt)||utilTypes.isProxy(receipt))return null;
  const descriptor=Object.getOwnPropertyDescriptor(receipt,'id');
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')||!validOpaqueText(descriptor.value))return null;
  return descriptor.value;
 }catch{return null;}
}
export async function publishOnce({db,env=process.env,accountId,adapters={},resolveGrant,
 verifyArtifacts,upstreamKey,qaKey,log=console.log,signal}) {
 const publicationEnabled=()=>env.PUBLICATION_ENABLED==='true'&&env.POD_PUBLICATION_ENABLED==='true';
 if(signal?.aborted)return {status:'STOPPED'};
 // Dry run uses no leases, writes, artifact access, adapters or platform calls.
 if(!publicationEnabled()) {
  const jobs=await db.listReady();if(signal?.aborted)return {status:'STOPPED'};
  log(JSON.stringify({status:'DRY_RUN',count:jobs.length,publication_enabled:false}));
  return {status:'DRY_RUN',count:jobs.length};
 }
 if(typeof resolveGrant!=='function'||typeof verifyArtifacts!=='function')throw Error('PUBLISH_RESOLVERS_REQUIRED');
 const claimedJob=await db.claimPublish(accountId,crypto.randomInt(45,181));
 if(!claimedJob)return {status:signal?.aborted||!publicationEnabled()?'STOPPED':'IDLE'};
 // Preserve the exact release-critical queue identity before any caller-owned
 // verifier or authority resolver can retain and mutate the claimed row.
 let job=claimedJob;
 let submitted=false,submittedSettlementAttempted=false;
 try{
  const releaseSnapshot=snapshotClaimedRelease(claimedJob);
  if(!releaseSnapshot)throw Error('CLAIM_SNAPSHOT_INVALID');
  job=releaseSnapshot;
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  signal?.throwIfAborted();
  const adapter=adapters[job.platform];
  if(adapter?.authorized!==true||typeof adapter.submit!=='function')throw Error('ADAPTER_UNVERIFIED');
  // Bind the exact endpoint that passed authorization before any caller-owned
  // verifier, authority or database callback can replace adapter.submit.
  const adapterSubmit=adapter.submit;
  // Bind the exact local guard before caller-owned artifact or authority
  // callbacks can replace the lease/account/rights/fencing check.
  const assertPublishable=db.assertPublishable;
  if(typeof assertPublishable!=='function')throw Error('LOCAL_RELEASE_BLOCKED');
  const verifiedManifest=await verifyArtifacts(claimedJob); // Must hash all files and validate current template/rights/budget.
  // Carry one bounded JSON data snapshot across the remaining network/database
  // waits. A resolver-owned object must not change after artifact verification.
  const manifest=snapshotManifest(verifiedManifest);
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  if(!manifest||manifest.package_sha256!==job.manifest?.package_sha256||manifest.release_checks_passed!==true)throw Error('ARTIFACT_VERIFICATION_FAILED');
  signal?.throwIfAborted();
  // Artifact checks may outlive a grant or overlap revocation. Fetch authority
  // afterward, then recheck local lease/account/rights after that network wait.
  const resolvedReleaseEnvelope=await resolveGrant(claimedJob,{signal});
  // Bind the exact authority bytes at resolver completion. Caller-owned state
  // must not drift during the unrelated local database validation wait.
  const releaseEnvelope=snapshotManifest(resolvedReleaseEnvelope);
  if(!releaseEnvelope)throw Error('GRANT_ENVELOPE_INVALID');
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  signal?.throwIfAborted();
  // The database guard receives an isolated plain-data snapshot. Its awaited
  // implementation must not be able to rewrite the publisher's claimed
  // platform, fencing or idempotency identity before adapter submission.
  const eligibilitySnapshot=snapshotClaimedRelease(job);
  if(!eligibilitySnapshot||
   await Reflect.apply(assertPublishable,db,[eligibilitySnapshot])!==true)throw Error('LOCAL_RELEASE_BLOCKED');
  // Database contention can itself outlive signed evidence. Verify time-sensitive
  // authority/QA only after the last awaited check, immediately before submit.
  const release=verifyEnvelope(releaseEnvelope,upstreamKey,'content-control:pod');
  const brief=enforceBrief(release,{...job.brief,package_sha256:manifest.package_sha256},{publishing:true});
  const qa=verifyEnvelope(job.qa_envelope,qaKey,'content-control:pod:qa');
  enforceQA(qa,manifest.package_sha256,manifest.template_sha256,job.platform);
  enforceKdpListPrice(qa,brief.price,job.platform);
  brief.economics=enforceReleaseEconomics(release,brief);
  signal?.throwIfAborted();
  // Recheck local kill switches immediately before external side effect.
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  submitted=true;
  const receipt=await Reflect.apply(adapterSubmit,adapter,[{brief,manifest,idempotencyKey:job.idempotency_key,signal}]);
  // Match the observer's opaque listing-ID contract. A malformed receipt is
  // uncertain submission, never a submitted row that readback cannot reconcile.
  // Snapshot one own enumerable data property without invoking an untrusted
  // accessor or Proxy. Validation and durable settlement must use the same ID.
  const providerId=providerReceiptId(receipt);
  if(providerId===null)throw Error('RECEIPT_INVALID');
  submittedSettlementAttempted=true;
  await db.finish(job,'submitted',{id:providerId});
  return {status:'SUBMITTED',job_id:job.id};
 }catch(error){
  // A failed submitted transition may have committed despite its rejected
  // response. Never issue a second settlement transaction or expose private
  // database diagnostics; durable recovery/readback owns this uncertainty.
  if(submittedSettlementAttempted)throw Error('SUBMISSION_SETTLEMENT_UNCERTAIN');
  try{await db.finish(job,submitted?'ambiguous':'blocked',{},submitted?'SUBMISSION_UNCERTAIN':'RELEASE_BLOCKED');}
  catch{throw Error(submitted?'SUBMISSION_SETTLEMENT_UNCERTAIN':'RELEASE_SETTLEMENT_UNCERTAIN');}
  return {status:submitted?'AMBIGUOUS':'BLOCKED',job_id:job.id};
 }
}
export async function runPublisher(options){
 while(!options.signal?.aborted){
  await publishOnce(options);
  try{await pause(15000,undefined,{signal:options.signal});}catch(e){if(e.name!=='AbortError')throw e;}
 }
}
