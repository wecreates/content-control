import {verifyEnvelope,PLATFORMS} from './policy.mjs';
import {validEvidenceTime} from './evidence-time.mjs';
function provenance(envelope,key,{platform,product,country},audience,now){
 const record=verifyEnvelope(envelope,key,audience,now),t=record.template;
 let source;try{source=new URL(record.source_url);}catch{throw Error('TEMPLATE_PROVENANCE_REQUIRED');}
 if(!PLATFORMS.includes(platform)||t?.platform!==platform||
  typeof product!=='string'||!product.trim()||product.length>128||typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||
  record.product!==product||record.country!==country||record.official_source_verified!==true||
  source.protocol!=='https:'||source.username||source.password||
  typeof record.source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.source_sha256)||
  !validEvidenceTime(record.observed_at,now))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 return t;
}
export function validateInteriorTemplate(envelope,key,scope,now=Date.now()){
 if(scope?.platform!=='kdp')throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 const t=provenance(envelope,key,scope,'pod:interior-template',now);
 // Necessary paperback baselines from KDP's G201834180, G202145400 and
 // G201857950, checked 2026-10-20. These do not validate a particular ink,
 // paper, marketplace or official calculator template, or approve content.
 const count=t?.page_count,trim=t?.trim_inches,m=t?.margins_inches;
 const number=n=>typeof n==='number'&&Number.isFinite(n);
 const minimumInside=Number.isInteger(count)
  ? (count<=150 ? .375 : count<=300 ? .5 : count<=500 ? .625 : count<=700 ? .75 : .875) : null;
 if(t?.binding!=='paperback'||t.interior_type!=='text_no_bleed'||
  !Number.isInteger(count)||count<24||count>828||
  !Array.isArray(trim)||trim.length!==2||!trim.every(number)||
  trim[0]<4||trim[0]>8.5||trim[1]<6||trim[1]>11.69||
  !number(t.font_size_pt)||t.font_size_pt<7||t.font_size_pt>72||
  !m||typeof m!=='object'||Array.isArray(m)||
  !['inside','outside','top','bottom'].every(k=>number(m[k]))||
  m.inside<minimumInside||
  Math.min(m.outside,m.top,m.bottom)<.25||
  m.inside+m.outside>=trim[0]||m.top+m.bottom>=trim[1])throw Error('KDP_PAPERBACK_SPEC_INVALID');
 // Actual PDF geometry, font embedding, text and cover pairing remain checked
 // by Python. Small technical fixtures are not production templates.
 return t;
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

