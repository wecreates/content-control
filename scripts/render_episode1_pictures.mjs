#!/usr/bin/env node
// Offline picture cut of the existing React artwork; never updates canonical QA.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pictureTimeline, narrationSha256} from '../remotion/episode1-picture-timeline.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output=resolve(process.argv[2] || 'picture-preview.mp4');
const captions=process.argv[3] ? resolve(process.argv[3]) : null;
if (existsSync(output) || existsSync(output+'.json')) throw new Error('Output must be new');
if (captions && (!/^[a-zA-Z0-9_./-]+$/.test(captions) || !readFileSync(captions,'utf8').startsWith('WEBVTT'))) throw new Error('Use a WEBVTT file with a simple local filename');
const audio=join(root,'public/audio/episode1-narration.mp3');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(hash(audio)!==narrationSha256) throw new Error('Narration changed; picture timing must be reverified');
mkdirSync(dirname(output),{recursive:true});
const temporaryRoot=process.env.PICTURE_TEMP_DIR ? resolve(process.env.PICTURE_TEMP_DIR) : root;
mkdirSync(temporaryRoot,{recursive:true});
const temp=mkdtempSync(join(temporaryRoot,'.picture-render-'));
try {
  const frames=pictureTimeline.map((p,i)=>({scene:p.scene,start:Math.ceil(p.start*24),end:Math.ceil((pictureTimeline[i+1]?.start??30)*24)}));
  const entry=join(temp,'entry.jsx');
  writeFileSync(entry,`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {writeFileSync} from 'node:fs';import {V9ArticulatedVisual} from ${JSON.stringify(join(root,'remotion/V9ArticulatedVisual.jsx'))};\nconst frames=${JSON.stringify(frames)};\nfor(let i=0;i<frames.length;i++){const f=frames[i]; const html=renderToStaticMarkup(React.createElement(V9ArticulatedVisual,{frame:Math.floor((f.start+f.end)/2)}));let svg=html.match(/<svg[\\s\\S]*<\\/svg>/)[0];svg=svg.replace(/ style="[^"]*"/,'').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');svg=svg.replace(/(<svg[^>]*>)/,'$1<rect width="720" height="1280" fill="#f7f1e6"/><g transform="translate(67.5 0) scale(.8125)">').replace('</svg>','</g></svg>');writeFileSync(${JSON.stringify(temp)}+'/'+i+'.svg',svg);}`);
  await build({entryPoints:[entry],outfile:join(temp,'scenes.cjs'),nodePaths:[join(root,'node_modules')],bundle:true,platform:'node',format:'cjs',logLevel:'error'});
  execFileSync(process.execPath,[join(temp,'scenes.cjs')],{cwd:root,stdio:'inherit',timeout:60000});
  const python=process.env.PICTURE_PYTHON || 'python';
  execFileSync(python,['-c',`import cairosvg, pathlib\np=pathlib.Path(${JSON.stringify(temp)})\nfor s in p.glob('*.svg'): cairosvg.svg2png(url=str(s),write_to=str(s.with_suffix('.png')))\n`],{stdio:'inherit',timeout:60000});
  const list=frames.map((f,i)=>`file '${join(temp,i+'.png')}'\nduration ${(f.end-f.start)/24}`).join('\n')+`\nfile '${join(temp,(frames.length-1)+'.png')}'\n`;
  writeFileSync(join(temp,'pictures.txt'),list);
  const filters=['[1:a]volume=1[n]','[2:a]volume=0.07[m]','[3:a]volume=0.72,adelay=125|125[s1]','[4:a]volume=0.58,adelay=3792|3792[s2]','[5:a]volume=0.60,adelay=9625|9625[s3]','[n][m][s1][s2][s3]amix=inputs=5:normalize=0:duration=longest[a]'];
  const args=['-hide_banner','-loglevel','error','-nostdin','-f','concat','-safe','0','-i',join(temp,'pictures.txt'),'-i',audio,'-stream_loop','-1','-i',join(root,'public/audio/episode1-music.mp3')];
  for(const file of ['episode1-sfx-1.mp3','episode1-sfx-2.mp3','episode1-sfx-1.mp3'])args.push('-i',join(root,'public/audio',file));
  args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[a]');
  const videoFilters=['fps=24','tpad=stop_mode=clone:stop_duration=30'];
  if(captions){
    const ass=join(temp,'captions.ass');
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-i',captions,ass],{timeout:30000});
    let text=readFileSync(ass,'utf8').replace(/PlayResX: \d+/, 'PlayResX: 720').replace(/PlayResY: \d+/, 'PlayResY: 1280');
    writeFileSync(ass,text);
    videoFilters.push(`subtitles=filename='${ass}':force_style='FontName=DejaVu Sans,FontSize=40,Outline=2,Shadow=0,MarginV=65,MarginL=40,MarginR=40'`);
  }
  args.push('-vf',videoFilters.join(','));
  args.push('-t','30','-r','24','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',output);
  execFileSync('ffmpeg',args,{stdio:'inherit',timeout:300000});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8',timeout:30000}));
  const video=probe.streams.find(s=>s.codec_type==='video'), mixedAudio=probe.streams.find(s=>s.codec_type==='audio');
  if(Number(video?.nb_frames)!==720 || Math.abs(Number(video?.duration)-30)>.05
      || Number(mixedAudio?.sample_rate)!==48000 || mixedAudio?.channels!==2
      || Math.abs(Number(mixedAudio?.duration)-30)>.05) throw new Error('Rendered picture/audio timeline is incomplete');
  const receipt={schema_version:1,kind:'unpublished_picture_cut',video_sha256:hash(output),narration_sha256:narrationSha256,caption_sha256:captions?hash(captions):null,frames,publication_enabled:false,production_approved:false,scope:'Existing characters rendered as eighteen authored picture shots; no competitor or creative acceptance implied'};
  writeFileSync(output+'.json',JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
} finally {rmSync(temp,{recursive:true,force:true});}
