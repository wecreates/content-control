import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);

export function validateSourceTrim(clip,probe){
 const stream=probe.streams?.find(s=>s.codec_type==='audio');
 const rate=Number(stream?.sample_rate),duration=Number(stream?.duration);
 assert.ok(Number.isFinite(rate)&&rate>0&&Number.isFinite(duration)&&duration>0,'Source audio duration unavailable');
 assert.ok(Number.isFinite(clip.from)&&clip.from>=0&&Number.isFinite(clip.to)&&clip.to>clip.from,'Invalid source audio trim');
 // Allow only timestamp rounding within one sample; never silently truncate a cue.
 assert.ok(clip.to<=duration+1/rate,'Source audio trim exceeds available duration');
 return {sample_rate:rate,channels:stream.channels,duration};
}

export async function validateAudioSources(clips,signal){
 const probes=new Map();
 for(const clip of clips){
  if(signal?.aborted)throw Error('cancelled');
  if(!probes.has(clip.file)){
   const {stdout}=await execute('ffprobe',['-v','error','-show_streams','-of','json',clip.file],
    {signal,timeout:10000,maxBuffer:1024*1024,windowsHide:true});
   probes.set(clip.file,JSON.parse(stdout));
  }
  validateSourceTrim(clip,probes.get(clip.file));
 }
}
