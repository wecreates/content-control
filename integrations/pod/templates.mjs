import {verifyEnvelope,PLATFORMS} from './policy.mjs';
import {validEvidenceTime} from './evidence-time.mjs';
import {requireKdpPaperbackOptions} from './kdp-paperback-options.mjs';
import {validOpaqueText,validPostgresText} from './text-identity.mjs';
function provenance(envelope,key,{platform,product,country},audience,now){
 const record=verifyEnvelope(envelope,key,audience,now),t=record.template;
 if(!validPostgresText(record.source_url))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 let source;try{source=new URL(record.source_url);}catch{throw Error('TEMPLATE_PROVENANCE_REQUIRED');}
 if(!PLATFORMS.includes(platform)||t?.platform!==platform||
  !validOpaqueText(product,{maxLength:128})||typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||
  record.product!==product||record.country!==country||record.official_source_verified!==true||
  source.protocol!=='https:'||source.username||source.password||
  typeof record.source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.source_sha256)||
  !validEvidenceTime(record.observed_at,now))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 if(audience==='pod:interior-template'&&(
  !validOpaqueText(record.source_member,{maxLength:512})||
  record.source_member.startsWith('/')||record.source_member.includes('\\')||
  record.source_member.split('/').some(part=>!part||part==='.'||part==='..')||
  !record.source_member.toLowerCase().endsWith('.docx')))throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 return t;
}
export function validateInteriorTemplate(envelope,key,scope,now=Date.now()){
 if(scope?.platform!=='kdp')throw Error('TEMPLATE_PROVENANCE_REQUIRED');
 const t=provenance(envelope,key,scope,'pod:interior-template',now);
 // General paperback baselines from KDP's G201834180, G202145400 and
 // G201857950, checked 2026-10-20. Option-specific limits follow below;
 // neither check is an official calculator template or content approval.
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
 requireKdpPaperbackOptions(t,scope.country);
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
 // KDP G201857950, checked 2026-10-20: critical cover content stays
 // at least .25 inch from the outside edge. Round toward the safe interior,
 // using declared physical size rather than the padded ceil-sized raster.
 if(scope.platform==='kdp'){
  const edge=Math.ceil(.25*t.dpi);
  if((t.art_is_critical!==undefined&&typeof t.art_is_critical!=='boolean')||
   b[0]<edge||b[1]<edge||b[0]+b[2]>Math.floor((t.size_inches[0]-.25)*t.dpi)||
   b[1]+b[3]>Math.floor((t.size_inches[1]-.25)*t.dpi))throw Error('TEMPLATE_SAFE_ZONE_INVALID');
 }
 return t;
}

// Necessary cover/interior agreement before any child stage. KDP G201857950,
// checked 2026-10-20, rounds manuscript pages up to even. This renderer does not
// add a blank page: require a newly reviewed even-page task instead of silently
// changing approved bytes or calculating a spine from an odd manuscript.
export function validateKdpTemplatePair(cover,interior){
 if(interior.page_count%2!==0)throw Error('KDP_PAGE_COUNT_REQUIRES_REVIEW');
 const k=cover?.kdp,number=n=>typeof n==='number'&&Number.isFinite(n);
 const equal=(a,b)=>number(a)&&Math.abs(a-b)<=1e-6;
 const factor=interior.paper_type==='white'?.002252:interior.paper_type==='cream'?.0025:.00235;
 const spine=interior.page_count*factor,[width,height]=interior.trim_inches;
 if(!k||k.binding!==interior.binding||k.ink_type!==interior.ink_type||
  k.paper_type!==interior.paper_type||k.page_count!==interior.page_count||
  !equal(k.trim_width_inches,width)||!equal(k.spine_width_inches,spine)||
  k.bleed_inches!==.125||!equal(cover.size_inches[0],2*width+spine+.25)||
  !equal(cover.size_inches[1],height+.25))throw Error('COVER_INTERIOR_MISMATCH');
}

export function kdpCalculatorProfile(cover,interior){
 validateKdpTemplatePair(cover,interior);
 // The retained guide inspector currently supports this explicit source format.
 // Its locale is not a claim of marketplace availability or regional rights.
 if(cover.kdp.reading_direction!=='left_to_right'||cover.kdp.locale!=='en_US')throw Error('KDP_TEMPLATE_PROFILE_INVALID');
 if(cover.kdp.barcode_mode!=='amazon_placed')throw Error('KDP_BARCODE_MODE_UNSUPPORTED');
 return {binding:interior.binding,ink_type:interior.ink_type,paper_type:interior.paper_type,
  reading_direction:cover.kdp.reading_direction,trim_inches:[...interior.trim_inches],
  page_count:interior.page_count,locale:cover.kdp.locale};
}


