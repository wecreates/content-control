#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.progress).read_text());caps=d.get("capabilities",{});total=len(caps);proven=sum(x.get("state")=="RENDER_PROVEN" for x in caps.values());pending=total-proven
 r={"schema_version":1,"status":"COMPLETE" if total==2500 and pending==0 else "INCOMPLETE","total":total,"render_proven":proven,"pending":pending,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if r["status"]=="COMPLETE" else 3)
if __name__=="__main__":main()
