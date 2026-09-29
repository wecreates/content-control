#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["MISSING","INSTALLED","IMPLEMENTED","INTEGRATED","TESTED","RENDER_PROVEN"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--registries",nargs="+",required=True);ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 rows=[]
 for p in a.registries:rows+=json.loads(Path(p).read_text()).get("capabilities",[])
 try:progress=json.loads(Path(a.progress).read_text()).get("capabilities",{})
 except:progress={}
 for r in rows:
  old=progress.get(str(r["id"]),{})
  if ORDER.index(old.get("state","MISSING"))>ORDER.index(r.get("state","INSTALLED")):
   r["state"]=old["state"];r["evidence"]=old.get("evidence",[])
 result={"schema_version":1,"capabilities":{str(r["id"]):{"state":r["state"],"evidence":r.get("evidence",[])} for r in rows},"publication_enabled":False}
 Path(a.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
 print(json.dumps({"status":"PASS","total":len(rows),"render_proven":sum(r["state"]=="RENDER_PROVEN" for r in rows)}))
if __name__=="__main__":main()
