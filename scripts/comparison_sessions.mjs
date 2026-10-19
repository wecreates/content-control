import {completeCoverage} from '../creative-handoff.js';
const id=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

// Import only file-bound playback records. No telemetry field becomes a review claim.
export function importComparisonSessions(review,candidate,references,receipts){
 const reasons=[],sessions=new Map();
 if(!Array.isArray(receipts)||!receipts.length||receipts.length>20)return {reasons:['session_receipts_missing'],sessions:[]};
 for(const receipt of receipts){
  if(receipt?.method!=='manual_side_by_side_notes'||receipt.status!=='REVIEW_PENDING'||
     ['full_video_review','full_audio_review','production_approved','publication_enabled'].some(k=>receipt[k]!==false)){
   reasons.push('invalid_session_receipt');continue;
  }
  for(const role of ['candidate','reference']){
   const file=receipt[role],s=receipt.playback_sessions?.[role];
   if(!file||!s||!id(s.session_id)||!hash(s.artifact_sha256)||file.identity_verified!==true||
      s.artifact_sha256!==file.sha256||!Number.isSafeInteger(file.byte_length)||file.byte_length<=0||s.byte_length!==file.byte_length||
      !Number.isFinite(file.duration_seconds)||file.duration_seconds<=0||
      ['perception_verified','full_video_review','full_audio_review'].some(k=>s[k]!==false)||
      !Array.isArray(s.video_playback_intervals)||!Array.isArray(s.unmuted_playback_intervals)){
    reasons.push('invalid_session_identity');continue;
   }
   const previous=sessions.get(s.session_id);
   const source=role==='reference'?file.source_url:null;
   if(previous&&(previous.artifact_sha256!==s.artifact_sha256||previous.byte_length!==s.byte_length||previous.duration_seconds!==file.duration_seconds||previous.role!==role||previous.source_url!==source)){
    reasons.push('session_identity_reused');continue;
   }
   const current=previous||{session_id:s.session_id,artifact_sha256:s.artifact_sha256,byte_length:s.byte_length,duration_seconds:file.duration_seconds,role,source_url:source,video_playback_intervals:[],unmuted_playback_intervals:[]};
   current.video_playback_intervals.push(...s.video_playback_intervals);
   current.unmuted_playback_intervals.push(...s.unmuted_playback_intervals);
   sessions.set(s.session_id,current);
  }
 }
 const expected=[{claim:review,media:candidate,role:'candidate'},...references.map(media=>({claim:review.comparisons?.find(c=>c?.url===media.url),media,role:'reference'}))];
 const imported=[];
 for(const {claim,media,role} of expected){
  const s=sessions.get(claim?.review_session_id);
  if(!id(claim?.review_session_id)||!s||s.role!==role||s.artifact_sha256!==media.candidate_sha256||s.byte_length!==media.byte_length||
     Math.abs(s.duration_seconds-media.duration_seconds)>.05||(role==='reference'&&s.source_url!==media.url)){
   reasons.push('review_session_binding_missing_or_mismatched');continue;
  }
  if(!completeCoverage(s.video_playback_intervals,media.duration_seconds))reasons.push('video_playback_coverage_incomplete');
  if(!completeCoverage(s.unmuted_playback_intervals,media.duration_seconds))reasons.push('audio_playback_coverage_incomplete');
  imported.push({...s,perception_verified:false});
 }
 return {reasons:[...new Set(reasons)],sessions:imported};
}
