const python=process.env.EDITORIAL_TEST_PYTHON||(process.platform==='win32'?'C:\\Python314\\python.exe':'python3');
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {exportEditorialHandoff} from './export-editorial-handoff.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'protected-export-fixture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const job=path.join(root,'job'),ccsd=path.join(root,'ccsd.json'),out=path.join(root,'export');await fs.mkdir(job);
 const at=n=>path.join(job,n),put=(n,v)=>fs.writeFile(at(n),typeof v==='string'?v:JSON.stringify(v)),sha=async n=>hash(await fs.readFile(at(n)));
 await fs.writeFile(ccsd,JSON.stringify({publication_enabled:false,scenes:[{start:0,end:3}]}));
 const plan={ccsd_sha256:hash(await fs.readFile(ccsd)),composition:'StudioAnimatic'},id='a'.repeat(64);
 await put('production-job.json',{id,plan});await put('composition.json',{composition:plan.composition});await put('candidate.mp4','FIXTURE_NOT_MEDIA');await put('silent.mp4','FIXTURE_SILENT');await put('voice.wav','FIXTURE_AUDIO');await put('props.json',{});
 const voice=await sha('voice.wav'),candidate=await sha('candidate.mp4');
 await put('transcription.json',{status:'PASS',publication_enabled:false,audio_sha256:voice,word_timestamps:true,segments:[{start:0,end:2,text:'Fixture observed speech.'}]});
 await put('captions.json',{status:'PASS',publication_enabled:false,source_audio_sha256:voice,cues:[{start:0,end:2,text:'Fixture observed speech.'}]});
 await put('protected-render.json',{status:'SILENT_VIDEO_VALIDATED',composition:plan.composition,ccsd_sha256:plan.ccsd_sha256,props_sha256:await sha('props.json'),media:{sha256:await sha('silent.mp4')},publication_enabled:false,production_approved:false});
 await put('media-qa.json',{status:'PASS',publication_enabled:false,candidate_sha256:candidate,metrics:{duration:3},checks:Object.fromEntries(['decodes','complete_av_decode','audio_present','audio_audible','audio_covers_video','duration_match','no_black','no_duplicate_run','motion_alive','safe_border','publication_disabled'].map(k=>[k,true]))});
 const execution={status:'REVIEW_CANDIDATE',publication_enabled:false,production_approved:false,candidate_sha256:candidate,stages:{render:{status:'PASS',inputs:{[at('composition.json')]:await sha('composition.json')},outputs:{[at('protected-render.json')]:await sha('protected-render.json')}},mux:{status:'PASS',outputs:{[at('candidate.mp4')]:candidate}},qa:{status:'PASS',inputs:{[ccsd]:plan.ccsd_sha256,[at('candidate.mp4')]:candidate},outputs:{[at('media-qa.json')]:await sha('media-qa.json')}},package:{status:'PASS'},assembly:{status:'PASS',outputs:{[at('voice.wav')]:voice}},transcription:{status:'PASS',outputs:{[at('transcription.json')]:await sha('transcription.json')}},captions:{status:'PASS',inputs:{[at('voice.wav')]:voice,[at('transcription.json')]:await sha('transcription.json')},outputs:{[at('captions.json')]:await sha('captions.json')}}}};
 await fs.mkdir(at('mix'));await put('mix/mix.wav','FIXTURE_MIX');
 execution.stages.mix={status:'PASS',inputs:{[ccsd]:plan.ccsd_sha256,[at('voice.wav')]:voice},outputs:{[at('mix/mix.wav')]:await sha('mix/mix.wav')}};
 execution.stages.mux.inputs={[at('silent.mp4')]:await sha('silent.mp4'),[at('mix/mix.wav')]:await sha('mix/mix.wav')};
 await put('execution.json',execution);return {job,ccsd,out,enabled:true,put,at,execution};
}
test('actual exporter feeds existing editorial preview, no upstream or media execution',async t=>{
 const f=await fixture(t),result=await exportEditorialHandoff(f);assert.equal(result.status,'EXPORTED_FOR_EDITORIAL_REVIEW');
 const manifest=JSON.parse(await fs.readFile(path.join(f.out,'handoff/handoff.json')));assert.equal(manifest.build_source_commit,null);assert.equal(manifest.analyzer_review,'UNVERIFIED');assert.equal(manifest.database_state,'NOT_READ');assert.equal(manifest.production_approved,false);
 const script=fileURLToPath(new URL('../dashboard-candidate/scripts/repository_v2_handoff.py',import.meta.url));
 const {stdout}=await promisify(execFile)(python,[script,'editorial-preview','--root',f.out,'--out',path.join(f.out,'handoff')],{timeout:10000});
 assert.equal(JSON.parse(stdout).status,'INPUTS_VERIFIED_EXECUTION_DISABLED');assert.equal(JSON.parse(stdout).candidate_sha256,result.candidate_sha256);
 const fixtureCode="import sys,json; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from test_repository_editorial import ConsumerTests; t=ConsumerTests(); t.setUp(); t.root=Path(sys.argv[2]); t.handoff=t.root/'handoff'; r=t.run_consumer(); assert len(t.calls)==5; assert r['production_approved'] is False; print(json.dumps({'scope':'MOCKED_WORKER_ONLY','status':r['status'],'calls':t.calls})); t.doCleanups()";
 const integrated=await promisify(execFile)(python,['-c',fixtureCode,path.dirname(script),f.out],{timeout:10000});
 assert.equal(JSON.parse(integrated.stdout).scope,'MOCKED_WORKER_ONLY');assert.equal(JSON.parse(integrated.stdout).calls.length,5);
});
test('default disabled creates no export',async t=>{const f=await fixture(t);await assert.rejects(exportEditorialHandoff({...f,enabled:false}));await assert.rejects(fs.stat(f.out));});
test('existing destination cannot be overwritten',async t=>{const f=await fixture(t);await exportEditorialHandoff(f);await assert.rejects(exportEditorialHandoff(f),/EEXIST/);});
for(const name of ['candidate.mp4','silent.mp4','voice.wav','captions.json','transcription.json','props.json'])test('changed '+name+' cannot produce handoff',async t=>{const f=await fixture(t);await f.put(name,'{"changed":true}');await assert.rejects(exportEditorialHandoff(f));await assert.rejects(fs.stat(path.join(f.out,'handoff/handoff.json')));});
test('missing package completion blocks export',async t=>{const f=await fixture(t);f.execution.stages.package.status='BLOCKED';await f.put('execution.json',f.execution);await assert.rejects(exportEditorialHandoff(f));});
test('no export into source job',async t=>{const f=await fixture(t);await assert.rejects(exportEditorialHandoff({...f,out:path.join(f.job,'export')}));});
for(const mode of ['missing','contradictory'])test('independent mux reproduction rejects '+mode,async t=>{
 const f=await fixture(t);
 if(mode==='missing'){delete f.execution.stages.mix;delete f.execution.stages.mux.inputs;await fs.unlink(f.at('mix/mix.wav'));}
 else f.execution.stages.mux.inputs={[f.at('silent.mp4')]:'0'.repeat(64),[f.at('mix/mix.wav')]:'1'.repeat(64)};
 await f.put('execution.json',f.execution);await assert.rejects(exportEditorialHandoff(f),/PROTECTED_HANDOFF_EVIDENCE_REQUIRED/);await assert.rejects(fs.stat(f.out));
});
for(const mode of ['mix-status','mix-ccsd','mix-voice','mix-output','mixed-bytes','mux-silent','mux-mix'])test('receipt chain rejects '+mode,async t=>{
 const f=await fixture(t),mix=f.execution.stages.mix,mux=f.execution.stages.mux;
 if(mode==='mix-status')mix.status='BLOCKED';
 if(mode==='mix-ccsd')mix.inputs[f.ccsd]='0'.repeat(64);
 if(mode==='mix-voice')mix.inputs[f.at('voice.wav')]='0'.repeat(64);
 if(mode==='mix-output')mix.outputs[f.at('mix/mix.wav')]='0'.repeat(64);
 if(mode==='mixed-bytes')await f.put('mix/mix.wav','CHANGED');
 if(mode==='mux-silent')mux.inputs[f.at('silent.mp4')]='0'.repeat(64);
 if(mode==='mux-mix')mux.inputs[f.at('mix/mix.wav')]='0'.repeat(64);
 await f.put('execution.json',f.execution);await assert.rejects(exportEditorialHandoff(f),/PROTECTED_HANDOFF_EVIDENCE_REQUIRED/);await assert.rejects(fs.stat(f.out));
});
