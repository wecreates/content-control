// Disabled, isolated acceptance candidate for the pinned runtime only.
// No upstream files are modified. Only full original local timelines are supported.
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {render} from '/app/src/render.mjs';
import {open,filmSound,mixGraph,ffmpeg,kill} from '/app/src/shared.mjs';
import {normalizeAudioPadding} from './audio-mix-compat.mjs';
import {runAudioProcess} from './audio-process.mjs';

export async function renderCandidate(args,opts){
 assert.equal(args.length,1,'Only full timelines supported');
 assert.ok(opts.out.endsWith('.mp4'));
 assert.ok(!existsSync(opts.out),'Refuse to replace existing output');
 if(opts.signal?.aborted)throw Error('cancelled');
 let opened,work;
 const run=(argv,stage)=>runAudioProcess(argv,{signal:opts.signal,stage,onProcessStarted:opts.onProcessStarted},{ffmpeg,kill});
 try{
  opened=await open(args[0]);
  const duration=opened.film.meta.duration;
  assert.ok(Number.isFinite(duration)&&duration>0&&duration<=30,'Bounded timeline required');
  const declared=opened.film.meta.sounds;
  assert.ok(declared.length>0&&declared.length<=32,'Explicit bounded audio required');
  for(const c of declared){
   assert.ok(typeof c.src==='string'&&!/^[a-z]+:/i.test(c.src),'Local audio only');
   assert.ok(Number.isFinite(c.at)&&c.at>=0&&Number.isFinite(c.from)&&c.from>=0&&
    Number.isFinite(c.to)&&c.to>c.from&&c.at+(c.to-c.from)<=duration,'Bounded audio clip required');
   assert.ok(c.speed==null||c.speed===1,'Speed not accepted by this candidate');
  }
  const clips=await filmSound(opened,0);
  assert.equal(clips.length,declared.length,'Required audio stream missing or invalid');
  await opened.close();opened=null;
  work=mkdtempSync(join(dirname(opts.out),'.audio-candidate-'));
  const video=join(work,'video.mp4'),sound=join(work,'sound.m4a'),final=join(work,'final.mp4');
  await render(args,{...opts,out:video,silent:true});
  const graph=normalizeAudioPadding(mixGraph(clips,duration),duration);
  // FFmpeg 5.1 amix output can carry timestamps that prematurely end padding.
  // Preserve sample order and values while making the padding clock sample-based.
  await run([...graph.inputs,'-filter_complex',graph.filter,'-map','[out]','-t',String(duration),
   '-c:a','aac','-b:a','192k',sound],'mix');
  await run(['-i',video,'-i',sound,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',final],'mux');
  if(opts.signal?.aborted)throw Error('cancelled');
  renameSync(final,opts.out);
  return {duration,declared_audio_clips:declared.length,timestamp_reset_before_padding:true};
 }finally{
  await opened?.close();
  if(work)rmSync(work,{recursive:true,force:true});
 }
}
