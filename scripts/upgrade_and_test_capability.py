#!/usr/bin/env python3
import argparse,json,subprocess,tempfile
from pathlib import Path
def run(cmd):
 p=subprocess.run(cmd,shell=True,text=True,capture_output=True);return {"cmd":cmd,"rc":p.returncode,"stdout":p.stdout[-1200:],"stderr":p.stderr[-1200:]}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--task",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();t=json.loads(a.task);domain=t["domain"];checks=[]
 # Upgrade validation is paired atomically with the capability's domain tests.
 suites={
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
 suite=suites.get(domain,"tests/test_system_wiring.py")
 existing=[x for x in suite.split() if Path(x).is_file()]
 if not existing:
  r={"schema_version":1,"status":"BLOCKED","capability_id":t["capability_id"],"reason":"paired_test_missing","publication_enabled":False}
 else:
  checks.append(run("python -m unittest -q "+" ".join(existing)));passed=all(x["rc"]==0 for x in checks)
  r={"schema_version":1,"status":"PASS" if passed else "FAIL","capability_id":t["capability_id"],"domain":domain,"upgrade_state":"INTEGRATED" if passed else t.get("current_state","INSTALLED"),"proven_state":"TESTED" if passed else t.get("current_state","INSTALLED"),"paired_test":existing,"checks":checks,"publication_enabled":False}
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"id":r["capability_id"],"paired_test":existing if existing else []}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
