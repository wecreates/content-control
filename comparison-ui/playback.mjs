// Conservative playback telemetry, never perception or creative review evidence.
// Samples can document player progression only, not audible device output or attention.
export function createPlaybackTracker(sessionId) {
 let previous=null;
 const video=[],audio=[];
 const add=(ranges,start,end)=>{
  const merged=[];
  for(const row of [...ranges,[start,end]].sort((a,b)=>a[0]-b[0])){
   const last=merged.at(-1);
   if(last&&row[0]<=last[1])last[1]=Math.max(last[1],row[1]);
   else merged.push([...row]);
  }
  ranges.splice(0,ranges.length,...merged);
 };
 return {
  interrupt(){previous=null;},
  sample(s){
   if(!s||![s.time,s.duration,s.wall,s.rate].every(Number.isFinite)||s.duration<=0||s.time<0||s.time>s.duration||s.rate<=0||s.rate>2||s.playing!==true||s.visible!==true){previous=null;return;}
   if(previous){
    const wall=(s.wall-previous.wall)/1000,delta=s.time-previous.time;
    // Never bridge a stalled callback, backward movement, rate switch or seek.
    if(wall>0&&wall<=1&&delta>0&&delta<=wall*s.rate+.05&&s.rate===previous.rate){
     add(video,previous.time,s.time);
     if(previous.audible===true&&s.audible===true)add(audio,previous.time,s.time);
    }
   }
   previous={...s};
  },
  snapshot(identity){
   if(identity?.identity_verified!==true||!/^[a-f0-9]{64}$/.test(identity.sha256||''))throw Error('Playback session needs verified file identity');
   return {session_id:sessionId,artifact_sha256:identity.sha256,byte_length:identity.byte_length,
    video_playback_intervals:video.map(r=>[...r]),unmuted_playback_intervals:audio.map(r=>[...r]),
    perception_verified:false,full_video_review:false,full_audio_review:false,
    scope:'Player progression telemetry only; not frame-by-frame presentation, audible hardware output, human attention, or audiovisual observations.'};
  }
 };
}
