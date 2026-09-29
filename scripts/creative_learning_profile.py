#!/usr/bin/env python3
import argparse,json
from pathlib import Path
DEFAULT={"camera":{"guided_track":1.0,"creeping_push":1.0,"snap_reveal":1.0},"staging":{"clean_triangle":1.0,"diagonal_depth":1.0,"misdirection_reveal":1.0},"performance":{"low":1.0,"medium":1.0,"high":1.0}}
def load(p):
 try:return json.loads(Path(p).read_text())
 except:return {"schema_version":1,"weights":DEFAULT,"history":[],"publication_enabled":False}
def bucket(x):return "low" if x<.9 else "high" if x>1.1 else "medium"
def update(profile,receipt,reward):
 w=profile.setdefault("weights",DEFAULT.copy());winner=(receipt.get("winner") or {}).get("id")
 for row in receipt.get("ranked",[]):
  if row.get("id")!=winner:continue
  cid=row["id"]; mapping={"clarity":("guided_track","clean_triangle",.8),"energy":("creeping_push","diagonal_depth",1.15),"comedy":("snap_reveal","misdirection_reveal",1.3)}
  cam,stage,perf=mapping.get(cid,("guided_track","clean_triangle",1))
  delta=max(-.15,min(.15,(float(reward)-.65)*.35))
  w["camera"][cam]=round(max(.4,min(1.8,w["camera"].get(cam,1)+delta)),4)
  w["staging"][stage]=round(max(.4,min(1.8,w["staging"].get(stage,1)+delta)),4)
  b=bucket(perf);w["performance"][b]=round(max(.4,min(1.8,w["performance"].get(b,1)+delta)),4)
 profile.setdefault("history",[]).append({"winner":winner,"reward":reward});profile["history"]=profile["history"][-100:];profile["publication_enabled"]=False;return profile
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--profile",required=True);ap.add_argument("--receipt",required=True);ap.add_argument("--reward",type=float,required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 r=update(load(a.profile),json.loads(Path(a.receipt).read_text()),a.reward);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","history":len(r["history"])}))
if __name__=="__main__":main()
