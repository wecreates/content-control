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
