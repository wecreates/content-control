import {createPlaybackTracker} from '../comparison-ui/playback.mjs';
import {receipt} from '../comparison-ui/model.mjs';
// SYNTHETIC player events; not playback or perception of real media.
export function syntheticSessions(files,review){
 const file=m=>({sha256:m.candidate_sha256,byte_length:m.byte_length,duration_seconds:m.duration_seconds,identity_verified:true});
 const snapshot=(m,id)=>{
  const t=createPlaybackTracker(id);let time=0;
  t.sample({time,wall:0,duration:m.duration_seconds,rate:1,playing:true,visible:true,audible:true});
  while(time<m.duration_seconds){time=Math.min(m.duration_seconds,time+.25);t.sample({time,wall:time*1000,duration:m.duration_seconds,rate:1,playing:true,visible:true,audible:true});}
  return t.snapshot(file(m));
 };
 review.review_session_id='a'.repeat(32);
 return files.slice(1).map(({media},i)=>{
  const ref=review.comparisons[i];ref.review_session_id=(i+1).toString(16).padStart(32,'0');
  return {...receipt(file(files[0].media),file(media),[],ref.url),playback_sessions:{
   candidate:snapshot(files[0].media,review.review_session_id),reference:snapshot(media,ref.review_session_id)}};
 });
}
