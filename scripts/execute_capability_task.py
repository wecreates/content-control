#!/usr/bin/env python3
import argparse,json,subprocess,sys
from pathlib import Path
def run(cmd):
 p=subprocess.run(cmd,shell=True,text=True,capture_output=True);return {"cmd":cmd,"rc":p.returncode,"stdout":p.stdout[-2000:],"stderr":p.stderr[-2000:]}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--task",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();t=json.loads(a.task);cid=t["capability_id"];domain=t["domain"]
 checks=[]
 # Evidence adapters use real repository tests/builds. Domain-specific media proof remains required where applicable.
 if domain in {"reliability","acceptance","learning","repair","story","retention","reference"}:
  checks.append(run("python -m unittest -q tests/test_system_wiring.py tests/test_creative_blueprint.py"))
 elif domain in {"renderer","animation","physics","camera","editing","composition"}:
  checks.append(run("python -m unittest -q tests/test_studio_stack.py tests/test_execution_depth_v3.py tests/test_production_reality_v4.py"))
 elif domain in {"audio","voice"}:
  checks.append(run("python -m unittest -q tests/test_voice_provider.py tests/test_voice_candidate_qa.py tests/test_voice_render_wiring.py"))
 else:
  checks.append(run("python -m unittest -q tests/test_system_wiring.py"))
 passed=all(x["rc"]==0 for x in checks)
 # Tests prove TESTED, not render proof. Never fabricate final proof.
 r={"schema_version":1,"status":"PASS" if passed else "FAIL","capability_id":cid,"domain":domain,"proven_state":"TESTED" if passed else "INSTALLED","checks":checks,"render_proof_required":domain in {"renderer","animation","physics","camera","editing","composition","audio","voice"},"publication_enabled":False}
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"id":cid,"state":r["proven_state"]}));raise SystemExit(0 if passed else 2)
if __name__=="__main__":main()
