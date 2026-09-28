#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path
def analyze(video,step=4):
    cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24
    prev=None;rows=[];idx=0
    while True:
        ok,frame=cap.read()
        if not ok: break
        if idx%step==0:
            gray=cv2.cvtColor(cv2.resize(frame,(180,320)),cv2.COLOR_BGR2GRAY)
            if prev is not None:
                flow=cv2.calcOpticalFlowFarneback(prev,gray,None,.5,3,15,3,5,1.2,0)
                mag,ang=cv2.cartToPolar(flow[...,0],flow[...,1])
                med=float(np.median(mag));mean=float(np.mean(mag));peak=float(np.percentile(mag,95))
                vx=float(np.mean(flow[...,0]));vy=float(np.mean(flow[...,1]))
                rows.append({"time":round(idx/fps,3),"mean":round(mean,5),"median":round(med,5),"p95":round(peak,5),"vx":round(vx,5),"vy":round(vy,5)})
            prev=gray
        idx+=1
    cap.release()
    if not rows:return {"schema_version":1,"status":"EMPTY","samples":[]}
    camera=[{"time":r["time"],"speed":round((r["vx"]**2+r["vy"]**2)**.5,5),"direction":"right" if r["vx"]>.15 else "left" if r["vx"]<-.15 else "down" if r["vy"]>.15 else "up" if r["vy"]<-.15 else "stable"} for r in rows]
    return {"schema_version":1,"status":"PASS","samples":rows,"camera_curve":camera,"mean_flow":round(float(np.mean([r["mean"] for r in rows])),5),"peak_flow":round(max(r["p95"] for r in rows),5),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=analyze(a.video);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"samples":len(r.get("samples",[]))}))
if __name__=="__main__":main()
