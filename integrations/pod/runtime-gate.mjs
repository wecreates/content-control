import {preflight} from '../../scripts/pod_preflight.mjs';

// Reuse the same read-only checks used by deployment tooling. Never close the
// service-owned pool here; initializePodService owns its lifecycle.
export async function requirePodRuntime({pool,env=process.env,check=preflight}){
 const keys=['POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY'].map(name=>env[name]);
 if(keys.some(k=>typeof k!=='string'||Buffer.byteLength(k)<32)||new Set(keys).size!==keys.length)throw Error('POD_RUNTIME_KEYS_INVALID');
 const report=await check({env,connect:async()=>({connect:()=>pool.connect(),end:async()=>{}})});
 const required=['POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY','PUBLICATION_DISABLED',
  'STORAGE_LIFETIME','BRIDGE_CONTRACT','DEDICATED_DATABASE_CONFIGURED','RESTRICTED_RUNTIME_ROLE',
  'DATABASE_TLS','POD_TABLE_PRIVILEGES','SOCIAL_VAULT_ISOLATED','SCHEMA_CHECKSUMS','DATABASE_READABLE'];
 if(report?.status!=='CONFIGURATION_VERIFIED'||!Array.isArray(report.checks)||
  !required.every(code=>report.checks.filter(c=>c.code===code).length===1&&report.checks.find(c=>c.code===code).status==='PASS'))throw Error('POD_RUNTIME_PREFLIGHT_BLOCKED');
 return true;
}
