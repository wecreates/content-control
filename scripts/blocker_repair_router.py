#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--blocker",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();b=json.loads(Path(a.blocker).read_text());routes=[]
 for c in b.get("causes",[]):
  routes.append({"cause":c,"action":{"progress_registry_incomplete":"rebuild_and_persist_progress","zero_proof_cycle":"repair_worker_or_evidence_adapter","capabilities_pending":"continue_capability_execution"}.get(c,"diagnose_and_repair"),"must_verify_before_resume":True})
 r={"schema_version":1,"status":"REPAIR_REQUIRED" if routes else "CLEAR","routes":routes,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r))
if __name__=="__main__":main()
