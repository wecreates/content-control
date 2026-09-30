#!/usr/bin/env python3
import argparse,json,subprocess
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--queue",required=True);ap.add_argument("--index",type=int,required=True);ap.add_argument("--out",required=True);a=ap.parse_args();q=json.loads(Path(a.queue).read_text());t=q["tasks"][a.index];cid=t["capability_id"]
 # Ordered executor delegates to existing evidence adapters; it never skips a failed task.
 cmd=["python","scripts/upgrade_and_test_capability.py","--task",json.dumps({"capability_id":cid,"domain":"reliability","current_state":t["current_state"]}),"--out",a.out]
 p=subprocess.run(cmd);raise SystemExit(p.returncode)
if __name__=="__main__":main()
