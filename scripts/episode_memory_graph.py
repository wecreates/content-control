#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def update(mem,doc,verdict):
 try:m=json.loads(Path(mem).read_text())
 except:m={"schema_version":1,"characters":{},"sets":{},"assets":{},"positive":[],"negative":[],"publication_enabled":False}
 for s in doc.get("scenes",[]):
  for c in s.get("characters",[]):m["characters"].setdefault(c.get("id"),{"appearances":0,"gestures":{},"reactions":{}})["appearances"]+=1
  env=(s.get("environment") or {}).get("id")
  if env:m["sets"].setdefault(env,{"uses":0,"geometry_lock":True})["uses"]+=1
  for p in s.get("props",[]):m["assets"].setdefault(p.get("id"),{"uses":0,"quality":1.0})["uses"]+=1
 row={"project":doc.get("project_id"),"scene_ids":[s.get("id") for s in doc.get("scenes",[])]}
 m["positive" if verdict=="accepted" else "negative"].append(row);m["positive"]=m["positive"][-100:];m["negative"]=m["negative"][-100:];m["publication_enabled"]=False;return m
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--memory",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--verdict",choices=["accepted","rejected"],required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=update(a.memory,json.loads(Path(a.ccsd).read_text()),a.verdict);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","positive":len(r["positive"]),"negative":len(r["negative"])}))
if __name__=="__main__":main()
