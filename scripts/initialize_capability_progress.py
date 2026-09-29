#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--registries",nargs="+",required=True);ap.add_argument("--progress",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 try:d=json.loads(Path(a.progress).read_text())
 except:d={"schema_version":1,"capabilities":{},"publication_enabled":False}
 caps=d.setdefault("capabilities",{})
 for p in a.registries:
  for r in json.loads(Path(p).read_text()).get("capabilities",[]):
   caps.setdefault(str(r["id"]),{"state":r.get("state","INSTALLED"),"evidence":[],"capability":r.get("capability"),"group":r.get("group")})
 d["publication_enabled"]=False;Path(a.out).write_text(json.dumps(d,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","total":len(caps)}));raise SystemExit(0 if len(caps)==2500 else 2)
if __name__=="__main__":main()
