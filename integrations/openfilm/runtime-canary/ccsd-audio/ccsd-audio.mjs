// Disabled synthetic candidate: consumes existing PCM snapshots; never synthesizes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildOpenFilmDraft} from './storyboard-adapter.mjs';
export const voiceLocks=Object.freeze({dave:'am_fenrir',points_monk:'am_michael',narrator:'am_adam'});
const sha=b=>createHash('sha256').update(b).digest('hex');
function pcmDuration(bytes){
 assert.ok(Buffer.isBuffer(bytes)&&bytes.length>=44&&bytes.length<=30*44100*4+4096,'Bounded WAV snapshot required');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
 assert.equal(bytes.readUInt32LE(4)+8,bytes.length,'Truncated WAV');
 let format,data;
 for(let i=12;i+8<=bytes.length;){
  const name=bytes.toString('ascii',i,i+4),n=bytes.readUInt32LE(i+4);i+=8;
  assert.ok(i+n<=bytes.length,'Truncated chunk');
  if(name==='fmt '){assert.ok(!format&&n>=16);format=bytes.subarray(i,i+n);}
  if(name==='data'){assert.equal(data,undefined,'Duplicate data');data=bytes.subarray(i,i+n);}
  i+=n+(n%2);
 }
 assert.ok(format&&data&&data.length>0&&data.length%4===0);
 assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),2);
 assert.equal(format.readUInt32LE(4),44100);assert.equal(format.readUInt16LE(12),4);
 assert.equal(format.readUInt16LE(14),16);
 return data.length/(44100*4);
}
export function mapCCSDAudio(ccsd,manifest,snapshots,options){
 assert.equal(options?.syntheticOnly,true,'Synthetic candidate only');
 const draft=buildOpenFilmDraft(ccsd,options);
 assert.ok(draft.receipt.duration_seconds<=30);
 assert.equal(manifest.publication_enabled,false);assert.equal(manifest.provider,'kokoro');
 assert.deepEqual(manifest.voice_assignments,voiceLocks,'Locked assignments changed');
 const selected=ccsd.scenes.filter(s=>options.approvedSceneIds.includes(s.id));
 const turns=[];
 for(const scene of selected){
  const audio=scene.audio??{};
  assert.ok(Object.keys(audio).every(k=>k==='dialogue'),'Unsupported audio layer');
  const dialogue=audio.dialogue??[];assert.ok(Array.isArray(dialogue)&&dialogue.length<=1,'One dialogue per scene required');
  for(const d of dialogue){assert.ok(typeof d.text==='string'&&d.text.trim());turns.push({scene,d});}
 }
 assert.ok(turns.length>0&&turns.length<=32);assert.equal(manifest.clips.length,turns.length);
 const sounds=[],bindings=[],assets={};
 for(const [i,{scene,d}] of turns.entries()){
  const clip=manifest.clips[i];assert.equal(clip.scene_id,scene.id);assert.equal(clip.speaker,d.speaker);
  assert.ok(Object.hasOwn(voiceLocks,d.speaker));assert.equal(clip.voice_id,voiceLocks[d.speaker]);
  assert.equal(clip.text_sha256,sha(d.text.trim()));
  assert.match(clip.file,/^[a-zA-Z0-9_-]+\.wav$/,'Local flat WAV name required');
  const bytes=snapshots[clip.file];assert.equal(sha(bytes),clip.audio_sha256,'Audio hash mismatch');
  assets[clip.file]=Buffer.from(bytes);
  const duration=pcmDuration(bytes),end=scene.start+duration;
  assert.ok(Math.abs(duration-clip.duration)<1/44100,'Declared duration mismatch');
  assert.ok(end<=scene.end&&end<=(turns[i+1]?.scene.start??draft.receipt.duration_seconds),'Audio would overrun scene; never trim');
  sounds.push({src:clip.file,at:scene.start,from:0,to:duration,volume:1});
  bindings.push({scene_id:scene.id,speaker:d.speaker,voice_id:clip.voice_id,audio_sha256:clip.audio_sha256,start:scene.start,end});
 }
 const script=`window.__filmSounds=()=>${JSON.stringify(sounds)};`;
 return {html:draft.html.replace('</script>',script+'</script>'),sounds,assets,receipt:{...draft.receipt,
  status:'SYNTHETIC_AUDIO_MAPPING_ONLY',audio_rendered:false,voice_identity_verified:false,
  audio_bindings:bindings,untranslated_layers:draft.receipt.untranslated_layers.map(x=>({...x,layers:x.layers.filter(k=>k!=='audio')})).filter(x=>x.layers.length)}};
}
