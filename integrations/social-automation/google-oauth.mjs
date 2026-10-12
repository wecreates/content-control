// Google web-server OAuth. Registered app credentials stay server-side.
import {PROVIDERS,createProviderAdapters} from './providers.mjs';
const SCOPE=PROVIDERS.youtube.required_scopes[0];
export function createYouTubeOAuth({clientId,clientSecret,redirectUri,accountId,fetchImpl=fetch,now=()=>Date.now()}) {
 const redirect=new URL(redirectUri);
 if(!clientId||!clientSecret||!accountId||redirect.protocol!=='https:'||redirect.username||redirect.password||redirect.hash||redirect.search)throw Error('OAUTH_CONFIGURATION_REQUIRED');
 async function token(params,signal){
  let r,d;
  try {
   r=await fetchImpl(new URL('https://oauth2.googleapis.com/token'),{method:'POST',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean)),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params}).toString()});
   const reader=r.body.getReader();const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error();chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   d=JSON.parse(Buffer.concat(chunks).toString());
  }catch{throw Error('OAUTH_EXCHANGE_FAILED');}
  if(d.error==='invalid_grant')throw Error('REAUTHORIZE');
  if(!r.ok||d.error||typeof d.access_token!=='string'||!d.access_token||d.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(d.expires_in)||d.expires_in<=0)throw Error('OAUTH_EXCHANGE_FAILED');
  return d;
 }
 const scopes=d=>{if(typeof d.scope!=='string'||!d.scope.split(' ').includes(SCOPE))throw Error('PERMISSION_DENIED');return d.scope.split(' ').filter(s=>s===SCOPE);};
 return {
  authorizationUrl:({state,challenge})=>{const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect.href,response_type:'code',scope:SCOPE,state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent'});return u.href;},
  exchange:async({code,verifier})=>{const d=await token({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirect.href});return {account_id:accountId,access_token:d.access_token,...(typeof d.refresh_token==='string'?{refresh_token:d.refresh_token}:{}),expires_at:now()+d.expires_in*1000,scopes:scopes(d)};},
  refresh:async(grant,{signal}={})=>{if(grant.account_id!==accountId||!grant.refresh_token)throw Error('REAUTHORIZE');const d=await token({grant_type:'refresh_token',refresh_token:grant.refresh_token},signal);if(d.scope!==undefined)scopes(d);const updated={...grant,access_token:d.access_token,refresh_token:d.refresh_token||grant.refresh_token,expires_at:now()+d.expires_in*1000};await createProviderAdapters({fetchImpl}).youtube.verify(updated,{signal});return updated;},
 };
}
