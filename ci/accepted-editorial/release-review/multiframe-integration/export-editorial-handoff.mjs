// Explicit local export only. No renderer, provider, database or upstream launch.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyRenderBinding} from '../dashboard-candidate/integrations/production-render-binding.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const require=(ok)=>{if(!ok)throw Error('PROTECTED_HANDOFF_EVIDENCE_REQUIRED');};
const qaChecks=['decodes','complete_av_decode','audio_present','audio_audible','audio_covers_video','duration_match','no_black','no_duplicate_run','motion_alive','safe_border','publication_disabled'];
const stamp=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
export async function exportEditorialHandoff({job,ccsd,out,enabled=false}){
 require(enabled===true);job=path.resolve(job);ccsd=path.resolve(ccsd);out=path.resolve(out);
 require(out!==job&&!out.startsWith(job+path.sep)&&!job.startsWith(out+path.sep));
 const cache=new Map();
 const read=async p=>{p=path.resolve(p);require(await fs.realpath(p)===p);const st=await fs.lstat(p);require(st.isFile()&&!st.isSymbolicLink());const bytes=await fs.readFile(p);cache.set(p,bytes);return bytes;};
 const json=async p=>JSON.parse(await read(p));const at=n=>path.join(job,n);
 const scene=await json(ccsd),sidecar=await json(at('production-job.json')),execution=await json(at('execution.json')),qa=await json(at('media-qa.json')),composition=await json(at('composition.json'));
 const plan=sidecar.plan,id=sidecar.id;
 require(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id)&&plan?.ccsd_sha256===hash(cache.get(ccsd))&&scene.publication_enabled===false);
 require(['StudioAnimatic','StudioLong'].includes(plan.composition));
 const candidate=await read(at('candidate.mp4')),candidateHash=hash(candidate);
 verifyRenderBinding({execution,qa,sidecar,composition,id,plan,ccsdPath:ccsd,candidatePath:at('candidate.mp4'),candidateHash,compositionPath:at('composition.json'),compositionHash:hash(cache.get(at('composition.json'))),qaPath:at('media-qa.json'),qaHash:hash(cache.get(at('media-qa.json')))});
 require(execution.status==='REVIEW_CANDIDATE'&&execution.publication_enabled===false&&execution.production_approved===false&&qa.status==='PASS'&&qa.publication_enabled===false&&qaChecks.every(k=>qa.checks?.[k]===true));
 const protectedReceipt=await json(at('protected-render.json')),silent=await read(at('silent.mp4')),props=await read(at('props.json'));
 require(protectedReceipt.status==='SILENT_VIDEO_VALIDATED'&&protectedReceipt.composition===plan.composition&&protectedReceipt.ccsd_sha256===plan.ccsd_sha256&&protectedReceipt.props_sha256===hash(props)&&protectedReceipt.media?.sha256===hash(silent)&&protectedReceipt.publication_enabled===false&&protectedReceipt.production_approved===false&&execution.stages.render.outputs?.[at('protected-render.json')]===hash(cache.get(at('protected-render.json'))));
 const voice=await read(at('voice.wav')),captions=await json(at('captions.json'));
 // Bind the observed voice and protected video through the actual producer
 // mix/mux receipts to the candidate, not just independently valid artifacts.
 const mixStage=execution.stages.mix,muxStage=execution.stages.mux,mixPath=at('mix/mix.wav');
 require(mixStage?.status==='PASS'&&mixStage.inputs?.[ccsd]===plan.ccsd_sha256&&mixStage.inputs?.[at('voice.wav')]===hash(voice));
 const mixed=await read(mixPath);
 require(mixStage.outputs?.[mixPath]===hash(mixed)&&muxStage.inputs?.[at('silent.mp4')]===hash(silent)&&muxStage.inputs?.[mixPath]===hash(mixed));
 const transcriptName=plan.composition==='StudioLong'?'transcription-repaired.json':'transcription.json',transcript=await json(at(transcriptName));
 for(const [stage,filename] of [['assembly','voice.wav'],['captions','captions.json'],[plan.composition==='StudioLong'?'recognition_repair':'transcription',transcriptName]])require(execution.stages[stage]?.status==='PASS'&&execution.stages[stage].outputs?.[at(filename)]===hash(cache.get(at(filename))));
 require(execution.stages.captions.inputs?.[at(transcriptName)]===hash(cache.get(at(transcriptName)))&&execution.stages.captions.inputs?.[at('voice.wav')]===hash(voice));
 require(transcript.status==='PASS'&&transcript.publication_enabled===false&&transcript.audio_sha256===hash(voice)&&transcript.word_timestamps===true&&captions.status==='PASS'&&captions.publication_enabled===false&&captions.source_audio_sha256===hash(voice));
 const duration=qa.metrics?.duration,segments=transcript.segments,cues=captions.cues;
 require(Number.isFinite(duration)&&duration>0&&Array.isArray(segments)&&segments.length>0&&Array.isArray(cues)&&cues.length>0);
 for(const group of [segments,cues]){let last=0;for(const v of group){require(Number.isFinite(v.start)&&Number.isFinite(v.end)&&v.start>=last&&v.end>v.start&&v.end<=duration&&typeof v.text==='string'&&v.text.trim().length>0);last=v.end;}}
 const ends=segments.map(s=>s.end).filter(end=>end<=Math.min(12,duration));require(ends.length>0);const teaserEnd=Math.max(...ends);
 const teaser=cues.filter(v=>v.end<=teaserEnd&&Math.round(v.end*1000)>Math.round(v.start*1000));require(teaser.length>0);
 const srt=teaser.map((v,i)=>`${i+1}\n${stamp(v.start)} --> ${stamp(v.end)}\n${v.text.replace(/[\r\n]+/g,' ')}\n`).join('\n');
 // Preserve source-receipt identity; do not invent a Git commit or CI run.
 const provenance={kind:'PROTECTED_LOCAL_JOB_EXPORT',job_id:id,execution_sha256:hash(cache.get(at('execution.json'))),source_commit:null,creative_review:'PENDING',audio_listening_review:'PENDING',analyzer_review:'UNVERIFIED',database_state:'NOT_READ',publication_enabled:false,production_approved:false};
 const bridge=await read(path.resolve(here,'../dashboard-candidate/scripts/repository_tools.py'));
 const write=async(p,b)=>fs.writeFile(p,b,{flag:'wx',mode:0o600});
 const writeJson=async(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
 await fs.mkdir(out,{mode:0o700});
 for(const d of ['public-review','state','handoff','scripts'])await fs.mkdir(path.join(out,d),{mode:0o700});
 await write(path.join(out,'public-review/v2-draft.mp4'),candidate);await write(path.join(out,'scripts/repository_tools.py'),bridge);
 const state={...provenance,status:'REVIEW_CANDIDATE',candidate_sha256:candidateHash,run_id:id};
 await writeJson(path.join(out,'state/v2-production-status.json'),state);await writeJson(path.join(out,'state/v2-draft.json'),state);
 const windows=Buffer.from(JSON.stringify({duration,transcript:{segments,text:transcript.actual_transcript??''}},null,2)+'\n');
 await write(path.join(out,'handoff/transcript-input.json'),windows);await write(path.join(out,'handoff/teaser.srt'),srt);
 const sourceFiles=Object.fromEntries([...cache].map(([p,b])=>[p,hash(b)]));
 await writeJson(path.join(out,'protected-export-provenance.json'),{...provenance,source_files:sourceFiles,scope:'Private compatibility snapshot, not publication or live acceptance.'});
 // Manifest is the final completion marker. Failed/inconsistent export is not consumable.
 for(const [p,b] of cache)require(hash(await fs.readFile(p))===hash(b));
 const manifest={schema_version:1,...provenance,candidate_sha256:candidateHash,build_run_id:id,build_source_commit:null,source_ccsd_sha256:plan.ccsd_sha256,technical_receipt_sha256:hash(cache.get(at('protected-render.json'))),source_transcription_sha256:hash(cache.get(at(transcriptName))),source_captions_sha256:hash(cache.get(at('captions.json'))),teaser_end_seconds:teaserEnd,inputs:{'transcript-input.json':hash(windows),'teaser.srt':hash(srt)},source_export_sha256:hash(await fs.readFile(path.join(out,'protected-export-provenance.json'))),consumer_scope:'EDITORIAL_LOCAL_ONLY'};
 await writeJson(path.join(out,'handoff/handoff.json'),manifest);
 return {status:'EXPORTED_FOR_EDITORIAL_REVIEW',root:out,handoff:path.join(out,'handoff'),candidate_sha256:candidateHash,publication_enabled:false,production_approved:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [mode,job,ccsd,out,...extra]=process.argv.slice(2);require(mode==='--export-reviewed-local'&&job&&ccsd&&out&&extra.length===0);console.log(JSON.stringify(await exportEditorialHandoff({job,ccsd,out,enabled:true})));}
 catch{console.log(JSON.stringify({status:'BLOCKED',reason:'PROTECTED_HANDOFF_NOT_EXPORTED',publication_enabled:false,production_approved:false}));process.exitCode=2;}
}
