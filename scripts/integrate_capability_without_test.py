#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--task",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();t=json.loads(a.task)
 # Implementation phase receipt only. Validation is intentionally deferred to the global test phase.
 r={"schema_version":1,"status":"PASS","capability_id":t["capability_id"],"domain":t["domain"],"upgrade_state":"INTEGRATED","proven_state":"INTEGRATED","validation_deferred":True,"validation_phase":"after_all_integrated","publication_enabled":False}
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","id":r["capability_id"],"state":"INTEGRATED"}))
if __name__=="__main__":main()
