import path from 'node:path';
export const OPENMONTAGE_PIN='9327439db69021ab4b0e2776729bf3b58fdb5a87';
const required=['candidate_unchanged','probe_bound_to_candidate','duration_matches','audio_stream_present','audio_sample_rate_valid','audio_channels_valid','av_streams_present'];
const check=(ok,code)=>{if(!ok)throw Error(code);};
export function openMontageConfig(env){
 const flag=env.PRODUCTION_OPENMONTAGE_VERIFY;
 if(flag===undefined||flag==='false')return null;
 check(flag==='true','OPENMONTAGE_CONFIGURATION_INVALID');
 check(env.PRODUCTION_OPENMONTAGE_AUTHORIZED==='true','OPENMONTAGE_AUTHORIZATION_REQUIRED');
 const upstream=env.OPENMONTAGE_CHECKOUT;
 check(typeof upstream==='string'&&path.posix.isAbsolute(upstream)&&path.posix.normalize(upstream)===upstream&&!/[\n\r\\\0]/.test(upstream),'OPENMONTAGE_CHECKOUT_REQUIRED');
 check(env.OPENMONTAGE_COMMIT===OPENMONTAGE_PIN,'OPENMONTAGE_PIN_REQUIRED');
 return {upstream,pin:OPENMONTAGE_PIN};
}
export async function checkOpenMontageFiles(config,fs,verifier){
 if(!config)return;
 try{
  check(await fs.realpath(config.upstream)===config.upstream,'OPENMONTAGE_DEPENDENCIES_REQUIRED');
  for(const f of [verifier,path.join(path.dirname(verifier),'adapter.py'),config.upstream+'/LICENSE',config.upstream+'/tools/analysis/audio_probe.py',config.upstream+'/tools/base_tool.py']){
   const st=await fs.lstat(f);check(st.isFile()&&!st.isSymbolicLink(),'OPENMONTAGE_DEPENDENCIES_REQUIRED');
  }
 }catch{throw Error('OPENMONTAGE_DEPENDENCIES_REQUIRED');}
 // Presence only. The existing adapter verifies actual Git pin/clean files and
 // rejects .env at use; no install, import or upstream execution here.
}
export function validateOpenMontageReceipt(r,{candidateHash,candidatePath,duration}){
 const e=r?.upstream_evidence;
 check(r?.schema_version===1&&r.status==='PASS'&&r.publication_enabled===false&&r.candidate_sha256===candidateHash&&r.candidate_path===candidatePath&&r.expected_duration_seconds===duration&&r.duration_tolerance_seconds===.25&&Number.isFinite(r.actual_duration_seconds)&&Math.abs(r.actual_duration_seconds-duration)<=.25&&required.every(k=>r.checks?.[k]===true)&&Array.isArray(r.failed_checks)&&r.failed_checks.length===0,'OPENMONTAGE_RECEIPT_INVALID');
 check(e?.status==='PASS'&&e.operation==='probe'&&e.upstream_commit===OPENMONTAGE_PIN&&e.upstream_source==='https://github.com/calesthio/OpenMontage'&&e.provider_calls===0&&e.publication_enabled===false&&e.inputs?.length===1&&e.inputs[0].path===candidatePath&&e.inputs[0].sha256===candidateHash,'OPENMONTAGE_RECEIPT_INVALID');
 return {status:'PASS',scope:'PINNED_LOCAL_PROBE_ONLY',candidate_sha256:candidateHash,production_approved:false,publication_enabled:false};
}
