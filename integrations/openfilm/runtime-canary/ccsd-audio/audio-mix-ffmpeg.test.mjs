// Executes installed FFmpeg only, using a generated oscillator and the captured
// pinned-runtime mix graph. No browser, imports, downloads or provider requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {normalizeAudioPadding} from './audio-mix-compat.mjs';
const original=JSON.parse(readFileSync(new URL('./mix-graph.fixture.json',import.meta.url),'utf8'));
function run(args){
 const r=spawnSync('ffmpeg',args,{timeout:30000,maxBuffer:8*1024*1024});
 assert.equal(r.status,0,r.error?.message||r.stderr?.toString());return r.stdout;
}
for(const duration of [4,5,6])test(`real PCM preserves all cues and fills ${duration}s timeline`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'openfilm-mix-regression-'));
 try{
  const tone=join(dir,'tone.wav');
  run(['-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=0.5','-c:a','pcm_s16le',tone]);
  const graph=normalizeAudioPadding({inputs:['-vn','-i',tone],filter:original.filter.replace(
   'apad=whole_dur=4,atrim=0:4[out]',`apad=whole_dur=${duration},atrim=0:${duration}[out]`)},duration);
  const pcm=run(['-v','error',...graph.inputs,'-filter_complex',graph.filter,'-map','[out]',
   '-t',String(duration),'-ac','1','-ar','48000','-f','f32le','-']);
  assert.equal(pcm.length,duration*48000*4,'full duration must contain actual samples');
  const rms=(a,b)=>{
   const from=Math.round(a*48000),to=Math.round(b*48000);
   let sum=0;for(let n=from;n<to;n++)sum+=pcm.readFloatLE(n*4)**2;
   return Math.sqrt(sum/(to-from));
  };
  const levels=[.25,1.25,2.25,3.25].map(t=>rms(t+.05,t+.2));
  assert.ok(levels.every(x=>x>.02),'all original tones survive');
  assert.ok(Math.abs(levels[1]/levels[0]-.5)<.001,'half-volume cue survives');
  for(const [a,b] of [[0,.25],[.5,1.25],[1.5,2.25],[2.5,3.25],[3.5,duration]])
   assert.ok(rms(a,b)<1e-7,`intended silence ${a}-${b}`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
