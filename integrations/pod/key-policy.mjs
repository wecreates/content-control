// Compare configured credentials across authority boundaries. Optional lanes
// remain disabled when absent; their own gates still require their credentials.
export const REQUIRED_RUNTIME_KEYS=Object.freeze([
 'POD_UPSTREAM_KEY','POD_QA_KEY','INTERNAL_OPERATIONS_KEY',
]);
export const OPTIONAL_RUNTIME_KEYS=Object.freeze([
 'POD_INTAKE_KEY','POD_FINANCE_KEY','POD_MARKET_KEY','POD_PROVIDER_KEY',
 'POD_REGISTRY_KEY','POD_RIGHTS_KEY','POD_TEMPLATE_KEY','POD_REVIEW_KEY',
 'POD_SOURCE_KEY','POD_EDITORIAL_KEY','POD_GRANT_AUTH_KEY','POD_OUTBOX_KEY',
]);
export function isolatedRuntimeKeys(env){
 const seen=new Set();
 for(const name of [...REQUIRED_RUNTIME_KEYS,...OPTIONAL_RUNTIME_KEYS]){
  const value=env[name];
  if(OPTIONAL_RUNTIME_KEYS.includes(name)&&(value===undefined||value===''))continue;
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')<32)return false;
  // HMAC uses UTF-8 bytes: distinct JS strings can encode to the same bytes.
  const bytes=Buffer.from(value,'utf8').toString('hex');
  if(seen.has(bytes))return false;
  seen.add(bytes);
 }
 return true;
}
