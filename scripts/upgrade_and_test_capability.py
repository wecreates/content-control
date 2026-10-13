#!/usr/bin/env python3
"""Run domain diagnostics; these cannot certify an individual capability."""
import argparse,json,subprocess,sys
from pathlib import Path
SUITES={
 "renderer":"tests/test_studio_stack.py tests/test_production_reality_v4.py",
 "animation":"tests/test_execution_depth_v3.py tests/test_studio_intelligence_v2.py",
 "physics":"tests/test_execution_depth_v3.py",
 "camera":"tests/test_studio_intelligence_v2.py tests/test_creative_depth_engine.py",
 "editing":"tests/test_quality_depth.py tests/test_quality_depth_integration.py",
 "composition":"tests/test_composition_qa.py tests/test_composition_frame_qa.py",
 "audio":"tests/test_audio_alignment_qa.py tests/test_voice_render_wiring.py",
 "voice":"tests/test_voice_provider.py tests/test_voice_candidate_qa.py",
 "story":"tests/test_creative_blueprint.py",
 "retention":"tests/test_quality_depth.py",
 "reference":"tests/test_reference_clone_smoke.py",
 "qa":"tests/test_system_wiring.py",
 "repair":"tests/test_quality_depth_integration.py",
 "learning":"tests/test_studio_intelligence_v2.py",
 "reliability":"tests/test_historical_runtime_regressions.py tests/test_system_wiring.py",
 "acceptance":"tests/test_system_wiring.py"}

def diagnose(task, root=Path('.'), runner=subprocess.run):
 if not isinstance(task,dict):return {'schema_version':1,'status':'BLOCKED','reason':'invalid_task_or_publication_policy','publication_enabled':False,'completion_verified':False}
 result={"schema_version":1,"status":"BLOCKED","capability_id":task.get("capability_id"),"domain":task.get("domain"),"publication_enabled":False,"completion_verified":False}
 if type(task.get('capability_id')) is not int or task['capability_id']<=0 or task.get('publication_enabled') is not False:
  return dict(result,reason='invalid_task_or_publication_policy')
 if any(not isinstance(task.get(field),str) or not task[field].strip() for field in ('capability','group','current_state')) or task.get('current_state') not in {'MISSING','INSTALLED','IMPLEMENTED','INTEGRATED','TESTED','RENDER_PROVEN'}:
  return dict(result,reason='task_metadata_missing_or_invalid')
 domain=task.get('domain')
 if not isinstance(domain,str) or domain not in SUITES:return dict(result,reason='unsupported_or_missing_domain')
 paths=SUITES[domain].split()
 if any(not (root/p).is_file() for p in paths):return dict(result,reason='paired_test_missing',paired_test=paths)
 command=[sys.executable,'-m','unittest','-q',*paths]
 try:
  process=runner(command,cwd=str(root),capture_output=True,text=True,timeout=300)
 except (subprocess.TimeoutExpired,OSError):return dict(result,reason='diagnostic_execution_failed',paired_test=paths)
 # Do not retain subprocess output: it is not task evidence and can contain secrets.
 return dict(result,status='CHECKS_PASSED_UNVERIFIED' if process.returncode==0 else 'BLOCKED',reason='capability_specific_proof_missing' if process.returncode==0 else 'domain_checks_failed',paired_test=paths,checks=[{'argv':command,'rc':process.returncode}],status_scope='Domain diagnostics only; no implementation, integration, or capability completion certified')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--task',required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
 result=diagnose(json.loads(args.task));out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
 print(json.dumps({'status':result['status'],'completion_verified':False}));return 2
if __name__=='__main__':raise SystemExit(main())
