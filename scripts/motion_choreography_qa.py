#!/usr/bin/env python3
import argparse,json,cv2
from pathlib import Path
import numpy as np

def inspect(video):
    cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24
    stride=max(1,round(fps/6));prev=None;idx=0;values=[]
    while True:
        ok,frame=cap.read()
        if not ok: break
        if idx%stride==0:
            g=cv2.cvtColor(cv2.resize(frame,(160,284)),cv2.COLOR_BGR2GRAY)
            if prev is not None: values.append(float(cv2.absdiff(g,prev).mean()/255))
            prev=g
        idx+=1
    cap.release()
    if not values: return {"schema_version":1,"status":"FAIL","reason":"no motion samples","publication_enabled":False}
    moving=[v>.008 for v in values]
    max_static=0;run=0
    for m in moving:
        run=0 if m else run+1;max_static=max(max_static,run)
    sample_interval=1/6
    max_static_seconds=max_static*sample_interval
    mean=float(np.mean(values));active=float(np.mean(moving))
    checks={
      "motion_density":active>=.45,
      "no_long_static_hold":max_static_seconds<=1.15,
      "meaningful_mean_motion":mean>=.006,
      "not_constant_noise":mean<=.19,
    }
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"mean_motion":round(mean,6),"active_fraction":round(active,6),"max_static_seconds":round(max_static_seconds,3),"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=inspect(a.video);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)

if __name__=="__main__":main()
