import {normalizeSocialUrl} from './social-intake.js';
// Customer handoff requires review of this exact render, not generation metadata.
export const CREATIVE_CHECKS = Object.freeze(['hook','story_escalation','visual_storytelling','character_consistency','voice_performance','sound_mix','pacing','phone_readability','payoff','factual_accuracy']);
function referenceIdentity(raw) {
 try {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  try {const normalized=normalizeSocialUrl(raw);return normalized.canonical_id.includes(':short-')?null:normalized.canonical_id;} catch {}
  // Unknown sites cannot establish distinct videos from tracking/query variants.
  return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/+$/,'');
 } catch {return null;}
}
const documented=value=>typeof value==='string'&&value.trim().length>=12;
export function creativeHandoff(review, hash, mediaEvidence) {
 const reasons=[];
 if(!hash || review?.candidate_sha256!==hash) reasons.push('exact_render_review_missing');
 if(review?.status!=='PASS'||review?.method!=='rendered_video_review') reasons.push('creative_review_pending');
 if(review?.full_video_review!==true||review?.full_audio_review!==true) reasons.push('complete_audiovisual_review_pending');
 for(const name of CREATIVE_CHECKS) if(review?.checks?.[name]?.pass!==true||typeof review.checks[name].evidence!=='string'||review.checks[name].evidence.trim().length<12) reasons.push(name+'_review_pending');
 const duration=mediaEvidence?.duration_seconds, coverage=review?.reviewed_intervals;
 if(mediaEvidence?.verified!==true||mediaEvidence?.candidate_sha256!==hash||!Number.isFinite(duration)||duration<=0||!Number.isFinite(review?.duration_seconds)||Math.abs(review.duration_seconds-duration)>.05)reasons.push('verified_media_duration_missing_or_mismatched');
 let end=0, complete=Number.isFinite(duration)&&duration>0&&Array.isArray(coverage)&&coverage.length>0;
 for(const interval of Array.isArray(coverage)?coverage:[]) {
  if(!Array.isArray(interval)||interval.length!==2||!interval.every(Number.isFinite)||interval[0]>end+.05||interval[0]<0||interval[1]<=interval[0]||interval[1]>duration+.05){complete=false;break;}
  end=Math.max(end,interval[1]);
 }
 if(!complete||end<duration-.05) reasons.push('review_coverage_incomplete');
 const refs=review?.comparisons;
 if(!Array.isArray(refs)||new Set(refs.filter(r=>r&&r.full_video_review===true&&r.full_audio_review===true&&r.access_scope==='full audiovisual review'&&documented(r.observation)&&documented(r.applied_difference)).map(r=>referenceIdentity(r.url)).filter(Boolean)).size<2) reasons.push('competitor_comparison_pending');
 if(!Array.isArray(review?.unresolved_issues)||review.unresolved_issues.length) reasons.push('unresolved_creative_issues');
 return {ready:reasons.length===0,reasons,publication:false};
}
