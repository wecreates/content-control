// Compatibility filename requested by the owner. No stealth or detection bypass.
import crypto from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {verifyEnvelope,enforceBrief,enforceQA} from '../integrations/pod/policy.mjs';
import {enforceReleaseEconomics} from '../integrations/pod/economics.mjs';
export async function publishOnce({db,env=process.env,accountId,adapters={},resolveGrant,
 verifyArtifacts,upstreamKey,qaKey,log=console.log,signal}) {
 // Dry run uses no leases, writes, artifact access, adapters or platform calls.
 if(env.PUBLICATION_ENABLED!=='true'||env.POD_PUBLICATION_ENABLED!=='true') {
  const jobs=await db.listReady();log(JSON.stringify({status:'DRY_RUN',count:jobs.length,publication_enabled:false}));
  return {status:'DRY_RUN',count:jobs.length};
 }
 if(typeof resolveGrant!=='function'||typeof verifyArtifacts!=='function')throw Error('PUBLISH_RESOLVERS_REQUIRED');
 const job=await db.claimPublish(accountId,crypto.randomInt(45,181));if(!job)return {status:'IDLE'};
 let submitted=false;
 try{
  const adapter=adapters[job.platform];
  if(adapter?.authorized!==true||typeof adapter.submit!=='function')throw Error('ADAPTER_UNVERIFIED');
  const manifest=await verifyArtifacts(job); // Must hash all files and validate current template/rights/budget.
  if(!manifest||manifest.package_sha256!==job.manifest?.package_sha256||manifest.release_checks_passed!==true)throw Error('ARTIFACT_VERIFICATION_FAILED');
  signal?.throwIfAborted();
  // Artifact checks may outlive a grant or overlap revocation. Fetch authority
  // afterward, then recheck local lease/account/rights after that network wait.
  const releaseEnvelope=await resolveGrant(job,{signal});
  signal?.throwIfAborted();
  if(typeof db.assertPublishable!=='function'||await db.assertPublishable(job)!==true)throw Error('LOCAL_RELEASE_BLOCKED');
  // Database contention can itself outlive signed evidence. Verify time-sensitive
  // authority/QA only after the last awaited check, immediately before submit.
  const release=verifyEnvelope(releaseEnvelope,upstreamKey,'content-control:pod');
  const brief=enforceBrief(release,{...job.brief,package_sha256:manifest.package_sha256},{publishing:true});
  const qa=verifyEnvelope(job.qa_envelope,qaKey,'content-control:pod:qa');
  enforceQA(qa,manifest.package_sha256,manifest.template_sha256,job.platform);
  brief.economics=enforceReleaseEconomics(release,brief);
  signal?.throwIfAborted();
  // Recheck local kill switches immediately before external side effect.
  if(env.PUBLICATION_ENABLED!=='true'||env.POD_PUBLICATION_ENABLED!=='true')throw Error('PUBLICATION_DISABLED');
  submitted=true;
  const receipt=await adapter.submit({brief,manifest,idempotencyKey:job.idempotency_key,signal});
  if(typeof receipt?.id!=='string'||receipt.id.length===0)throw Error('RECEIPT_MISSING');
  await db.finish(job,'submitted',{id:receipt.id});
  return {status:'SUBMITTED',job_id:job.id};
 }catch(error){
  await db.finish(job,submitted?'ambiguous':'blocked',{},submitted?'SUBMISSION_UNCERTAIN':'RELEASE_BLOCKED');
  return {status:submitted?'AMBIGUOUS':'BLOCKED',job_id:job.id};
 }
}
export async function runPublisher(options){
 while(!options.signal?.aborted){
  await publishOnce(options);
  try{await pause(15000,undefined,{signal:options.signal});}catch(e){if(e.name!=='AbortError')throw e;}
 }
}
