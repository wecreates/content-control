import {verifyEnvelope,enforceBrief} from './policy.mjs';
import {fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';

export function createGrantResolver({env=process.env,fetchImpl=fetch}={}){
 let endpoint;
 try{endpoint=new URL(env.POD_GRANT_URL);}catch{throw Error('GRANT_AUTHORITY_REQUIRED');}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash||endpoint.search||
  typeof env.POD_GRANT_AUTH_KEY!=='string'||Buffer.byteLength(env.POD_GRANT_AUTH_KEY)<32||
  typeof env.POD_UPSTREAM_KEY!=='string'||Buffer.byteLength(env.POD_UPSTREAM_KEY)<32||env.POD_GRANT_AUTH_KEY===env.POD_UPSTREAM_KEY)throw Error('GRANT_AUTHORITY_INVALID');
 return async(job,{signal}={})=>{
  const timeout=AbortSignal.timeout(10000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,
   headers:{'content-type':'application/json',authorization:'Bearer '+env.POD_GRANT_AUTH_KEY},body:JSON.stringify({job_id:job.id})});
  const envelope=await readBridgeJSON(response,{signal:requestSignal,maxBytes:262144,statusError:'GRANT_AUTHORITY_BLOCKED',sizeError:'GRANT_TOO_LARGE'});
  const grant=verifyEnvelope(envelope,env.POD_UPSTREAM_KEY,'content-control:pod');
  enforceBrief(grant,job.brief);
  if(grant.expires_at_ms-Date.now()<30000)throw Error('GRANT_LIFETIME_TOO_SHORT');
  return envelope;
 };
}
