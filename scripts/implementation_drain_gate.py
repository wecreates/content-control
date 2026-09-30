#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.progress).read_text());caps=d.get("capabilities",{})
 pending=[int(k) for k,v in caps.items() if v.get("state") in {"MISSING","INSTALLED","IMPLEMENTED"}]
 r={"schema_version":1,"status":"DRAINING" if pending else "IMPLEMENTATION_COMPLETE","pending":len(pending),"next_cohort_size":min(500,len(pending)),"continue_immediately":bool(pending),"publication_enabled":False}
 Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r))
if __name__=="__main__":main()
