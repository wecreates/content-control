import {normalizeSocialUrl} from './social-intake.js';
// Customer handoff requires review of this exact render, not generation metadata.
export const CREATIVE_CHECKS = Object.freeze(['hook','story_escalation','visual_storytelling','character_consistency','voice_performance','sound_mix','pacing','phone_readability','payoff','factual_accuracy']);
function referenceIdentity(raw) {
 try {
  if(typeof raw!=='string')return null;
  // Only a recognized content ID establishes identity. A parse failure must not
  // turn a homepage, encoded alias, or unknown site into a distinct competitor.
  const normalized=normalizeSocialUrl(raw);
  // Redirect identity is determined by the unresolved source host, not by a
  // prefix that can also occur in a real provider's concrete content ID.
  const unresolved=['fb.watch','vm.tiktok.com','vt.tiktok.com','pin.it'].includes(new URL(normalized.source_url).hostname);
  return unresolved?null:normalized.canonical_id;
 } catch {return null;}
}
const documented=value=>typeof value==='string'&&value.trim().length>=12;
function completeCoverage(coverage,duration) {
 if(!Number.isFinite(duration)||duration<=0||!Array.isArray(coverage)||!coverage.length)return false;
 // One roundoff budget for the entire union, never a per-gap frame allowance.
 const tolerance=Number.EPSILON*Math.max(1,duration)*8;
 if(coverage.some(i=>!Array.isArray(i)||i.length!==2||!i.every(Number.isFinite)||i[0]<0||i[1]<=i[0]||i[1]>duration+tolerance))return false;
 let end=0,gaps=0;
 for(const [start,stop] of [...coverage].sort((a,b)=>a[0]-b[0])) {
  gaps+=Math.max(0,start-end);
  if(gaps>tolerance)return false;
  end=Math.max(end,stop);
 }
 return gaps+Math.max(0,duration-end)<=tolerance;
}
export function creativeHandoff(review, hash, mediaEvidence) {
 const reasons=[];
 // Shared strict evidence validation: hosted handoff and CLI must not disagree.
 if(review?.publication_enabled!==false)reasons.push('publication_lock_missing');
 if(!documented(review?.reviewer?.identity)||!documented(review?.reviewer?.method)||!documented(review?.reviewer?.evidence))reasons.push('reviewer_provenance_missing');
 const findings=review?.findings;
 if(!Array.isArray(findings))reasons.push('findings_missing');
 else {
  for(const f of findings) {
   if(!f||!['critical','major','minor'].includes(f.severity)||!Number.isFinite(f.start_sec)||!Number.isFinite(f.end_sec)||f.start_sec<0||f.end_sec<=f.start_sec||f.end_sec>mediaEvidence?.duration_seconds||!documented(f.evidence)||!documented(f.repair)||typeof f.category!=='string'||!f.category.trim()||typeof f.resolved!=='boolean')reasons.push('invalid_timestamped_finding');
  }
  for(const severity of ['critical','major'])if(!Number.isInteger(review[severity+'_count'])||review[severity+'_count']!==findings.filter(f=>f?.severity===severity).length)reasons.push(severity+'_count_mismatch');
  if(findings.some(f=>f?.resolved!==true))reasons.push('unresolved_findings');
  if(findings.some(f=>['critical','major'].includes(f?.severity)))reasons.push('material_findings_require_repair_and_new_review');
 }
 if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||review?.candidate_sha256!==hash) reasons.push('exact_render_review_missing');
 if(review?.status!=='PASS'||review?.method!=='rendered_video_review') reasons.push('creative_review_pending');
 if(review?.full_video_review!==true||review?.full_audio_review!==true) reasons.push('complete_audiovisual_review_pending');
 for(const name of CREATIVE_CHECKS) if(review?.checks?.[name]?.pass!==true||typeof review.checks[name].evidence!=='string'||review.checks[name].evidence.trim().length<12) reasons.push(name+'_review_pending');
 const duration=mediaEvidence?.duration_seconds, coverage=review?.reviewed_intervals;
 if(mediaEvidence?.verified!==true||mediaEvidence?.candidate_sha256!==hash||!Number.isFinite(duration)||duration<=0||!Number.isFinite(review?.duration_seconds)||review.duration_seconds<=0||Math.abs(review.duration_seconds-duration)>.05)reasons.push('verified_media_duration_missing_or_mismatched');
 if(!completeCoverage(coverage,duration))reasons.push('review_coverage_incomplete');
 const refs=review?.comparisons;
 if(!Array.isArray(refs)||new Set(refs.filter(r=>r&&r.full_video_review===true&&r.full_audio_review===true&&r.access_scope==='full audiovisual review'&&documented(r.observation)&&documented(r.applied_difference)).map(r=>referenceIdentity(r.url)).filter(Boolean)).size<2) reasons.push('competitor_comparison_pending');
 if(!Array.isArray(review?.unresolved_issues)||review.unresolved_issues.length) reasons.push('unresolved_creative_issues');
 return {ready:reasons.length===0,reasons:[...new Set(reasons)],publication:false};
}
