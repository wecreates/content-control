#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--reconciliation");ap.add_argument("--out",required=True);a=ap.parse_args()
 d=json.loads(Path(a.progress).read_text());caps=d.get("capabilities",{});rec={}
 if a.reconciliation and Path(a.reconciliation).is_file():rec=json.loads(Path(a.reconciliation).read_text())
 pending=sum(x.get("state")!="RENDER_PROVEN" for x in caps.values());proven=sum(x.get("state")=="RENDER_PROVEN" for x in caps.values())
 causes=[]
 if len(caps)!=2500:causes.append("progress_registry_incomplete")
 if rec and rec.get("pending",0)>0 and rec.get("proven",0)==0:causes.append("zero_proof_cycle")
 if pending and not causes:causes.append("capabilities_pending")
 r={"schema_version":1,"status":"BLOCKED" if causes else "CLEAR","causes":causes,"total":len(caps),"render_proven":proven,"pending":pending,"publication_enabled":False}
 Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(2 if r["status"]=="BLOCKED" else 0)
if __name__=="__main__":main()
