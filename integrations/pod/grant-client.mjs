import {verifyEnvelope,enforceBrief} from './policy.mjs';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';

export function createGrantResolver({env=process.env,fetchImpl=fetch}={}){
 let endpoint;
 try{endpoint=new URL(env.POD_GRANT_URL);}catch{throw Error('GRANT_AUTHORITY_REQUIRED');}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash||endpoint.search||
  typeof env.POD_GRANT_AUTH_KEY!=='string'||Buffer.byteLength(env.POD_GRANT_AUTH_KEY)<32||
  typeof env.POD_UPSTREAM_KEY!=='string'||Buffer.byteLength(env.POD_UPSTREAM_KEY)<32||
  Buffer.from(env.POD_GRANT_AUTH_KEY).equals(Buffer.from(env.POD_UPSTREAM_KEY)))throw Error('GRANT_AUTHORITY_INVALID');
 return async(job,{signal}={})=>{
  const jobId=job?.id;
  if(typeof jobId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(jobId)||job?.brief?.id!==jobId)
   throw Error('GRANT_REQUEST_INVALID');
  const deadline=performance.now()+10000;
  const timeout=AbortSignal.timeout(10000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,
   headers:{'content-type':'application/json',authorization:'Bearer '+env.POD_GRANT_AUTH_KEY},body:JSON.stringify({job_id:jobId})},{deadline});
  const envelope=await readBridgeJSON(response,{signal:requestSignal,deadline,maxBytes:262144,statusError:'GRANT_AUTHORITY_BLOCKED',
   sizeError:'GRANT_TOO_LARGE',mediaTypeError:'GRANT_MEDIA_TYPE_INVALID'});
  if(envelope===null||typeof envelope!=='object'||Array.isArray(envelope)||
   Object.getPrototypeOf(envelope)!==Object.prototype||Object.keys(envelope).length!==2||
   !Object.hasOwn(envelope,'payload')||!Object.hasOwn(envelope,'signature'))throw Error('GRANT_RESPONSE_INVALID');
  const grant=verifyEnvelope(envelope,env.POD_UPSTREAM_KEY,'content-control:pod');
  enforceBrief(grant,job.brief);
  // Recheck wall-clock validity after signature/scope work. A nonfinite or
  // rolled-back second clock read must not turn the lifetime comparison into
  // a false result and authorize a grant from the apparent future.
  const current=Date.now();
  if(!Number.isSafeInteger(current)||current<0||grant.issued_at_ms>current)throw Error('GRANT_CLOCK_INVALID');
  if(grant.expires_at_ms-current<30000)throw Error('GRANT_LIFETIME_TOO_SHORT');
  assertBridgeRequest(requestSignal,deadline);
  return envelope;
 };
}
