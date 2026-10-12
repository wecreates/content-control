import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
async function providerCall(operation, timeoutMs) {
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const error=new Error('PROVIDER_TIMEOUT');error.code='PROVIDER_TIMEOUT';reject(error)},timeoutMs)});
 try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),timeout])}finally{clearTimeout(timer)}
}
const platforms=new Set(['instagram','facebook','youtube','tiktok','threads','x','pinterest','linkedin','reddit']);
export class EncryptedSocialStore {
 constructor({file,key}) {if(!path.isAbsolute(file)||!/^[a-f0-9]{64}$/i.test(key||''))throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');this.file=file;this.key=Buffer.from(key,'hex');this.serial=Promise.resolve();}
 async read(){let raw;try{raw=await fs.readFile(this.file,'utf8')}catch(e){if(e.code==='ENOENT')return {version:1,connections:{},jobs:[]};throw Error('PRIVATE_STORE_UNAVAILABLE')}
  try{const e=JSON.parse(raw);if(e.version!==1)throw Error();const decipher=crypto.createDecipheriv('aes-256-gcm',this.key,Buffer.from(e.iv,'base64'));decipher.setAAD(Buffer.from('cyzor-social-v1'));decipher.setAuthTag(Buffer.from(e.tag,'base64'));const d=JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.data,'base64')),decipher.final()]).toString());if(d.version!==1||!d.connections||!Array.isArray(d.jobs))throw Error();return d}catch{throw Error('PRIVATE_STORE_INTEGRITY_FAILED')}
 }
 async update(fn) {
  const run=this.serial.catch(()=>{}).then(async()=>{
   await fs.mkdir(path.dirname(this.file),{recursive:true,mode:0o700});
   let lock;
   try {lock=await fs.open(this.file+'.lock','wx',0o600);}
   catch {throw Error('PRIVATE_STORE_BUSY');}
   const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';
   try {
    const d=await this.read(),result=await fn(d);
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);
    cipher.setAAD(Buffer.from('cyzor-social-v1'));
    const data=Buffer.concat([cipher.update(JSON.stringify(d)),cipher.final()]);
    const envelope={version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
    const file=await fs.open(tmp,'wx',0o600);
    try {await file.writeFile(JSON.stringify(envelope));await file.sync();} finally {await file.close();}
    await fs.rename(tmp,this.file);
    return result;
   } finally {
    await fs.rm(tmp,{force:true});await lock.close();await fs.rm(this.file+'.lock',{force:true});
   }
  });
  this.serial=run;return run;
 }
}
export class SocialAutomation {
 constructor({store,adapters={},now=()=>Date.now(),providerTimeoutMs=20000}){if(!Number.isInteger(providerTimeoutMs)||providerTimeoutMs<1||providerTimeoutMs>120000)throw Error('INVALID_PROVIDER_TIMEOUT');this.store=store;this.adapters=adapters;this.now=now;this.running=null;this.providerTimeoutMs=providerTimeoutMs;}
 async connect(platform,grant){if(!platforms.has(platform)||!grant||typeof grant.access_token!=='string'||!grant.access_token||typeof grant.account_id!=='string'||!grant.account_id||!Array.isArray(grant.scopes)||!grant.scopes.every(x=>typeof x==='string')||!Number.isFinite(grant.expires_at)||grant.expires_at<=this.now())throw Error('INVALID_AUTHORIZATION');if(!this.adapters[platform]?.verify)throw Error('PROVIDER_ADAPTER_REQUIRED');const proof=await providerCall(signal=>this.adapters[platform].verify({...grant},{signal}),this.providerTimeoutMs);if(proof.account_id!==grant.account_id||proof.verified!==true)throw Error('ACCOUNT_VERIFICATION_FAILED');await this.store.update(d=>{d.connections[platform]={...grant,verified_at:this.now(),status:'connected'};});}
 async enqueue({id,platform,operation,payload={}}){if(!platforms.has(platform)||!['read_profile','read_media','read_analytics'].includes(operation))throw Error('EXTERNAL_WRITE_DISABLED');if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('INVALID_JOB_ID');const digest=crypto.createHash('sha256').update(JSON.stringify({platform,operation,payload})).digest('hex');return this.store.update(d=>{const old=d.jobs.find(j=>j.id===id);if(old){if(old.digest!==digest)throw Error('IDEMPOTENCY_CONFLICT');return {id,status:old.status,created:false}}if(d.jobs.length>=1000)throw Error('QUEUE_CAPACITY_REACHED');d.jobs.push({id,platform,operation,payload,digest,account_id:d.connections[platform]?.account_id||null,status:'queued',attempts:0,due_at:this.now()});return {id,status:'queued',created:true}});}
 tick(){if(this.running)return this.running;this.running=this.run().finally(()=>{this.running=null});return this.running;}
 async run(){return this.store.update(async d=>{for(const job of d.jobs.filter(j=>['queued','retry'].includes(j.status)&&j.due_at<=this.now()).slice(0,10)){const connection=d.connections[job.platform],adapter=this.adapters[job.platform];if(!connection||!adapter){job.status='blocked';job.reason='AUTHORIZATION_OR_ADAPTER_REQUIRED';continue}if(adapter.blocked_reason){job.status='blocked';job.reason=adapter.blocked_reason;continue}if(job.account_id!==connection.account_id){job.status='blocked';job.reason='ACCOUNT_CHANGED';continue}if(connection.status==='reauthorization_required'){job.status='blocked';job.reason='REAUTHORIZE';continue}
    job.attempts++;try{if(connection.expires_at<=this.now()||connection.expires_at-this.now()<(adapter.refresh_lead_ms??86400000)&&typeof adapter.refresh==='function'){
     if(typeof adapter.refresh!=='function'){connection.status='reauthorization_required';job.status='blocked';job.reason='REAUTHORIZE';continue}
     const renewed=await providerCall(signal=>adapter.refresh({...connection},{signal}),this.providerTimeoutMs);
     if(typeof renewed?.access_token!=='string'||!renewed.access_token||!Number.isFinite(renewed.expires_at)||renewed.expires_at<=this.now()||renewed.account_id!==connection.account_id)throw Error('REAUTHORIZE');
     d.connections[job.platform]={...connection,...renewed};
    }
     const method=adapter[job.operation];if(typeof method!=='function'){job.status='blocked';job.reason='UNSUPPORTED_OPERATION';continue}const result=await providerCall(signal=>method.call(adapter,{...d.connections[job.platform]},job.payload,{idempotencyKey:job.id,signal}),this.providerTimeoutMs);if(result!==undefined){const encoded=JSON.stringify(result);if(encoded.length>262144)throw Error("PROVIDER_RESULT_TOO_LARGE");job.result=JSON.parse(encoded);}job.status='completed';job.completed_at=this.now();d.connections[job.platform].last_read_at=this.now();delete job.reason;
    }catch(error){const permanent=['REAUTHORIZE','PERMISSION_DENIED'].includes(error.code||error.message);if(permanent){d.connections[job.platform].status='reauthorization_required';job.status='blocked';job.reason='REAUTHORIZE'}else{job.status=job.attempts>=3?'blocked':'retry';job.reason='PROVIDER_FAILED';job.due_at=this.now()+Math.min(3600000,60000*2**job.attempts)}}}
   return {publication_enabled:false,counts:d.jobs.reduce((a,j)=>(a[j.status]=(a[j.status]||0)+1,a),{})};});}
 async status(){const d=await this.store.read();return {publication_enabled:false,external_writes_enabled:false,connections:Object.entries(d.connections).map(([platform,c])=>({platform,status:c.expires_at<=this.now()?'expired':c.status,expires_at:c.expires_at,last_verified_at:c.verified_at})),jobs:d.jobs.map(j=>({id:j.id,platform:j.platform,operation:j.operation,status:j.status,attempts:j.attempts,reason:j.reason}))};}
}
export function socialRuntimeReadiness(env=process.env){const required=['SOCIAL_VAULT_KEY','SOCIAL_VAULT_FILE'];return {status:'NOT_ACTIVATED',publication_enabled:false,external_writes_enabled:false,missing_configuration:required.filter(k=>!env[k]),durable_storage_verified:false,oauth_routes_enabled:false,worker_running:false,provider_adapters_registered:[],implemented_read_adapters:['instagram','facebook','youtube','tiktok','threads','pinterest','linkedin'],worker_implemented:true,reason:'Private durable storage and platform OAuth applications must be configured and verified before activation'};}
