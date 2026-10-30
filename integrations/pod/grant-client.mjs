import {types as utilTypes} from 'node:util';
import {verifyEnvelope,enforceBrief} from './policy.mjs';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';

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

export function createGrantResolver(options={}){
 const envCapability=dataProperty(options,'env'),fetchCapability=dataProperty(options,'fetchImpl');
 if(!envCapability.valid||!fetchCapability.valid)throw Error('GRANT_OPTIONS_UNVERIFIED');
 const env=envCapability.value===undefined?process.env:envCapability.value,
  fetchImpl=fetchCapability.value===undefined?fetch:fetchCapability.value;
 const urlCapability=dataProperty(env,'POD_GRANT_URL'),authCapability=dataProperty(env,'POD_GRANT_AUTH_KEY'),
  upstreamCapability=dataProperty(env,'POD_UPSTREAM_KEY');
 if(!urlCapability.valid||!authCapability.valid||!upstreamCapability.valid)throw Error('GRANT_ENV_UNVERIFIED');
 let endpoint;
 try{endpoint=new URL(urlCapability.value);}catch{throw Error('GRANT_AUTHORITY_REQUIRED');}
 const authKey=authCapability.value,upstreamKey=upstreamCapability.value;
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash||endpoint.search||
  typeof authKey!=='string'||Buffer.byteLength(authKey)<32||
  typeof upstreamKey!=='string'||Buffer.byteLength(upstreamKey)<32||
  Buffer.from(authKey).equals(Buffer.from(upstreamKey))||typeof fetchImpl!=='function')
  throw Error('GRANT_AUTHORITY_INVALID');
 // Bind the validated authority identity at construction. A caller-owned env
 // object must not replace either credential after this resolver is trusted.
 return async(job,{signal}={})=>{
  const jobId=job?.id;
  if(typeof jobId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(jobId)||job?.brief?.id!==jobId)
   throw Error('GRANT_REQUEST_INVALID');
  const deadline=performance.now()+10000;
  const timeout=AbortSignal.timeout(10000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,
   headers:{'content-type':'application/json',authorization:'Bearer '+authKey},body:JSON.stringify({job_id:jobId})},{deadline});
  const envelope=await readBridgeJSON(response,{signal:requestSignal,deadline,maxBytes:262144,statusError:'GRANT_AUTHORITY_BLOCKED',
   sizeError:'GRANT_TOO_LARGE',mediaTypeError:'GRANT_MEDIA_TYPE_INVALID'});
  if(envelope===null||typeof envelope!=='object'||Array.isArray(envelope)||
   Object.getPrototypeOf(envelope)!==Object.prototype||Object.keys(envelope).length!==2||
   !Object.hasOwn(envelope,'payload')||!Object.hasOwn(envelope,'signature'))throw Error('GRANT_RESPONSE_INVALID');
  const grant=verifyEnvelope(envelope,upstreamKey,'content-control:pod');
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
