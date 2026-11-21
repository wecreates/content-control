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
 const diagnostic=record.provider_diagnostic;
 const control=diagnostic?.audio_only_control;
 if(diagnostic!==undefined) {
  const started=Date.parse(diagnostic.started_at),finished=Date.parse(diagnostic.finished_at);
  if(diagnostic.provider!=='PUBLIC_QWEN_DEMO_DASHSCOPE'||diagnostic.candidate_sha256!==digest||
     diagnostic.decoded_audio_sha256!==offline.files?.['final-mix.wav']||
     !/^[a-f0-9]{64}$/.test(diagnostic.source_application_sha256)||
     !/^[a-f0-9]{64}$/.test(diagnostic.source_receipt_sha256)||
     typeof diagnostic.started_at!=='string'||typeof diagnostic.finished_at!=='string'||
     !Number.isFinite(started)||!Number.isFinite(finished)||finished<started||finished>Date.now()+60000||
     diagnostic.status!=='REMOTE_EVENT_ERROR'||diagnostic.result_error_code!=='EVENT_RESULT_NOT_FOUND'||
     diagnostic.remote_execution_status!=='UNKNOWN'||
     JSON.stringify(diagnostic.uploaded_modalities)!==JSON.stringify(['video','audio'])||
     diagnostic.response_received!==false||diagnostic.full_av_review!==false||!locked(diagnostic))
   throw Error('PROVIDER_DIAGNOSTIC_INVALID');
  if(control!==undefined) {
   const started=Date.parse(control.started_at),finished=Date.parse(control.finished_at);
   if(control.candidate_sha256!==digest||control.decoded_audio_sha256!==diagnostic.decoded_audio_sha256||
      control.source_application_sha256!==diagnostic.source_application_sha256||
      !/^[a-f0-9]{64}$/.test(control.source_receipt_sha256)||
      typeof control.started_at!=='string'||typeof control.finished_at!=='string'||
      !Number.isFinite(started)||!Number.isFinite(finished)||finished<started||finished>Date.now()+60000||
      control.status!=='REMOTE_EVENT_ERROR'||control.result_error_code!=='EVENT_ERROR_WITHOUT_DETAILS'||
      control.remote_execution_status!=='UNKNOWN'||JSON.stringify(control.uploaded_modalities)!==JSON.stringify(['audio'])||
      control.response_received!==false||control.full_av_review!==false||!locked(control))
    throw Error('PROVIDER_CONTROL_DIAGNOSTIC_INVALID');
  }
 }
 const expired=Date.parse(record.artifact_expires_at)<=Date.now();
 return {schema_version:1,status:expired?'REVIEW_PENDING_ARTIFACT_EXPIRED':'REVIEW_PENDING',candidate_sha256:digest,recorded_at:record.recorded_at,
  source_run_id:44843599200,source_commit:render.source_commit,
  artifact_expires_at:record.artifact_expires_at,artifact_expired:expired,artifact_availability:expired?'EXPIRED':'NOT_LIVE_VERIFIED',
  artifact_url:expired?null:'https://github.com/wecreates/content-control/actions/runs/44843599200/artifacts/14681379738',
  recorded_technical_decode:'PASS',duration_seconds:request.media.duration_seconds,
  sampled_frame_review:{status:'SAMPLED_ONLY',frame_numbers:sample.reviewed_frames,observations:sample.observations},
  review_packet:{status:'PREPARED_NOT_REVIEWED',audio_packet_count:4,manifest_sha256:record.packet_manifest_sha256},
  provider_diagnostic:diagnostic?{
   provider:diagnostic.provider,attempt_type:'combined_audio_video',candidate_sha256:digest,status:diagnostic.status,result_error_code:diagnostic.result_error_code,remote_execution_status:'UNKNOWN',
   started_at:diagnostic.started_at,finished_at:diagnostic.finished_at,
   source_application_sha256:diagnostic.source_application_sha256,source_receipt_sha256:diagnostic.source_receipt_sha256,
   decoded_audio_sha256:diagnostic.decoded_audio_sha256,uploaded_modalities:['video','audio'],
   response_received:false,full_av_review:false,publication_enabled:false,production_approved:false,
   audio_only_control:control?{
    attempt_type:'audio_only_control',candidate_sha256:digest,decoded_audio_sha256:control.decoded_audio_sha256,
    source_application_sha256:control.source_application_sha256,source_receipt_sha256:control.source_receipt_sha256,
    started_at:control.started_at,finished_at:control.finished_at,status:control.status,result_error_code:control.result_error_code,
    remote_execution_status:'UNKNOWN',uploaded_modalities:['audio'],response_received:false,full_av_review:false,
    publication_enabled:false,production_approved:false
   }:null,
   scope:'Recorded provider attempt returned no observations. Remote processing, modality consumption and coverage remain unknown; no creative verdict exists.'
  }:null,
  full_av_review:false,full_audio_review:false,full_video_review:false,
  review_status:'FULL_AUDIOVISUAL_AND_REFERENCE_REVIEW_REQUIRED',
  artifact_bytes_available_here:false,watch_url:null,media_url:null,
  publication_enabled:false,production_approved:false,
  scope:'Single retained-preview, recorded exact-hash external artifact registration. No live artifact-byte verification, motion/listening certification, production activation, or inherited prior-candidate verdict.'};
}
