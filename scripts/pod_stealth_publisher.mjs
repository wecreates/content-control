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
function authorizedAdapter(registry,platform){
 try{
  if(registry===null||typeof registry!=='object'||Array.isArray(registry)||utilTypes.isProxy(registry))return null;
  const entry=Object.getOwnPropertyDescriptor(registry,platform);
  if(!entry||!Object.hasOwn(entry,'value'))return null;
  const adapter=entry.value;
  if(adapter===null||typeof adapter!=='object'||Array.isArray(adapter)||utilTypes.isProxy(adapter))return null;
  const authorization=Object.getOwnPropertyDescriptor(adapter,'authorized');
  const submit=Object.getOwnPropertyDescriptor(adapter,'submit');
  if(!authorization||!Object.hasOwn(authorization,'value')||authorization.value!==true||
   !submit||!Object.hasOwn(submit,'value')||typeof submit.value!=='function')return null;
  return {adapter,submit:submit.value};
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
function publisherDatabaseReceiver(db){
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
const PUBLICATION_GATE_FIELDS=Object.freeze(['PUBLICATION_ENABLED','POD_PUBLICATION_ENABLED']);
function publicationGatesEnabled(env){
 try{
  if(env===null||typeof env!=='object'||Array.isArray(env)||utilTypes.isProxy(env))return false;
  return PUBLICATION_GATE_FIELDS.every(key=>{
   const descriptor=Object.getOwnPropertyDescriptor(env,key);
   return !!descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.value==='true';
  });
 }catch{return false;}
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
 const publicationEnabled=()=>publicationGatesEnabled(env);
 if(signal?.aborted)return {status:'STOPPED'};
 // Dry run uses no leases, writes, artifact access, adapters or platform calls.
 if(!publicationEnabled()) {
  const listReady=dataProperty(db,'listReady');
  if(!listReady.valid||typeof listReady.value!=='function')throw Error('PUBLISH_DATABASE_UNVERIFIED');
  const jobs=await Reflect.apply(listReady.value,db,[]);if(signal?.aborted)return {status:'STOPPED'};
  log(JSON.stringify({status:'DRY_RUN',count:jobs.length,publication_enabled:false}));
  return {status:'DRY_RUN',count:jobs.length};
 }
 if(typeof resolveGrant!=='function'||typeof verifyArtifacts!=='function')throw Error('PUBLISH_RESOLVERS_REQUIRED');
 // Bind durable settlement, eligibility and their database receiver dependencies
 // before caller-owned waits can redirect any part of the transaction chain.
 // Missing endpoints remain enforced only after a job exists so empty-claim IDLE
 // is unchanged.
 const databaseReceiver=publisherDatabaseReceiver(db);
 const finishCapability=dataProperty(db,'finish'),assertCapability=dataProperty(db,'assertPublishable'),
  claimCapability=dataProperty(db,'claimPublish');
 if(!databaseReceiver||!finishCapability.valid||!assertCapability.valid||!claimCapability.valid||
  typeof claimCapability.value!=='function')throw Error('PUBLISH_DATABASE_UNVERIFIED');
 const finish=finishCapability.value,assertPublishable=assertCapability.value;
 const claimedJob=await Reflect.apply(claimCapability.value,db,[accountId,crypto.randomInt(45,181)]);
 if(!claimedJob)return {status:signal?.aborted||!publicationEnabled()?'STOPPED':'IDLE'};
 // Preserve the exact release-critical queue identity before any caller-owned
 // verifier or authority resolver can retain and mutate the claimed row.
 let job=claimedJob;
 let submitted=false,submittedSettlementAttempted=false;
 try{
  if(typeof finish!=='function')throw Error('SETTLEMENT_REQUIRED');
  const releaseSnapshot=snapshotClaimedRelease(claimedJob);
  if(!releaseSnapshot)throw Error('CLAIM_SNAPSHOT_INVALID');
  job=releaseSnapshot;
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  signal?.throwIfAborted();
  // Inspect only own data descriptors. Proxy/accessor-backed authorization or
  // submit capabilities can execute code during policy checks and fail closed.
  const adapterAuthorization=authorizedAdapter(adapters,job.platform);
  if(!adapterAuthorization)throw Error('ADAPTER_UNVERIFIED');
  const {adapter,submit:adapterSubmit}=adapterAuthorization;
  // Bind the exact endpoint that passed authorization before any caller-owned
  // verifier, authority or database callback can replace adapter.submit.
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
   await Reflect.apply(assertPublishable,databaseReceiver,[eligibilitySnapshot])!==true)throw Error('LOCAL_RELEASE_BLOCKED');
  // Database contention can itself outlive signed evidence. Verify time-sensitive
  // authority/QA only after the last awaited check, immediately before submit.
  const release=verifyEnvelope(releaseEnvelope,upstreamKey,'content-control:pod');
  const brief=enforceBrief(release,{...job.brief,package_sha256:manifest.package_sha256},{publishing:true});
  const qa=verifyEnvelope(job.qa_envelope,qaKey,'content-control:pod:qa');
  enforceQA(qa,manifest.package_sha256,manifest.template_sha256,job.platform);
  enforceKdpListPrice(qa,brief.price,job.platform);
  brief.economics=enforceReleaseEconomics(release,brief);
  signal?.throwIfAborted();
  // Recheck local kill switches and the exact adapter's current registry
  // authorization immediately before the external side effect. No await may
  // separate these checks from submission.
  if(!publicationEnabled())throw Error('PUBLICATION_DISABLED');
  const currentAdapter=authorizedAdapter(adapters,job.platform);
  if(!currentAdapter||currentAdapter.adapter!==adapter)throw Error('ADAPTER_UNVERIFIED');
  submitted=true;
  const receipt=await Reflect.apply(adapterSubmit,adapter,[{brief,manifest,idempotencyKey:job.idempotency_key,signal}]);
  // Match the observer's opaque listing-ID contract. A malformed receipt is
  // uncertain submission, never a submitted row that readback cannot reconcile.
  // Snapshot one own enumerable data property without invoking an untrusted
  // accessor or Proxy. Validation and durable settlement must use the same ID.
  const providerId=providerReceiptId(receipt);
  if(providerId===null)throw Error('RECEIPT_INVALID');
  submittedSettlementAttempted=true;
  await Reflect.apply(finish,databaseReceiver,[job,'submitted',{id:providerId}]);
  return {status:'SUBMITTED',job_id:job.id};
 }catch(error){
  // A failed submitted transition may have committed despite its rejected
  // response. Never issue a second settlement transaction or expose private
  // database diagnostics; durable recovery/readback owns this uncertainty.
  if(submittedSettlementAttempted)throw Error('SUBMISSION_SETTLEMENT_UNCERTAIN');
  try{await Reflect.apply(finish,databaseReceiver,[job,submitted?'ambiguous':'blocked',{},submitted?'SUBMISSION_UNCERTAIN':'RELEASE_BLOCKED']);}
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
