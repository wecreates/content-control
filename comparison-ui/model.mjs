export function finding(candidate,reference,category,observation,repair){
 if(!candidate||!reference)throw Error('Load both videos first.');
 if(!observation.trim()||!repair.trim())throw Error('Describe the difference and required improvement.');
 for(const media of [candidate,reference])if(!Number.isFinite(media.duration)||media.duration<=0||!Number.isFinite(media.time)||media.time<0||media.time>media.duration)throw Error('Wait for both videos to load.');
 return {candidate_sec:candidate.time,reference_sec:reference.time,category,observation:observation.trim(),repair:repair.trim(),resolved:false};
}
export function receipt(candidate,reference,findings,sourceUrl){
 if(!candidate||!reference)throw Error('Load both videos first.');
 for(const media of [candidate,reference])if(media.identity_verified!==true||! /^[a-f0-9]{64}$/.test(media.sha256||''))throw Error('Wait for both file hashes to finish verifying before export.');
 if(sourceUrl){const u=new URL(sourceUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Use a public HTTPS reference link without credentials.');}
 return {schema_version:1,status:'REVIEW_PENDING',method:'manual_side_by_side_notes',candidate,reference:{...reference,source_url:sourceUrl||null},findings,full_video_review:false,full_audio_review:false,production_approved:false,publication_enabled:false,scope:'Reviewer notes only. Playback and file selection do not establish complete audiovisual review or competitor parity.'};
}
