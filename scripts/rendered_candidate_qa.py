#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path

def metrics(path):
    cap=cv2.VideoCapture(str(path)); fps=cap.get(cv2.CAP_PROP_FPS) or 24; prev=None; motion=[]; edges=[]; whites=[]; borders=[]; centers=[]; i=0; stride=max(1,round(fps/6))
    while True:
        ok,fr=cap.read()
        if not ok: break
        if i%stride==0:
            g=cv2.cvtColor(cv2.resize(fr,(180,320)),cv2.COLOR_BGR2GRAY); e=cv2.Canny(g,80,160)>0
            if prev is not None: motion.append(float(cv2.absdiff(g,prev).mean()/255))
            prev=g; edges.append(float(e.mean())); whites.append(float((g>238).mean()))
            border=np.zeros_like(e);border[:12,:]=1;border[-12:,:]=1;border[:,:9]=1;border[:,-9:]=1
            borders.append(float(e[border.astype(bool)].mean()))
            centers.append(float(e[55:270,22:158].mean()))
        i+=1
    cap.release()
    return {"motion":float(np.mean(motion)) if motion else 0,"motion_active":float(np.mean([x>.008 for x in motion])) if motion else 0,"edge_density":float(np.mean(edges)) if edges else 1,"white_fraction":float(np.mean(whites)) if whites else 0,"border_activity":float(np.mean(borders)) if borders else 1,"center_activity":float(np.mean(centers)) if centers else 0}

def score(m):
    readability=max(0,1-abs(m["edge_density"]-.11)/.16)
    whitespace=max(0,1-abs(m["white_fraction"]-.68)/.45)
    safety=max(0,1-m["border_activity"]/.14)
    subject=min(1,m["center_activity"]/.035)
    motion=min(1,m["motion_active"]/.75)
    return round(.27*readability+.18*whitespace+.18*safety+.17*subject+.20*motion,4)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--candidates",nargs="+",required=True);ap.add_argument("--out",required=True);ap.add_argument("--min-score",type=float,default=.58);a=ap.parse_args()
    rows=[]
    for spec in a.candidates:
        cid,path=spec.split("=",1);m=metrics(path);rows.append({"id":cid,"path":path,"score":score(m),"metrics":m})
    rows.sort(key=lambda x:x["score"],reverse=True); winner=rows[0] if rows else None
    status="PASS" if winner and winner["score"]>=a.min_score else "REPAIR"
    r={"schema_version":1,"status":status,"winner":winner,"ranked":rows,"minimum_score":a.min_score,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":status,"winner":winner["id"] if winner else None,"score":winner["score"] if winner else None}))
    raise SystemExit(0 if status=="PASS" else 3)
if __name__=="__main__":main()
