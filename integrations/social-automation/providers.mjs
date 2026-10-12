import {createInstagramAdapter} from './instagram-adapter.mjs';
export const PROVIDERS = Object.freeze({
  instagram: {operations:['read_profile','read_media'],scope:'authorized_professional_account_metadata',required_scopes:['instagram_basic']},
  facebook: {operations:['read_profile'],scope:'authorized_page_identity_only',required_scopes:['pages_read_engagement']},
  youtube: {operations:['read_profile','read_media'],scope:'authorized_channel_upload_metadata',required_scopes:['https://www.googleapis.com/auth/youtube.readonly']},
  tiktok: {operations:['read_profile','read_media'],scope:'authorized_user_public_video_metadata',required_scopes:['user.info.basic','video.list']},
  threads: {operations:['read_profile','read_media'],scope:'authorized_user_thread_metadata',required_scopes:['threads_basic']},
  pinterest: {operations:['read_profile','read_media'],scope:'authorized_account_pin_metadata',required_scopes:['user_accounts:read','pins:read']},
  linkedin: {operations:['read_profile'],scope:'openid_profile_only_no_posts_or_messages',required_scopes:['openid','profile']},
  x: {operations:[],blocked_reason:'FREE_ONLY_POLICY',scope:'no_api_calls'},
  reddit: {operations:[],blocked_reason:'COMMERCIAL_ACCESS_APPROVAL_REQUIRED',scope:'no_api_calls'},
});
export function providerReadiness() {return Object.entries(PROVIDERS).map(([platform,p])=>({platform,...p,implementation:p.blocked_reason?'blocked':'read_adapter',live_account_verified:false,publication_enabled:false}));}
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>typeof o?.[k]==='string'||typeof o?.[k]==='number').map(k=>[k,o[k]]));
const identity=(g,id)=>{if(typeof id!=='string'||!id||id!==g.account_id)throw Error('ACCOUNT_VERIFICATION_FAILED');return id;};
const page=(items,keys)=>{if(!Array.isArray(items)||items.length>5||items.some(x=>typeof x?.id!=='string'||!x.id))throw Error('PROVIDER_FAILED');return {items:items.map(x=>pick(x,keys)),pagination_followed:false,full_analysis:false};};

// The only POST read is TikTok's documented video-list endpoint. No caller can
// supply a URL/method; every outbound operation below is constructed internally.
function transport({fetchImpl=fetch,shutdownSignal}={}) {
 return async (url,grant,{method='GET',body}={})=>{
  let r,d;
  try {
   const signal=AbortSignal.any([shutdownSignal,grant._signal,AbortSignal.timeout(20000)].filter(Boolean));
   r=await fetchImpl(new URL(url),{method,redirect:'error',signal,headers:{Authorization:`Bearer ${grant.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const reader=r.body.getReader();let size=0;const chunks=[];
   try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw Error();chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   d=JSON.parse(Buffer.concat(chunks).toString());
  }catch{throw Error('PROVIDER_FAILED');}
  if(r.status===401||d?.error?.code===190||d?.error?.code==='access_token_invalid')throw Error('REAUTHORIZE');
  if(r.status===403||[10,200,'scope_not_authorized'].includes(d?.error?.code))throw Error('PERMISSION_DENIED');
  if(!r.ok||(d?.error&&d.error.code!=='ok'))throw Error('PROVIDER_FAILED');
  return d;
 };
}
export function createProviderAdapters(options={}) {
 const request=transport(options);
 const adapters={instagram:createInstagramAdapter(options)};
 adapters.facebook={read_profile:async g=>{const d=await request('https://graph.facebook.com/v26.0/me?fields=id,name,category',g);if(typeof d.category!=='string')throw Error('ACCOUNT_VERIFICATION_FAILED');return {account_id:identity(g,d.id),...pick(d,['name']),full_analysis:false};}};
 adapters.linkedin={read_profile:async g=>{const d=await request('https://api.linkedin.com/v2/userinfo',g);return {account_id:identity(g,d.sub),...pick(d,['name']),full_analysis:false};}};
 adapters.threads={read_profile:async g=>{const d=await request('https://graph.threads.net/v1.0/me?fields=id,username',g);return {account_id:identity(g,d.id),...pick(d,['username']),full_analysis:false};},read_media:async g=>{await adapters.threads.read_profile(g);const d=await request('https://graph.threads.net/v1.0/me/threads?fields=id,media_type,timestamp&limit=5',g);return page(d.data,['id','media_type','timestamp']);}};
 adapters.pinterest={read_profile:async g=>{const d=await request('https://api.pinterest.com/v5/user_account',g);return {account_id:identity(g,d.username),identity_basis:'username_changes_require_reauthorization',...pick(d,['account_type']),full_analysis:false};},read_media:async g=>{await adapters.pinterest.read_profile(g);const d=await request('https://api.pinterest.com/v5/pins?page_size=5',g);return page(d.items,['id','created_at']);}};
 adapters.tiktok={refresh_lead_ms:300000,read_profile:async g=>{const d=await request('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',g);return {account_id:identity(g,d.data?.user?.open_id),...pick(d.data.user,['display_name']),full_analysis:false};},read_media:async g=>{await adapters.tiktok.read_profile(g);const d=await request('https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,duration',g,{method:'POST',body:{max_count:5}});return page(d.data?.videos,['id','create_time','duration']);}};
 async function channel(g){const d=await request('https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&mine=true&maxResults=50',g);if(!Array.isArray(d.items)||d.items.length>50)throw Error('PROVIDER_FAILED');const found=d.items.find(x=>x?.id===g.account_id);identity(g,found?.id);return found;}
 adapters.youtube={refresh_lead_ms:300000,read_profile:async g=>({account_id:(await channel(g)).id,full_analysis:false}),read_media:async g=>{const c=await channel(g),uploads=c.contentDetails?.relatedPlaylists?.uploads;if(typeof uploads!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(uploads))throw Error('PROVIDER_FAILED');const url=new URL('https://www.googleapis.com/youtube/v3/playlistItems');url.search=new URLSearchParams({part:'id,contentDetails',playlistId:uploads,maxResults:'5'});const d=await request(url,g);if(!Array.isArray(d.items)||d.items.some(x=>typeof x?.contentDetails?.videoId!=='string'))throw Error('PROVIDER_FAILED');return page(d.items.map(x=>({id:x.contentDetails.videoId})),['id']);}};
 for(const [platform,adapter] of Object.entries(adapters)) {
  if(!adapter.verify)adapter.verify=async g=>({account_id:(await adapter.read_profile(g)).account_id,verified:true});
  // Scope checks happen before any provider request. Unknown scopes never grant writes.
  for(const operation of ['verify','read_profile','read_media'])if(adapter[operation]){const original=adapter[operation];adapter[operation]=async(...args)=>{const g=args[0];if(!g||typeof g.access_token!=='string'||!g.access_token||typeof g.account_id!=='string'||!Array.isArray(g.scopes)||!PROVIDERS[platform].required_scopes.every(s=>g.scopes.includes(s)))throw Error('PERMISSION_DENIED');return original({...g,_signal:args[2]?.signal||args[1]?.signal||g._signal},...args.slice(1));};}
 }
 for(const platform of ['x','reddit']){const blocked=async()=>{throw Error(PROVIDERS[platform].blocked_reason);};adapters[platform]={blocked_reason:PROVIDERS[platform].blocked_reason,verify:blocked,read_profile:blocked,read_media:blocked};}
 return adapters;
}
