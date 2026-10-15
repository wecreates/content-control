export const DEFAULT_ARTIFACT_BUDGET_BYTES=128*1024*1024;

// Deployment configuration is decimal bytes, not a coercible JavaScript value.
// This bounded database backend must not silently fall back on malformed input.
export function artifactBudgetBytes(env=process.env){
 const raw=env.POD_ARTIFACT_BUDGET_BYTES;
 if(raw===undefined)return DEFAULT_ARTIFACT_BUDGET_BYTES;
 if(typeof raw!=='string'||!/^[1-9][0-9]*$/.test(raw))throw Error('ARTIFACT_BUDGET_CONFIG_INVALID');
 const bytes=Number(raw);
 if(!Number.isSafeInteger(bytes)||bytes>DEFAULT_ARTIFACT_BUDGET_BYTES)throw Error('ARTIFACT_BUDGET_CONFIG_INVALID');
 return bytes;
}
