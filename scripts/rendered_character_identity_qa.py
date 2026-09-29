#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path

def feat(img):
 g=cv2.cvtColor(cv2.resize(img,(128,128)),cv2.COLOR_BGR2GRAY)
 edges=cv2.Canny(g,70,150)>0
 ys,xs=np.where(edges)
 if len(xs)<10:return {"edge":0,"cx":.5,"cy":.5,"spread":0}
 return {"edge":float(edges.mean()),"cx":float(xs.mean()/128),"cy":float(ys.mean()/128),"spread":float((xs.std()+ys.std())/256)}
def dist(a,b):
 return .35*abs(a["edge"]-b["edge"])/.15+.2*abs(a["cx"]-b["cx"])+.2*abs(a["cy"]-b["cy"])+.25*abs(a["spread"]-b["spread"])/.25
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--canonical-dir",required=True);ap.add_argument("--candidate-dir",required=True);ap.add_argument("--out",required=True);ap.add_argument("--max-distance",type=float,default=.42);a=ap.parse_args()
 refs={p.stem:feat(cv2.imread(str(p))) for p in Path(a.canonical_dir).glob("*.png") if cv2.imread(str(p)) is not None}
 rows=[];ok=True
 for p in sorted(Path(a.candidate_dir).glob("*.png"))+sorted(Path(a.candidate_dir).glob("*.jpg")):
  im=cv2.imread(str(p))
  if im is None:continue
  f=feat(im); ds={k:round(dist(v,f),4) for k,v in refs.items()}
  best=min(ds,key=ds.get) if ds else None; d=ds.get(best,99) if best else 99; passed=d<=a.max_distance;ok=ok and passed
  rows.append({"file":p.name,"best_identity":best,"distance":d,"pass":passed,"distances":ds})
 r={"schema_version":1,"status":"PASS" if ok and rows and refs else "FAIL","frames":rows,"canonical_count":len(refs),"publication_enabled":False}
 Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"frames":len(rows),"canonical":len(refs)}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
