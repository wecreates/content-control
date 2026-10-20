import crypto from 'node:crypto';
import {parseSignedJSON} from './signed-json.mjs';
export const PLATFORMS = Object.freeze(['kdp','redbubble','teepublic','zazzle','spreadshirt']);
const modes = Object.freeze({RESEARCH:0,PRELAUNCH:1,LAUNCH:2});
const evidenceId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=256;
export const BRIDGE_RULES = Object.freeze([
 'Content Control may never exceed the business max_mode',
 'LAUNCH CTA is blocked unless launch_content_allowed=true',
 'Unverified facts are converted to questions/hypotheses or omitted',
 'Physical product shipping/safety/warranty claims require verified provider data',
 'Verified revenue/profit claims require Money Factory verified events',
 'Publication remains false unless explicitly enabled'
]);
export function assertBridge(bridge) {
 if(bridge?.producer!=='CYZOR Money Factory'||bridge?.consumer!=='Content Control'||
  !BRIDGE_RULES.every(x=>bridge?.contract?.fail_closed_rules?.includes(x))) throw Error('BRIDGE_CONTRACT_INVALID');
}
export function verifyEnvelope(envelope,key,audience,now=Date.now()) {
 if(typeof key!=='string'||Buffer.byteLength(key)<32) throw Error('SIGNING_KEY_REQUIRED');
 if(typeof envelope?.payload!=='string'||Buffer.byteLength(envelope.payload)>262144||
  typeof envelope.signature!=='string'||envelope.signature.length!==64||
  !/^[a-f0-9]{64}$/.test(envelope.signature)) throw Error('ENVELOPE_INVALID');
 const expected=crypto.createHmac('sha256',key).update(envelope.payload).digest();
 if(!crypto.timingSafeEqual(expected,Buffer.from(envelope.signature,'hex'))) throw Error('SIGNATURE_INVALID');
 const p=parseSignedJSON(envelope.payload);
 // Relational comparisons coerce values and are all false for NaN. Validate
 // the clock and signed millisecond integers before making an expiry decision.
 if(!p||typeof p!=='object'||Array.isArray(p)||!Number.isSafeInteger(now)||now<0||p.audience!==audience||p.schema_version!==1||
  !Number.isSafeInteger(p.issued_at_ms)||p.issued_at_ms<0||
  !Number.isSafeInteger(p.expires_at_ms)||p.expires_at_ms<0||p.issued_at_ms>now||p.expires_at_ms<=now||
  p.expires_at_ms-p.issued_at_ms>900000) throw Error('ENVELOPE_EXPIRED_OR_INVALID');
 return p;
}
export function enforceBrief(grant,job,{publishing=false}={}) {
 if(!PLATFORMS.includes(job?.platform)||job.destination_platform!==job.platform) throw Error('PLATFORM_BLOCKED');
 if(!job.id||!job.account_id||!job.business_id||grant.job_id!==job.id||
  grant.account_id!==job.account_id||grant.platform!==job.platform||grant.business_id!==job.business_id) throw Error('GRANT_SCOPE_MISMATCH');
 if(grant.revoked!==false) throw Error('APPROVAL_REVOKED');
 if(publishing||job.mode==='LAUNCH'){
  if(grant.publication_permission!==true)throw Error('PUBLICATION_PERMISSION_REQUIRED');
 }else if(grant.production_permission!==true&&grant.publication_permission!==true)throw Error('PRODUCTION_PERMISSION_REQUIRED');
 // Property lookups coerce arrays/objects; launch checks use exact strings.
 // Both must interpret the same mode before any brief is authorized.
 if(typeof job.mode!=='string'||typeof grant.max_mode!=='string'||
  !Object.hasOwn(modes,job.mode)||!Object.hasOwn(modes,grant.max_mode)||modes[job.mode]>modes[grant.max_mode]) throw Error('READINESS_CEILING');
 if((job.mode==='LAUNCH'||publishing)&&grant.launch_content_allowed!==true) throw Error('LAUNCH_BLOCKED');
 if(publishing&&(job.mode!=='LAUNCH'||typeof job.package_sha256!=='string'||
  !/^[a-f0-9]{64}$/.test(job.package_sha256)||grant.package_sha256!==job.package_sha256)) throw Error('RELEASE_SCOPE_MISMATCH');
 if(job.task_sha256!==undefined&&(!/^[a-f0-9]{64}$/.test(job.task_sha256)||grant.task_sha256!==job.task_sha256))throw Error('TASK_SCOPE_MISMATCH');
 const facts=grant.verified_facts&&typeof grant.verified_facts==='object'&&!Array.isArray(grant.verified_facts)?grant.verified_facts:{};
 // Downstream metadata comes ONLY from the signed upstream allowlist, never arbitrary client text.
 const forbidden=new Set(Array.isArray(grant.forbidden_claims)?grant.forbidden_claims:[]);
 // A verified flag cannot turn missing/malformed references into evidence.
 // Match the existing economics reference bounds without repairing identifiers.
 const approved=Object.fromEntries(Object.entries(facts).filter(([k,v])=>evidenceId(k)&&v?.verified===true&&
  typeof v.value==='string'&&v.value.trim().length>0&&!forbidden.has(k)&&!forbidden.has(v.value)&&
  Array.isArray(v.evidence_ids)&&v.evidence_ids.length>0&&v.evidence_ids.length<=32&&
  v.evidence_ids.every(evidenceId)&&new Set(v.evidence_ids).size===v.evidence_ids.length));
 for(const [k,v] of Object.entries(approved)) {
  if(['shipping','safety','warranty'].includes(k)&&v.provider_verified!==true) delete approved[k];
  if(['revenue','profit'].includes(k)&&v.money_factory_event_verified!==true) delete approved[k];
 }
 return {id:job.id,account_id:job.account_id,business_id:job.business_id,platform:job.platform,
  destination_platform:job.platform,mode:job.mode,package_sha256:job.package_sha256,
  ...(job.task_sha256?{task_sha256:job.task_sha256}:{}),facts:approved,price:grant.price?.verified===true&&evidenceId(grant.price?.evidence_id)&&
   Number.isSafeInteger(grant.price.amount_minor)&&grant.price.amount_minor>=0&&
   typeof grant.price.currency==='string'&&grant.price.currency.length===3&&/^[A-Z]{3}$/.test(grant.price.currency)?grant.price:null};
}
export const REQUIRED_QA=['text','geometry','resolution','rights','competitive','print_preflight','original_source','text_provenance'];
export function enforceQA(qa,packageHash,templateHash,platform) {
 if(typeof packageHash!=='string'||!/^[a-f0-9]{64}$/.test(packageHash)||
  typeof templateHash!=='string'||!/^[a-f0-9]{64}$/.test(templateHash)||
  qa?.verdict!=='PASS'||qa.package_sha256!==packageHash||qa.template_sha256!==templateHash||
  !REQUIRED_QA.every(k=>qa.checks?.[k]===true)||
  (platform==='kdp'&&(qa.checks?.editorial!==true||qa.checks?.template_provenance!==true||qa.checks?.manuscript_provenance!==true))) throw Error('QA_BLOCKED');
}


