#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["MISSING","INSTALLED","IMPLEMENTED","INTEGRATED","TESTED","RENDER_PROVEN"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--progress",required=True);ap.add_argument("--evidence-dir",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 try:d=json.loads(Path(a.progress).read_text())
 except:d={"schema_version":1,"capabilities":{},"publication_enabled":False}
 for p in Path(a.evidence_dir).glob("*.json"):
  try:e=json.loads(p.read_text());cid=str(e["capability_id"]);state=e.get("proven_state","INSTALLED")
  except:continue
  row=d.setdefault("capabilities",{}).setdefault(cid,{"state":"INSTALLED","evidence":[]})
  if e.get("status")=="PASS" and ORDER.index(state)>ORDER.index(row.get("state","INSTALLED")):
   row["state"]=state;row.setdefault("evidence",[]).append(str(p))
 d["publication_enabled"]=False;Path(a.out).write_text(json.dumps(d,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","total":len(d["capabilities"]),"tested":sum(x.get("state")=="TESTED" for x in d["capabilities"].values()),"render_proven":sum(x.get("state")=="RENDER_PROVEN" for x in d["capabilities"].values())}))
if __name__=="__main__":main()
