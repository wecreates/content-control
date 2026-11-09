import assert from 'node:assert/strict';
// Compare every video frame and every 5ms decoded PCM window with the test schedule.
export function verifyTimeline(gray,pcm,cues,{fps=24,duration=4,rate=48000}={}){
 const frameBytes=8*8,frameCount=duration*fps;
 assert.equal(gray.length,frameBytes*frameCount,'decoded frame count');
 const videoOn=[];
 for(let i=0;i<frameCount;i++){
  const mean=gray.subarray(i*frameBytes,(i+1)*frameBytes).reduce((a,b)=>a+b,0)/frameBytes;
  const on=mean>128,expected=cues.some(c=>i/fps>=c&&i/fps<c+.25);
  assert.equal(on,expected,`visual cue frame ${i}`);
  if(on)videoOn.push(i);
 }
 assert.ok(pcm.length/4>=(cues.at(-1)+.25)*rate,'audio samples cover last cue');
 const step=240,rms=[];
 for(let i=0;i+step<=Math.min(duration*rate,pcm.length/4);i+=step){
  let sum=0;for(let j=i;j<i+step;j++){const x=pcm.readFloatLE(j*4);assert.ok(Number.isFinite(x));sum+=x*x;}
  rms.push(Math.sqrt(sum/step));
 }
 const active=rms.map(x=>x>.015),segments=[];
 for(let i=0;i<active.length;i++)if(active[i]&&(i===0||!active[i-1])){
  let end=i+1;while(active[end])end++;
  segments.push({start:i*.005,end:end*.005});
 }
 assert.equal(segments.length,cues.length,'audio cue count (missing audio must fail)');
 const timing=segments.map((s,i)=>{
  const visualStart=videoOn.find(f=>f>=Math.round(cues[i]*fps))/fps;
  assert.ok(Math.abs(s.start-visualStart)<=1/fps,`audio/video onset ${i}`);
  assert.ok(Math.abs(s.end-(cues[i]+.25))<=1/fps,`audio offset ${i}`);
  return {...s,visualStart,delta_seconds:s.start-visualStart};
 });
 const centers=cues.map(c=>rms[Math.round((c+.125)/.005)]);
 assert.ok(centers[1]/centers[0]>.4&&centers[1]/centers[0]<.6,'half-gain cue');
 return {frames_checked:frameCount,pcm_windows_checked:rms.length,tolerance_seconds:1/fps,timing,
  half_gain_ratio:centers[1]/centers[0]};
}
