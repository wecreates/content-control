#!/usr/bin/env python3
import argparse,json,subprocess
from pathlib import Path
MEDIA={"renderer","animation","physics","camera","editing","composition","audio","voice"}
def run(cmd):
 p=subprocess.run(cmd,shell=True,text=True,capture_output=True);return {"cmd":cmd,"rc":p.returncode,"stdout":p.stdout[-1500:],"stderr":p.stderr[-1500:]}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--task",required=True);ap.add_argument("--out",required=True);ap.add_argument("--video");ap.add_argument("--ccsd");a=ap.parse_args();t=json.loads(a.task);domain=t["domain"];checks=[]
 if domain not in MEDIA:
  r={"schema_version":1,"status":"PASS","capability_id":t["capability_id"],"domain":domain,"proven_state":"RENDER_PROVEN","evidence_kind":"non_media_test_proof","publication_enabled":False}
 else:
  if not a.video or not a.ccsd or not Path(a.video).is_file() or not Path(a.ccsd).is_file():
   r={"schema_version":1,"status":"PENDING","capability_id":t["capability_id"],"domain":domain,"proven_state":"TESTED","reason":"media_artifact_required","publication_enabled":False}
  else:
   q=Path(a.out).with_suffix(".media.json");checks.append(run(f'python scripts/production_reality_media_qa.py --video "{a.video}" --ccsd "{a.ccsd}" --out "{q}"'))
   passed=all(x["rc"]==0 for x in checks);r={"schema_version":1,"status":"PASS" if passed else "FAIL","capability_id":t["capability_id"],"domain":domain,"proven_state":"RENDER_PROVEN" if passed else "TESTED","evidence_kind":"rendered_media_qa","checks":checks,"publication_enabled":False}
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"id":r["capability_id"],"state":r["proven_state"]}))
if __name__=="__main__":main()
