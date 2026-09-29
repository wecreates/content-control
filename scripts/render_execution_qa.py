#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path
def inspect(video):
 cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24;prev=None;prev2=None;rows=[];i=0;stride=max(1,round(fps/8))
 while True:
  ok,f=cap.read()
  if not ok:break
  if i%stride==0:
   g=cv2.cvtColor(cv2.resize(f,(180,320)),cv2.COLOR_BGR2GRAY);e=cv2.Canny(g,80,160)>0
   ys,xs=np.where(e);cx=float(xs.mean()/180) if len(xs) else .5;cy=float(ys.mean()/320) if len(ys) else .5
   motion=float(cv2.absdiff(g,prev).mean()/255) if prev is not None else 0
   accel=abs(motion-(float(cv2.absdiff(prev,prev2).mean()/255) if prev is not None and prev2 is not None else motion))
   border=np.r_[e[:10,:].ravel(),e[-10:,:].ravel(),e[:,:8].ravel(),e[:,-8:].ravel()]
   rows.append({"t":round(i/fps,3),"saliency":[round(cx,3),round(cy,3)],"motion":round(motion,5),"acceleration":round(accel,5),"border_activity":round(float(border.mean()),5),"edge_density":round(float(e.mean()),5)})
   prev2,prev=prev,g
  i+=1
 cap.release()
 if not rows:return {"status":"FAIL","checks":{},"frames":[],"publication_enabled":False}
 checks={"saliency_safe":sum(.08<x["saliency"][0]<.92 and .08<x["saliency"][1]<.92 for x in rows)/len(rows)>.9,"no_overlap_risk":max(x["border_activity"] for x in rows)<.16,"smooth_motion":sum(x["acceleration"]>.09 for x in rows)/len(rows)<.08,"not_cluttered":sum(x["edge_density"]>.25 for x in rows)/len(rows)<.08}
 return {"schema_version":1,"status":"PASS" if all(checks.values()) else "FAIL","checks":checks,"frames":rows,"publication_enabled":False}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=inspect(a.video);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"checks":r["checks"]}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
