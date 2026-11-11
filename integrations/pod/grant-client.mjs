import {types as utilTypes} from 'node:util';
import {verifyEnvelope,enforceBrief} from './policy.mjs';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const nativeReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;

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

// Bind the response to the same inert job scope used to dispatch the request.
// Never run brief accessors or read the caller's objects again after I/O.
function grantScope(job){
 const fail=()=>{throw Error('GRANT_REQUEST_INVALID');};
 const record=value=>{
  if(value===null||typeof value!=='object'||utilTypes.isProxy(value))fail();
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)fail();
  return value;
 };
 const own=(value,key,optional=false)=>{
  const field=Object.getOwnPropertyDescriptor(value,key);
  if(!field&&optional)return undefined;
  if(!field?.enumerable||!Object.hasOwn(field,'value'))fail();
  return field.value;
 };
 job=record(job);
 const id=own(job,'id'),brief=record(own(job,'brief')),scope=Object.create(null);
 if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(id))fail();
 for(const key of ['id','business_id','account_id','platform','destination_platform','mode']){
  const value=own(brief,key);
  if(typeof value!=='string')fail();
  scope[key]=value;
 }
 if(scope.id!==id)fail();
 for(const key of ['task_sha256','package_sha256']){
  const value=own(brief,key,true);
  if(value!==undefined&&value!==null&&typeof value!=='string')fail();
  scope[key]=value;
 }
 return scope;
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
 return async(job,callOptions={})=>{
  const signalCapability=dataProperty(callOptions,'signal');
  if(!signalCapability.valid)throw Error('GRANT_OPTIONS_UNVERIFIED');
  const signal=signalCapability.value;
  assertBridgeRequest(signal);
  const scope=grantScope(job);
  // Node 22 composition reads public source members. Only compose owned
  // signals; use native state/reason and preserve genuine cancellation.
  const controller=new AbortController();
  const onAbort=()=>{if(Reflect.apply(nativeAborted,signal,[]))controller.abort(Reflect.apply(nativeReason,signal,[]));};
  if(signal)Reflect.apply(addAbortListener,signal,['abort',onAbort]);
  try{
  if(signal&&Reflect.apply(nativeAborted,signal,[]))onAbort();
  const deadline=performance.now()+10000;
  const timeout=AbortSignal.timeout(10000);
  const requestSignal=AbortSignal.any([controller.signal,timeout]);
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,
   headers:{'content-type':'application/json',authorization:'Bearer '+authKey},body:JSON.stringify({job_id:scope.id})},{deadline});
  const envelope=await readBridgeJSON(response,{signal:requestSignal,deadline,maxBytes:262144,statusError:'GRANT_AUTHORITY_BLOCKED',
   sizeError:'GRANT_TOO_LARGE',mediaTypeError:'GRANT_MEDIA_TYPE_INVALID'});
  if(envelope===null||typeof envelope!=='object'||Array.isArray(envelope)||
   Object.getPrototypeOf(envelope)!==Object.prototype||Object.keys(envelope).length!==2||
   !Object.hasOwn(envelope,'payload')||!Object.hasOwn(envelope,'signature'))throw Error('GRANT_RESPONSE_INVALID');
  const grant=verifyEnvelope(envelope,upstreamKey,'content-control:pod');
  enforceBrief(grant,scope);
  // Recheck wall-clock validity after signature/scope work. A nonfinite or
  // rolled-back second clock read must not turn the lifetime comparison into
  // a false result and authorize a grant from the apparent future.
  const current=Date.now();
  if(!Number.isSafeInteger(current)||current<0||grant.issued_at_ms>current)throw Error('GRANT_CLOCK_INVALID');
  if(grant.expires_at_ms-current<30000)throw Error('GRANT_LIFETIME_TOO_SHORT');
  assertBridgeRequest(requestSignal,deadline);
  return envelope;
  }finally{if(signal)Reflect.apply(removeAbortListener,signal,['abort',onAbort]);}
 };
}
