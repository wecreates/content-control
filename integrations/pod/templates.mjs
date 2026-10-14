import {verifyEnvelope,PLATFORMS} from './policy.mjs';
function provenance(envelope,key,{platform,product,country},audience,now){
 const record=verifyEnvelope(envelope,key,audience,now),t=record.template;
 let source;try{source=new URL(record.source_url);}catch{throw Error('TEMPLATE_PROVENANCE_REQUIRED');}
 if(!PLATFORMS.includes(platform)||t?.platform!==platform||
  typeof product!=='string'||!product.trim()||product.length>128||typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||
  record.product!==product||record.country!==country||record.official_source_verified!==true||
  source.protocol!=='https:'||source.username||source.password||
  typeof record.source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.source_sha256)||
  !Number.isFinite(Date.parse(record.observed_at))||Date.parse(record.observed_at)>now)throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 return t;
}
export function validateInteriorTemplate(envelope,key,scope,now=Date.now()){
 if(scope?.platform!=='kdp')throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 // Detailed interior geometry/font/page checks remain in the Python renderer.
 return provenance(envelope,key,scope,'pod:interior-template',now);
}
export function validateTemplate(envelope,key,scope,now=Date.now()){
 const t=provenance(envelope,key,scope,'pod:template',now);
 if(!Number.isInteger(t.dpi)||t.dpi<300||t.dpi>1200||!Array.isArray(t.size_inches)||t.size_inches.length!==2||t.size_inches.some(n=>!Number.isFinite(n)||n<=0))throw Error('TEMPLATE_SIZE_INVALID');
 const [w,h]=t.size_inches.map(n=>Math.ceil(n*t.dpi));
 if(w*h>100000000)throw Error('TEMPLATE_TOO_LARGE');
 const b=t.safe_box_px;
 if(!Array.isArray(b)||b.length!==4||b.some(n=>!Number.isInteger(n))||b[0]<0||b[1]<0||b[2]<=0||b[3]<=0||b[0]+b[2]>w||b[1]+b[3]>h)throw Error('TEMPLATE_SAFE_ZONE_INVALID');
 return t;
}

