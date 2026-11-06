// Storage retention is a safety boundary, so never let Date.parse normalize an
// ambiguous date, offset, whitespace or non-canonical fractional precision.
// Accept the two UTC forms emitted by common provider APIs and Date#toISOString.
export const validDateMs=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
export function parseStorageExpiry(value){
 if(typeof value!=='string')return NaN;
 const parsed=Date.parse(value);
 if(!validDateMs(parsed))return NaN;
 const canonical=new Date(parsed).toISOString();
 return value===canonical||value===canonical.replace('.000Z','Z')?parsed:NaN;
}
// Configuration telemetry only: a valid window is not provider retention,
// backup/recovery evidence or permission to activate production.
export function storageLifetimeStatus(value,now=Date.now()){
 const expires=parseStorageExpiry(value),configured=validDateMs(expires);
 const status=value===undefined?'UNCONFIGURED':!configured?'INVALID':!validDateMs(now)?'CLOCK_INVALID':
  expires<=now?'EXPIRED':expires-now<=86400000?'EXPIRING':'CONFIGURED_WINDOW_VALID';
 return {status,operational_cutoff:configured?new Date(expires).toISOString():null,
  scope:'configured_cutoff_only',acceptance_verified:false};
}
