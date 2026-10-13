import {verifyEnvelope,PLATFORMS} from './policy.mjs';
export function validateTemplate(envelope,key,{platform,product,country},now=Date.now()){
 const record=verifyEnvelope(envelope,key,'pod:template',now),t=record.template;
 if(!PLATFORMS.includes(platform)||t?.platform!==platform||record.product!==product||record.country!==country||
  record.official_source_verified!==true||!/^https:\/\//.test(record.source_url||'')||
  !/^[a-f0-9]{64}$/.test(record.source_sha256||'')||!Number.isFinite(Date.parse(record.observed_at)))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 if(!Number.isInteger(t.dpi)||t.dpi<300||t.dpi>1200||!Array.isArray(t.size_inches)||t.size_inches.length!==2||t.size_inches.some(n=>!Number.isFinite(n)||n<=0))throw Error('TEMPLATE_SIZE_INVALID');
 const [w,h]=t.size_inches.map(n=>Math.ceil(n*t.dpi));
 if(w*h>100000000)throw Error('TEMPLATE_TOO_LARGE');
 const b=t.safe_box_px;
 if(!Array.isArray(b)||b.length!==4||b.some(n=>!Number.isInteger(n))||b[0]<0||b[1]<0||b[2]<=0||b[3]<=0||b[0]+b[2]>w||b[1]+b[3]>h)throw Error('TEMPLATE_SAFE_ZONE_INVALID');
 return t;
}
