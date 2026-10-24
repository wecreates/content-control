// Read-only registry projection, separate from independently verified hosted operations.
// No paths, secrets, supplied readiness labels or provider configuration are exposed.
const tools = new Set(['open-seo','weknora','openwhispr','openproject','open-higgsfield','voicestudio','hypit']);
export function offlineBridgeStatus(registry) {
  const entries=registry.external_bridges;
  if(entries===undefined)return [];
  if(!Array.isArray(entries)||entries.length>tools.size)throw Error('INVALID_BRIDGE_REGISTRY');
  const seen=new Set();
  return entries.map(entry=>{
    if(!entry||!tools.has(entry.id)||seen.has(entry.id)||!/^([a-f0-9]{40})$/.test(entry.revision)||
        !Array.isArray(entry.operations)||entry.operations.length<1||entry.operations.length>8||
        !entry.operations.every(op=>typeof op==='string'&&/^[a-z][a-z-]{1,50}$/.test(op))||
        new Set(entry.operations).size!==entry.operations.length)throw Error('INVALID_BRIDGE_REGISTRY');
    seen.add(entry.id);
    return {id:entry.id,revision:entry.revision,
      runtime_status:'OFFLINE_ADAPTER_REGISTERED_UPSTREAM_UNVERIFIED',
      configured_offline_operations:[...entry.operations],verified_operations:[],
      live_execution_enabled:false,upstream_runtime_verified:false,production_ready:false,
      publication_enabled:false,paid_services_enabled:false,
      scope:'Source-pinned offline adapter registration only; no runtime or provider verification'};
  });
}
