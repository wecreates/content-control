import crypto from 'node:crypto';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
// Internal coordinator. The host must authenticate the owner independently;
// arbitrary caller-supplied owner IDs never authorize this service.
export class SocialOAuthCoordinator {
 constructor({store,runtime,providers={},authorizeOwner=async()=>null,now=()=>Date.now(),shutdownSignal,exchangeTimeoutMs=20000}){if(!Number.isInteger(exchangeTimeoutMs)||exchangeTimeoutMs<1||exchangeTimeoutMs>120000)throw Error('INVALID_OAUTH_TIMEOUT');this.shutdownSignal=shutdownSignal;this.exchangeTimeoutMs=exchangeTimeoutMs;this.store=store;this.runtime=runtime;this.providers=providers;this.authorizeOwner=authorizeOwner;this.now=now;}
 assertActive(){if(this.shutdownSignal?.aborted)throw Error('OAUTH_STOPPED');}
 async owner(context){this.assertActive();const owner=await this.authorizeOwner(context);this.assertActive();if(typeof owner!=='string'||!owner)throw Error('OWNER_AUTHENTICATION_REQUIRED');return hash(owner);}
 async begin(platform,context){
  const owner=await this.owner(context),provider=this.providers[platform];
  if(!provider?.authorizationUrl||!provider?.exchange)throw Error('OAUTH_PROVIDER_NOT_CONFIGURED');
  const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const url=await provider.authorizationUrl({state,challenge});
  if(new URL(url).protocol!=='https:')throw Error('INVALID_AUTHORIZATION_URL');
  await this.store.update(d=>{d.oauth_pending??={};for(const [k,v] of Object.entries(d.oauth_pending))if(v.expires_at<=this.now())delete d.oauth_pending[k];if(Object.keys(d.oauth_pending).length>=20)throw Error('OAUTH_CAPACITY');d.oauth_pending[hash(state)]={owner,platform,verifier,expires_at:this.now()+600000};});
  return {authorization_url:url,expires_in_seconds:600};
 }
 async complete(platform,{state,code,error},context){
  const owner=await this.owner(context);
  if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state))throw Error('INVALID_OAUTH_STATE');
  const pending=await this.store.update(d=>{const p=d.oauth_pending?.[hash(state)];if(!p||p.owner!==owner||p.platform!==platform||p.expires_at<=this.now())throw Error('INVALID_OAUTH_STATE');delete d.oauth_pending[hash(state)];return p;});
  // Consume the state before any exchange, including provider denial/failure.
  if(error||typeof code!=='string'||!code||code.length>4096)throw Error('OAUTH_AUTHORIZATION_DENIED');
  const provider=this.providers[platform];if(!provider?.exchange)throw Error('OAUTH_PROVIDER_NOT_CONFIGURED');
  this.assertActive();
  const controller=new AbortController();let timer,rejectBound;
  const bound=new Promise((_,reject)=>{rejectBound=reject;});
  const abort=()=>{controller.abort();rejectBound(Error('OAUTH_STOPPED'));};
  this.shutdownSignal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{controller.abort();rejectBound(Error('OAUTH_EXCHANGE_TIMEOUT'));},this.exchangeTimeoutMs);
  let grant;
  try{this.assertActive();grant=await Promise.race([bound,Promise.resolve().then(()=>provider.exchange({code,verifier:pending.verifier},{signal:controller.signal}))]);}
  catch(error){throw Error(['OAUTH_STOPPED','OAUTH_EXCHANGE_TIMEOUT'].includes(error?.message)?error.message:'OAUTH_EXCHANGE_FAILED');}
  finally{clearTimeout(timer);this.shutdownSignal?.removeEventListener('abort',abort);}
  this.assertActive();
  await this.runtime.connect(platform,grant);
  return {platform,status:'connected',publication_enabled:false};
 }
}
