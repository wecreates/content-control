#!/usr/bin/env node
// Bounded offline review renderer. No network, provider, acceptance or publishing operations.
// Supply an already installed resvg module with RESVG_MODULE if not on Node's path.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [input,source,output]=process.argv.slice(2).map(p=>resolve(p));
if(!input||!source||!output)throw new Error('Usage: node scripts/render_v2_grounded_preview.mjs CCSD_JSON EXISTING_VIDEO OUTPUT_MP4');
if(existsSync(output)||existsSync(output+'.json'))throw new Error('Output must be new; canonical media is never overwritten');
const ccsd=JSON.parse(readFileSync(input,'utf8'));
if(ccsd.project_id!=='v2-amex-vs-chase-anime-boss-fight'||ccsd.caption_track?.status!=='PASS')throw new Error('Expected existing V2 CCSD with observed caption track');
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',source],{encoding:'utf8',timeout:30000}));
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
if(!audio||video?.r_frame_rate!=='24/1'||Number(video.nb_frames)!==840)throw new Error('Expected the existing 840-frame/24fps source with audio');
const require=createRequire(import.meta.url),resvg=process.env.RESVG_MODULE?resolve(process.env.RESVG_MODULE):require.resolve('@resvg/resvg-js');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
mkdirSync(dirname(output),{recursive:true});const temp=mkdtempSync(join(dirname(output),'.v2-grounded-'));
const initialHash={ccsd:hash(input),video:hash(source)};
try{
 const shim=`import React from 'react';export const useCurrentFrame=()=>globalThis.previewFrame;export const useVideoConfig=()=>({fps:24,width:720,height:1280,durationInFrames:840});export const AbsoluteFill=({children})=>React.createElement('div',null,children);`;
 const entry=`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {writeFileSync,readFileSync} from 'node:fs';import {StudioAnimaticComposition} from ${JSON.stringify(join(root,'remotion/StudioAnimaticComposition.jsx'))};import {Resvg} from ${JSON.stringify(resvg)};
 const ccsd=JSON.parse(readFileSync(${JSON.stringify(input)},'utf8'));
 for(let n=Number(process.argv[2]);n<Number(process.argv[3]);n++){globalThis.previewFrame=n;const html=renderToStaticMarkup(React.createElement(StudioAnimaticComposition,{ccsd,groundedPreview:true,stylePreview:true}));let svg=html.match(/<svg[\\s\\S]*<\\/svg>/)[0].replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="100%" height="100%"','width="720" height="1280"');writeFileSync(${JSON.stringify(temp)}+'/frame-'+String(n).padStart(4,'0')+'.png',new Resvg(svg,{font:{loadSystemFonts:true}}).render().asPng());if(n%120===0)process.stdout.write('Rendered '+n+'/840\\n');}`;
 await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,platform:'node',format:'cjs',outfile:join(temp,'render.cjs'),external:[resvg],plugins:[{name:'offline-frame-context',setup(b){b.onResolve({filter:/^remotion$/},()=>({path:'remotion',namespace:'preview-frame'}));b.onLoad({filter:/.*/,namespace:'preview-frame'},()=>({contents:shim,loader:'js',resolveDir:root}));}}]});
 // Native raster/font buffers are released at each process boundary.
 for(let start=0;start<840;start+=12)execFileSync(process.execPath,['--max-old-space-size=256',join(temp,'render.cjs'),String(start),String(Math.min(840,start+12))],{stdio:'inherit',timeout:30000});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-n','-framerate','24','-i',join(temp,'frame-%04d.png'),'-i',source,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','2','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',output],{stdio:'inherit',timeout:300000});
 const pcmHash=file=>createHash('sha256').update(execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-f','s16le','-'],{maxBuffer:32*1024*1024,timeout:30000})).digest('hex');
 const originalPcm=pcmHash(source),outputPcm=pcmHash(output);
 if(originalPcm!==outputPcm||hash(input)!==initialHash.ccsd||hash(source)!==initialHash.video)throw new Error('Input or decoded audio changed');
 const result=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding:'utf8',timeout:30000}));
 const rendered=result.streams.find(s=>s.codec_type==='video');if(Number(rendered.nb_frames)!==840||rendered.width!==720||rendered.height!==1280)throw new Error('Incomplete preview');
 const sourceFiles=['remotion/StudioAnimaticComposition.jsx','remotion/V2GroundedBeat.jsx','remotion/V2GroundedLayout.mjs','remotion/V2StylePreview.mjs','remotion/V2BattleAction.jsx','remotion/CharacterSystem.jsx','scripts/render_v2_grounded_preview.mjs'];
 const receipt={schema_version:1,kind:'unpublished_grounded_v2_svg_preview',created_at:new Date().toISOString(),video_sha256:hash(output),input_sha256:initialHash,decoded_audio_sha256:outputPcm,exact_existing_audio_preserved:true,raster_batch_frames:12,frame_count:840,fps:24,width:720,height:1280,source_files:Object.fromEntries(sourceFiles.map(f=>[f,hash(join(root,f))])),renderer:'React static SVG at each frame with explicit deterministic Remotion frame context; resvg system-font rasterization; FFmpeg H264 and existing AAC stream copy. This is not Chromium render equivalence.',text_accent:'#087F82',text_contrast_white:4.807235908309602,publication_enabled:false,production_approved:false,creative_review:'PENDING',limitations:['System font rasterization may differ from canonical Chromium.','Encoded motion and existing audio are present; full audiovisual creative acceptance remains separate.']};
 writeFileSync(output+'.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{rmSync(temp,{recursive:true,force:true});}
