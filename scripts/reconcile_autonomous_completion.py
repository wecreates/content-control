#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--plan",required=True);ap.add_argument("--evidence-dir",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();p=json.loads(Path(a.plan).read_text());rows=[]
 for t in p.get("tasks",[]):
  ev=Path(a.evidence_dir,f"{t['capability_id']}.json");ok=False;detail={}
  if ev.is_file():
   try:detail=json.loads(ev.read_text());ok=detail.get("status")=="PASS" and detail.get("publication_enabled") is False
   except:pass
  rows.append({"capability_id":t["capability_id"],"status":"PROVEN" if ok else "PENDING","evidence":str(ev) if ev.is_file() else None})
 r={"schema_version":1,"status":"PASS","proven":sum(x["status"]=="PROVEN" for x in rows),"pending":sum(x["status"]=="PENDING" for x in rows),"tasks":rows,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","proven":r["proven"],"pending":r["pending"]}))
if __name__=="__main__":main()
