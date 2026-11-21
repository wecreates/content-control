import {reviewSource} from './scripts/exact_av_review.mjs';

// One retained-preview registration, not generic queue ingestion.
// This is a recorded artifact handoff, not live media availability or approval.
export function registeredCreativeReview(record, requestedSha) {
 const source=reviewSource(record?.source_run,{repository:'wecreates/content-control',runId:'44843599200',format:'v2-preview'});
 const {render,request,offline,sample}=record;
 const digest=source.expected_sha256;
 const locked=x=>x?.publication_enabled===false&&x?.production_approved===false;
 if(requestedSha!==digest||record.schema_version!==1||record.candidate_sha256!==digest||
    ![record,render,request,offline,sample].every(locked)||
    record.status!=='REVIEW_PENDING'||!Number.isFinite(Date.parse(record.recorded_at))||
    Date.parse(record.recorded_at)>Date.now()+60000||
    render.candidate_sha256!==digest||render.status!=='RENDERED_AWAITING_CREATIVE_REVIEW'||
    render.source_commit!=='540deda50211cd5351f66374d66b4de6322e273a'||
    render.full_decode_passed!==true||render.video_frames!==841||
    render.preview_flags?.groundedPreview!==true||render.preview_flags?.stylePreview!==true||
    request.status!=='REVIEW_REQUIRED'||request.media?.candidate_sha256!==digest||
    request.media.verified!==true||Math.abs(request.media.duration_seconds-render.video_duration_seconds)>.001||
    offline.candidate_sha256!==digest||offline.status!=='REVIEW_PENDING'||offline.technical_decode!=='PASS'||
    offline.full_video_review!==false||offline.full_audio_review!==false||
    sample.candidate_sha256!==digest||sample.status!=='SAMPLED_FRAMES_REVIEWED_FULL_AV_REVIEW_PENDING'||
    !Array.isArray(sample.reviewed_frames)||sample.reviewed_frames.length!==10||
    new Set(sample.reviewed_frames).size!==10||sample.reviewed_frames.some(n=>!Number.isInteger(n)||n<0||n>=841)||
    !Number.isFinite(request.media.duration_seconds)||!Number.isFinite(render.video_duration_seconds)||
    record.artifact_expires_at!=='2026-12-05T00:25:49Z'||
    !Array.isArray(sample.observations)||sample.observations.some(s=>typeof s!=='string')||
    !Array.isArray(sample.blocking_findings_in_sample)||sample.blocking_findings_in_sample.length!==0||
    !/^[a-f0-9]{64}$/.test(record.packet_manifest_sha256)||record.audio_packet_count!==4)
  throw Error('CREATIVE_REVIEW_REGISTRATION_INVALID');
 const expired=Date.parse(record.artifact_expires_at)<=Date.now();
 return {schema_version:1,status:expired?'REVIEW_PENDING_ARTIFACT_EXPIRED':'REVIEW_PENDING',candidate_sha256:digest,recorded_at:record.recorded_at,
  source_run_id:44843599200,source_commit:render.source_commit,
  artifact_expires_at:record.artifact_expires_at,artifact_expired:expired,artifact_availability:expired?'EXPIRED':'NOT_LIVE_VERIFIED',
  artifact_url:expired?null:'https://github.com/wecreates/content-control/actions/runs/44843599200/artifacts/14681379738',
  recorded_technical_decode:'PASS',duration_seconds:request.media.duration_seconds,
  sampled_frame_review:{status:'SAMPLED_ONLY',frame_numbers:sample.reviewed_frames,observations:sample.observations},
  review_packet:{status:'PREPARED_NOT_REVIEWED',audio_packet_count:4,manifest_sha256:record.packet_manifest_sha256},
  full_av_review:false,full_audio_review:false,full_video_review:false,
  review_status:'FULL_AUDIOVISUAL_AND_REFERENCE_REVIEW_REQUIRED',
  artifact_bytes_available_here:false,watch_url:null,media_url:null,
  publication_enabled:false,production_approved:false,
  scope:'Single retained-preview, recorded exact-hash external artifact registration. No live artifact-byte verification, motion/listening certification, production activation, or inherited prior-candidate verdict.'};
}
