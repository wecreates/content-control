import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeAudioPadding} from './audio-mix-compat.mjs';
import {mapCCSDAudio,voiceLocks} from './ccsd-audio.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function fixture(){
 const samples=11025,wav=Buffer.alloc(44+samples*4);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
 wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(176400,28);
 wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*4,40);
 for(let i=0;i<samples;i++){const v=Math.round(3000*Math.sin(i*2*Math.PI*880/44100));wav.writeInt16LE(v,44+i*4);wav.writeInt16LE(v,46+i*4);}
 const ccsd={schema_version:1,project_id:'synthetic-map',publication_enabled:false,width:320,height:180,fps:24,
  scenes:[{id:'a',start:0,end:.5,story:{beat:'A'},audio:{dialogue:[{speaker:'narrator',text:'Original A'}]}},
   {id:'b',start:1,end:2,story:{beat:'B'},audio:{dialogue:[{speaker:'dave',text:'Original B'}]}}]};
 const manifest={publication_enabled:false,provider:'kokoro',voice_assignments:{...voiceLocks},clips:ccsd.scenes.map(s=>({
  scene_id:s.id,speaker:s.audio.dialogue[0].speaker,voice_id:voiceLocks[s.audio.dialogue[0].speaker],
  file:s.id+'.wav',duration:.25,text_sha256:sha(s.audio.dialogue[0].text),audio_sha256:sha(wav)}))};
 return {ccsd,manifest,snapshots:{'a.wav':wav,'b.wav':Buffer.from(wav)},options:{syntheticOnly:true,originalContentConfirmed:true,approvedSceneIds:['a','b']}};
}
const map=f=>mapCCSDAudio(f.ccsd,f.manifest,f.snapshots,f.options);
test('maps existing manifest bindings, preserves gaps/timeline/defaults and detaches bytes',()=>{
 const f=fixture(),before=JSON.stringify(f.ccsd),r=map(f);
 assert.deepEqual(r.sounds.map(s=>[s.at,s.to]),[[0,.25],[1,.25]]);assert.equal(r.receipt.duration_seconds,2);
 assert.equal(JSON.stringify(f.ccsd),before);assert.equal(r.receipt.default_engine,'remotion');
 assert.equal(r.receipt.runtime_enabled,false);assert.equal(r.receipt.publication_enabled,false);
 assert.equal(r.receipt.voice_identity_verified,false);assert.ok(r.html.includes('window.__filmSounds'));
 f.snapshots['a.wav'].fill(0);assert.equal(r.assets['a.wav'].toString('ascii',0,4),'RIFF');
});
test('rejects identity, text, hash, missing, truncated and swapped clips',()=>{
 for(const mutate of [f=>f.manifest.clips[0].voice_id='am_fenrir',f=>f.manifest.clips.reverse(),
  f=>f.ccsd.scenes[0].audio.dialogue[0].text='Changed',f=>f.snapshots['a.wav'][60]^=1,
  f=>delete f.snapshots['a.wav'],f=>{f.snapshots['a.wav']=f.snapshots['a.wav'].subarray(0,80);f.manifest.clips[0].audio_sha256=sha(f.snapshots['a.wav']);}]){
  const f=fixture();mutate(f);assert.throws(()=>map(f));
 }
});
test('rejects overrun, extra audio layers, multiple dialogues and unsafe paths',()=>{
 for(const mutate of [f=>f.ccsd.scenes[0].end=.1,f=>f.ccsd.scenes[0].audio.music={},
  f=>f.ccsd.scenes[0].audio.dialogue.push({...f.ccsd.scenes[0].audio.dialogue[0]}),
  f=>f.manifest.clips[0].file='../x.wav',f=>f.options.syntheticOnly=false,
  f=>f.manifest.voice_assignments.narrator='other']){const f=fixture();mutate(f);assert.throws(()=>map(f));}
});
test('mapped original PCM renders with exact duration, ordered cues, gaps and tail',()=>{
 const f=fixture(),r=map(f),dir=mkdtempSync(join(tmpdir(),'openfilm-ccsd-'));
 try{
  for(const [name,bytes] of Object.entries(r.assets))writeFileSync(join(dir,name),bytes);
  const input=r.sounds.flatMap(s=>['-i',join(dir,s.src)]);
  const chains=r.sounds.map((s,i)=>`[${i}:a]atrim=start=${s.from}:end=${s.to},asetpts=PTS-STARTPTS,volume=${s.volume},adelay=${s.at*1000}:all=1[a${i}]`);
  const graph=normalizeAudioPadding({inputs:input,filter:chains.join(';')+';[a0][a1]amix=inputs=2:normalize=0,apad=whole_dur=2,atrim=0:2[out]'},2);
  const out=spawnSync('ffmpeg',['-v','error',...input,'-filter_complex',graph.filter,'-map','[out]','-ac','1','-ar','44100','-f','f32le','-'],{timeout:15000,maxBuffer:1024*1024});
  assert.equal(out.status,0,out.stderr?.toString());assert.equal(out.stdout.length,2*44100*4);
  const rms=(a,b)=>{let sum=0;const start=Math.round(a*44100),end=Math.round(b*44100);for(let i=start;i<end;i++)sum+=out.stdout.readFloatLE(i*4)**2;return Math.sqrt(sum/(end-start));};
  assert.ok(rms(.05,.2)>.05&&rms(1.05,1.2)>.05);assert.equal(rms(.3,.9),0);assert.equal(rms(1.3,2),0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
