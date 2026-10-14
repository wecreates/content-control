#!/usr/bin/env node
// Exercise the actual renderer lookup on its complete frame lattice, not a copy.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captionAtTime} from '../remotion/ObservedCaptions.mjs';
const fail=message=>{throw new Error(message)};
export function verifyCaptionFrames(ccsd,track) {
  const checks={publication_disabled:false,frame_rate_valid:false,original_words_bound:false,no_early_reveal:false,all_words_visible:false};
  const report={status:'BLOCKED',publication_enabled:false,checks,frame_count:0,expected_word_count:0,visible_word_count:0};
  try {
    if(ccsd?.publication_enabled!==false||track?.publication_enabled!==false)fail('Publication must remain disabled');
    checks.publication_disabled=true;
    const fps=ccsd.fps;
    if(typeof fps!=='number'||!Number.isFinite(fps)||fps<1||fps>120)fail('Explicit valid fps required');
    // StudioAnimatic currently declares Composition fps={24}; do not audit a fictional lattice.
    if(fps!==24)fail('Declared fps does not match StudioAnimatic renderer fps 24');
    checks.frame_rate_valid=true;
    if(!Array.isArray(ccsd.scenes)||!ccsd.scenes.length)fail('Scenes required');
    const scenes=[...ccsd.scenes].sort((a,b)=>a.start-b.start);
    for(const s of scenes)if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start)fail('Invalid scene bounds');
    const duration=Math.max(...scenes.map(s=>s.end));
    if(duration>600)fail('Timeline exceeds verifier bound');
    // StudioAnimatic calculateMetadata retains a three-second minimum.
    report.frame_count=Math.ceil(Math.max(duration,3)*fps);
    const expected=[];
    for(const s of scenes)for(const line of s.audio?.dialogue||[])for(const word of (line.text||'').trim().split(/\s+/).filter(Boolean))expected.push({word,scene_id:s.id,speaker:line.speaker});
    report.expected_word_count=expected.length;
    if(!expected.length||track.status!=='PASS'||!Array.isArray(track.cues)||!track.cues.length)fail('Passing nonempty caption track required');
    const onsets=new Map(),seenSource=new Set();let previousEnd=0;
    for(const cue of track.cues) {
      if(!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<previousEnd||cue.start<0||cue.end<=cue.start||cue.end>duration)fail('Invalid caption timing');
      previousEnd=cue.end;
      const source=cue.source_word_indices;
      if(!Array.isArray(source)||!source.length||source.some((i,n)=>!Number.isInteger(i)||i<0||i>=expected.length||(n>0&&i<=source[n-1])||seenSource.has(i)))fail('Invalid or duplicate source word indices');
      if(cue.observed_word_index!==source.at(-1))fail('Observed word index mismatch');
      if(cue.word!==source.map(i=>expected[i].word).join(' '))fail('Original source words mismatch');
      for(const i of source) {
        if(expected[i].speaker!==cue.speaker||expected[i].scene_id!==cue.scene_id)fail('Source word scene or speaker mismatch');
        onsets.set(i,cue.start);seenSource.add(i);
      }
    }
    if(seenSource.size!==expected.length)fail('Source words missing');
    for(const cue of track.cues) {
      const indices=cue.display_word_indices;
      if(!Array.isArray(indices)||!indices.length||indices.length>3||indices.some((i,n)=>!Number.isInteger(i)||i<0||i>=expected.length||(n>0&&i<=indices[n-1])))fail('Invalid displayed word indices');
      if(cue.text!==indices.map(i=>expected[i].word).join(' '))fail('Displayed text does not match original word indices');
      for(const i of indices)if(expected[i].speaker!==cue.speaker||expected[i].scene_id!==cue.scene_id)fail('Displayed word crosses scene or speaker');
      // Validate even subframe cues, so hidden future text cannot pass by accident.
      for(const i of indices)if(cue.start<onsets.get(i))fail('Future word displayed before observed onset');
    }
    checks.original_words_bound=true;
    const visible=new Set(),exposure=expected.map(()=>0);
    for(let frame=0;frame<report.frame_count;frame++) {
      const time=frame/fps;
      // StudioAnimatic returns a blank frame before caption lookup outside scenes.
      if(!scenes.some(scene=>scene.start<=time&&time<scene.end))continue;
      const cue=captionAtTime(track,time);
      if(!cue)continue;
      for(const i of cue.display_word_indices) {
        if(time<onsets.get(i))fail('Renderer reveals word before observed onset');
        visible.add(i);
        exposure[i]++;
      }
    }
    checks.no_early_reveal=true;report.visible_word_count=visible.size;
    const missing=expected.map((_,i)=>i).filter(i=>!visible.has(i));report.missing_word_indices=missing;
    if(missing.length)fail('Original words never displayed: '+missing.join(','));
    checks.all_words_visible=true;
    // Presence for one frame is insufficient even as a conservative technical
    // floor. This does not certify readability, which remains a creative gate.
    report.word_exposure_frames=exposure;
    report.minimum_word_exposure_frames=3;
    report.brief_word_indices=expected.map((_,i)=>i).filter(i=>exposure[i]<3);
    checks.minimum_word_exposure=report.brief_word_indices.length===0;
    if(!checks.minimum_word_exposure)fail('Words displayed for fewer than three frames: '+report.brief_word_indices.join(','));
    report.status='PASS';
  } catch(error) {report.reason=error.message;}
  return report;
}
async function main() {
  const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
  let report={status:'BLOCKED',publication_enabled:false,checks:{},frame_count:0,expected_word_count:0,visible_word_count:0};
  const out=args.includes('--out')?get('--out'):null;
  try {
    if(!args.includes('--ccsd')||!args.includes('--captions')||!out)fail('--ccsd, --captions and --out required');
    const [ccsd,caption]=await Promise.all([fs.readFile(get('--ccsd')),fs.readFile(get('--captions'))]);
    report={...verifyCaptionFrames(JSON.parse(ccsd),JSON.parse(caption)),caption_sha256:crypto.createHash('sha256').update(caption).digest('hex'),ccsd_sha256:crypto.createHash('sha256').update(ccsd).digest('hex')};
  }catch(error){report.reason=error.message;}
  if(out){await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify(report));process.exitCode=report.status==='PASS'?0:2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
