import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPodPool} from '../pod-db-bridge.js';
import {migrate} from './pod_storage_init.mjs';
import {preflight} from './pod_preflight.mjs';

// Never serialize raw database errors: messages can contain credentials or SQL.
export function deploymentFailure(error) {
 const codes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN',
  'CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN',
  'ERR_TLS_CERT_ALTNAME_INVALID','28000','28P01','42501','3D000','53300','57P03','42P01','42704']);
 const reasons=new Set(['PUBLICATION_MUST_BE_DISABLED','STORAGE_EXPIRING','DATABASE_CONFIG_REQUIRED',
  'DATABASE_CONFIG_INVALID','DATABASE_TARGET_MISMATCH','DEDICATED_RUNTIME_ROLE_REQUIRED',
  'PROVISION_REQUIRES_APPLY','PROVISION_CONFIG_INVALID','RUNTIME_ROLE_REQUIRED',
  'RUNTIME_ROLE_PRIVILEGED','MIGRATION_ROLE_MUST_DIFFER','MIGRATION_CHECKSUM_MISMATCH']);
 const reason=reasons.has(error?.message)?error.message:codes.has(error?.code)?error.code:
  error?.message==='Connection terminated unexpectedly'?'DATABASE_CONNECTION_TERMINATED':'POD_DATABASE_DEPLOYMENT_FAILED';
 return {status:'BLOCKED',reason,publication_enabled:false};
}

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
  try{
   // Pool construction may await external work. Never begin migration using
   // safety conditions that were valid only before that wait.
   deploymentConfig(env);
   await migrate(pool,role,undefined,{...options,assertActive:()=>deploymentConfig(env)});
  }finally{await pool.end();}
 }
 // Inspect using runtime credentials, never the migration owner. No writes or secrets in receipt.
 const report=await inspect({env,connect});
 // Inspection and pool cleanup can cross the storage cutoff or a kill switch.
 // A successful database check alone cannot make a stale deployment safe.
 deploymentConfig(env);
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
 }catch(error){console.error(JSON.stringify(deploymentFailure(error)));process.exitCode=1;}
}
