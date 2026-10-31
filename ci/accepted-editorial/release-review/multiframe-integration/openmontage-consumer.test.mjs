import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENMONTAGE_PIN,openMontageConfig,checkOpenMontageFiles,validateOpenMontageReceipt} from './openmontage-consumer.mjs';
// Synthetic receipts only: no upstream imports, processes or media execution.
const config=()=>({PRODUCTION_OPENMONTAGE_VERIFY:'true',PRODUCTION_OPENMONTAGE_AUTHORIZED:'true',OPENMONTAGE_CHECKOUT:'/approved/openmontage',OPENMONTAGE_COMMIT:OPENMONTAGE_PIN});
const bound={candidateHash:'a'.repeat(64),candidatePath:'/job/candidate.mp4',duration:3};
const receipt=()=>({schema_version:1,status:'PASS',publication_enabled:false,candidate_sha256:bound.candidateHash,candidate_path:bound.candidatePath,expected_duration_seconds:3,actual_duration_seconds:3,duration_tolerance_seconds:.25,checks:Object.fromEntries(['candidate_unchanged','probe_bound_to_candidate','duration_matches','audio_stream_present','audio_sample_rate_valid','audio_channels_valid','av_streams_present'].map(k=>[k,true])),failed_checks:[],upstream_evidence:{status:'PASS',operation:'probe',upstream_commit:OPENMONTAGE_PIN,upstream_source:'https://github.com/calesthio/OpenMontage',provider_calls:0,publication_enabled:false,inputs:[{path:bound.candidatePath,sha256:bound.candidateHash}]}});
test('disabled consumer does not inspect filesystem or confer production approval',async()=>{
 assert.equal(openMontageConfig({}),null);assert.equal(openMontageConfig({PRODUCTION_OPENMONTAGE_VERIFY:'false'}),null);
 await checkOpenMontageFiles(null,new Proxy({},{get(){throw Error('unexpected read');}}),'/verifier');
 assert.deepEqual(validateOpenMontageReceipt(receipt(),bound),{status:'PASS',scope:'PINNED_LOCAL_PROBE_ONLY',candidate_sha256:bound.candidateHash,production_approved:false,publication_enabled:false});
});
test('opt-in requires exact boolean strings, authorization, pin and normalized absolute path',()=>{
 for(const change of [{PRODUCTION_OPENMONTAGE_VERIFY:true},{PRODUCTION_OPENMONTAGE_AUTHORIZED:'false'},{OPENMONTAGE_COMMIT:'main'},{OPENMONTAGE_CHECKOUT:'relative'},{OPENMONTAGE_CHECKOUT:'/a/../b'},{OPENMONTAGE_CHECKOUT:'/a\nb'}])assert.throws(()=>openMontageConfig({...config(),...change}),/OPENMONTAGE_/);
 assert.equal(openMontageConfig(config()).pin,OPENMONTAGE_PIN);
});
test('presence preflight rejects missing files, symlinks and checkout resolution changes',async()=>{
 const good={realpath:async p=>p,lstat:async()=>({isFile:()=>true,isSymbolicLink:()=>false})};
 await checkOpenMontageFiles(openMontageConfig(config()),good,'/consumer/verify_render.py');
 for(const fs of [{...good,realpath:async()=>'/elsewhere'},{...good,lstat:async()=>{throw Error('private diagnostic');}},{...good,lstat:async()=>({isFile:()=>true,isSymbolicLink:()=>true})},{...good,lstat:async()=>({isFile:()=>false,isSymbolicLink:()=>false})}])await assert.rejects(checkOpenMontageFiles(openMontageConfig(config()),fs,'/consumer/verify_render.py'),/^Error: OPENMONTAGE_DEPENDENCIES_REQUIRED$/);
});
test('receipt rejects changed identity, scope, failed checks and unsupported upstream',()=>{
 const mutations=[r=>r.candidate_sha256='b'.repeat(64),r=>r.candidate_path='/other.mp4',r=>r.publication_enabled=true,r=>r.expected_duration_seconds=4,r=>r.actual_duration_seconds=4,r=>r.duration_tolerance_seconds=1,r=>r.failed_checks=['decodes'],r=>r.checks.audio_stream_present='true',r=>r.upstream_evidence.upstream_commit='main',r=>r.upstream_evidence.operation='concat',r=>r.upstream_evidence.provider_calls=1,r=>r.upstream_evidence.publication_enabled=true,r=>r.upstream_evidence.inputs[0].sha256='b'.repeat(64),r=>r.upstream_evidence.inputs.push(r.upstream_evidence.inputs[0]),r=>r.upstream_evidence.upstream_source='https://example.invalid'];
 for(const mutate of mutations){const r=receipt();mutate(r);assert.throws(()=>validateOpenMontageReceipt(r,bound),/OPENMONTAGE_RECEIPT_INVALID/);}
});
