import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool} from '../pod-db-bridge.js';
import {migrate} from './pod_storage_init.mjs';
import {preflight} from './pod_preflight.mjs';

export function deploymentConfig(env, now=Date.now()) {
 if(env.PUBLICATION_ENABLED!=='false'||env.POD_PUBLICATION_ENABLED!=='false')throw Error('PUBLICATION_MUST_BE_DISABLED');
 if(!Number.isFinite(Date.parse(env.POD_STORAGE_EXPIRES_AT))||Date.parse(env.POD_STORAGE_EXPIRES_AT)-now<=86400000)throw Error('STORAGE_EXPIRING');
 let admin,runtime;
 try{admin=new URL(env.DATABASE_MIGRATION_URL);runtime=new URL(env.POD_DATABASE_URL);}catch{throw Error('DATABASE_CONFIG_REQUIRED');}
 for(const url of [admin,runtime]){
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.pathname.length<2||url.hash||
   [...url.searchParams.keys()].some(k=>k!=='sslmode')||
   (url.searchParams.has('sslmode')&&!['require','verify-full'].includes(url.searchParams.get('sslmode'))))throw Error('DATABASE_CONFIG_INVALID');
 }
 if(admin.hostname!==runtime.hostname||(admin.port||'5432')!==(runtime.port||'5432')||admin.pathname!==runtime.pathname)throw Error('DATABASE_TARGET_MISMATCH');
 const role=decodeURIComponent(runtime.username);
 if(!/^[a-z_][a-z0-9_]{0,62}$/.test(role)||role!==env.DATABASE_RUNTIME_USER||role===decodeURIComponent(admin.username))throw Error('DEDICATED_RUNTIME_ROLE_REQUIRED');
 return {role};
}

export async function deployDatabase({env=process.env,apply=false,provision=false,connect=createPodPool,inspect=preflight}={}) {
 const {role}=deploymentConfig(env);
 if(provision&&!apply)throw Error('PROVISION_REQUIRES_APPLY');
 const options=provision?{provisionPassword:decodeURIComponent(new URL(env.POD_DATABASE_URL).password)}:{};
 if(apply){
  const pool=await connect({...env,POD_DATABASE_URL:env.DATABASE_MIGRATION_URL});
  try{await migrate(pool,role,undefined,options);}finally{await pool.end();}
 }
 // Inspect using runtime credentials, never the migration owner. No writes or secrets in receipt.
 const report=await inspect({env,connect});
 const required=['RESTRICTED_RUNTIME_ROLE','DATABASE_TLS','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'];
 const checks=required.map(code=>({code,status:report.checks.find(c=>c.code===code)?.status||'BLOCKED'}));
 return {schema_version:1,status:checks.every(c=>c.status==='PASS')?'DATABASE_VERIFIED':'BLOCKED',
  migration_requested:apply,provision_requested:provision,publication_enabled:false,production_enabled:false,checks};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.slice(2).some(arg=>!['--apply','--provision-role'].includes(arg)))throw Error('INVALID_ARGUMENT');
  const result=await deployDatabase({apply:process.argv.includes('--apply'),provision:process.argv.includes('--provision-role')});
  console.log(JSON.stringify(result));if(result.status!=='DATABASE_VERIFIED')process.exitCode=1;
 }catch{console.error(JSON.stringify({status:'BLOCKED',reason:'POD_DATABASE_DEPLOYMENT_FAILED',publication_enabled:false}));process.exitCode=1;}
}
