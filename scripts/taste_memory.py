#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def load(p):
 try:return json.loads(Path(p).read_text())
 except:return {"schema_version":1,"accepted":[],"rejected":[],"centroid":{},"publication_enabled":False}
def update(mem,features,accepted):
 row={k:features.get(k) for k in ["shot_scale_diversity","transition_diversity","static_fraction","composition_repeat","joke_density","visual_metaphor_density"]}
 key="accepted" if accepted else "rejected";mem.setdefault(key,[]).append(row);mem[key]=mem[key][-50:]
 acc=mem.get("accepted",[]);cent={}
 if acc:
  for k in row:
   vals=[float(x[k]) for x in acc if x.get(k) is not None]
   if vals:cent[k]=round(sum(vals)/len(vals),4)
 mem["centroid"]=cent;mem["publication_enabled"]=False;return mem
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--memory",required=True);ap.add_argument("--features",required=True);ap.add_argument("--accepted",choices=["yes","no"],required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 r=update(load(a.memory),json.loads(Path(a.features).read_text()),a.accepted=="yes");Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","accepted":len(r["accepted"]),"rejected":len(r["rejected"])}))
if __name__=="__main__":main()
