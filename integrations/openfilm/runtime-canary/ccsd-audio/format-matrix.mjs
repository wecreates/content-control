// Real isolated FFmpeg/pinned-runtime matrix. Original oscillators only.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {mixGraph,ffmpeg} from '/app/src/shared.mjs';
import {closeBrowsers} from '/app/src/host.mjs';
import {normalizeAudioPadding} from './audio-mix-compat.mjs';
import {renderCandidate} from './render-candidate.mjs';
import {fixtureHTML} from './scene-fixture.mjs';
const report={mode:'formats',synthetic_only:true,publication_enabled:false,cases:[]};
const command=(args)=>{const r=spawnSync('ffmpeg',args,{timeout:30000,maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr?.toString());return r.stdout;};
try{
 mkdirSync('/tmp/format-fixture',{recursive:true});
 for(const spec of [{name:'mono16',rate:16000,stereo:false},{name:'mono48',rate:48000,stereo:false},
  {name:'stereo44',rate:44100,stereo:true},{name:'stereo48',rate:48000,stereo:true},
  {name:'silence',rate:44100,stereo:true,silent:true},{name:'overlap',rate:48000,stereo:false,overlap:true}]){
  const file='/tmp/format-fixture/'+spec.name+'.wav';
  const left=spec.silent?'0':'0.1*sin(2*PI*440*t)';
  const expr=spec.stereo?left+'|'+(spec.silent?'0':'0.05*sin(2*PI*440*t)'):left;
  command(['-v','error','-f','lavfi','-i',`aevalsrc=${expr}:s=${spec.rate}:d=0.5`,'-c:a','pcm_s16le',file]);
  const clip={file,at:0,from:0,to:.5,volume:1,speed:1};
  const clips=spec.overlap?[clip,{...clip,at:.25}]:[clip];
  const graph=normalizeAudioPadding(mixGraph(clips,1),1),output='/tmp/format-fixture/mix.wav';
  await ffmpeg([...graph.inputs,'-filter_complex',graph.filter,'-map','[out]','-c:a','pcm_s16le',output]).done;
  const pcm=command(['-v','error','-i',output,'-ac','2','-ar','48000','-f','f32le','-']);
  assert.equal(pcm.length,48000*2*4);
  const rms=(a,b,ch=0)=>{let sum=0;for(let n=Math.round(a*48000);n<Math.round(b*48000);n++)sum+=pcm.readFloatLE((n*2+ch)*4)**2;return Math.sqrt(sum/Math.round((b-a)*48000));};
  const level=rms(.05,.2),ratio=spec.silent?null:rms(.05,.2,1)/level;
  if(spec.silent)assert.equal(rms(0,1),0);
  else {assert.ok(level>.04);assert.ok(Math.abs(ratio-(spec.stereo?.5:1))<.002);}
  if(spec.overlap)assert.ok(Math.abs(rms(.3,.45)/level-2)<.003);
  assert.equal(rms(spec.overlap?.8:.6,1),0);
  report.cases.push({name:spec.name,source_rate:spec.rate,source_channels:spec.stereo?2:1,output_rate:48000,output_channels:2,duration:1,level,channel_ratio:ratio,passed:true});
 }
 // The declared source trim ends at .35s, beyond this .2s file.
 command(['-v','error','-f','lavfi','-i','sine=sample_rate=48000:duration=0.2','-c:a','pcm_s16le','/tmp/format-fixture/tone.wav']);
 writeFileSync('/tmp/format-fixture/index.html',fixtureHTML());
 let failure;
 try{await renderCandidate(['/tmp/format-fixture/index.html'],{out:'/out/short-source.mp4',fps:24,workers:1,hardware:false,seekable:false,
  format:{video:['-c:v','libx264','-threads','2','-filter_threads','1']}});}catch(e){failure=e.message;}
 report.short_source_error=failure??null;
 assert.match(failure??'',/Source audio trim exceeds available duration/);
 assert.equal(existsSync('/out/short-source.mp4'),false);
 assert.deepEqual(readdirSync('/out').filter(x=>x.startsWith('.audio-candidate-')),[]);
 report.short_source_rejected=true;
 for(const [name,html,pattern] of [
  ['timeline-overrun',fixtureHTML().replace('to:.35','to:5'),/Bounded audio clip required/],
  ['invalid-audio',fixtureHTML(),/Required audio stream missing or invalid|Invalid data found when processing input/]]){
  if(name==='invalid-audio')writeFileSync('/tmp/format-fixture/tone.wav','not an audio file');
  writeFileSync('/tmp/format-fixture/index.html',html);
  await assert.rejects(renderCandidate(['/tmp/format-fixture/index.html'],{out:`/out/${name}.mp4`}),pattern);
  assert.equal(existsSync(`/out/${name}.mp4`),false);
  assert.deepEqual(readdirSync('/out').filter(x=>x.startsWith('.audio-candidate-')),[]);
  report.cases.push({name,rejected:true,passed:true});
 }
 report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}
finally{await closeBrowsers();writeFileSync('/out/formats-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
