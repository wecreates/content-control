#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path
import cv2
import numpy as np

def load(path):
    img=cv2.imread(str(path))
    if img is None: raise RuntimeError(f"cannot read {path}")
    return img

def metrics(img):
    h,w=img.shape[:2]
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    edge=cv2.Canny(gray,80,180)
    return {
        "width":w,
        "height":h,
        "aspect":w/h,
        "edge_density":float((edge>0).mean()),
        "black_fraction":float((gray<12).mean()),
        "white_fraction":float((gray>245).mean()),
        "mean_brightness":float(gray.mean()/255.0),
    }

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for c in iter(lambda:f.read(1024*1024),b""): h.update(c)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-video",required=True)
    ap.add_argument("--candidate-dir",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()

    refs=sorted(Path(a.reference_dir).glob("ref-*.jpg"))
    cands=sorted(Path(a.candidate_dir).glob("cand-*.jpg"))
    if len(refs)<10 or len(cands)<8: raise RuntimeError("insufficient QA frames")

    rm=[metrics(load(p)) for p in refs]
    cm=[metrics(load(p)) for p in cands]
    redge=float(np.mean([m["edge_density"] for m in rm]))
    cedge=float(np.mean([m["edge_density"] for m in cm]))
    ratio=cedge/(redge or 1e-9)

    cap=cv2.VideoCapture(a.candidate_video)
    fps=float(cap.get(cv2.CAP_PROP_FPS) or 0)
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    prev=None; diffs=[]; i=0
    while True:
        ok,frame=cap.read()
        if not ok: break
        if i%24==0:
            g=cv2.resize(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY),(180,320))
            if prev is not None:
                diffs.append(float(cv2.absdiff(g,prev).mean()/255.0))
            prev=g
        i+=1
    cap.release()
    duration=(total/fps) if fps else 0.0
    active=float(np.mean(np.array(diffs)>0.01)) if diffs else 0.0

    checks={
        "duration_30s":29.5<=duration<=30.5,
        "portrait_9_16":all(abs(m["aspect"]-(9/16))<0.03 for m in cm),
        "no_black_frames":all(m["black_fraction"]<0.55 for m in cm),
        "reference_edge_density_ratio":0.35<=ratio<=3.0,
        "motion_activity":active>=0.40,
    }
    report={
        "schema_version":1,
        "engine":"opencv-free-qa-v1",
        "candidate_sha256":sha256(a.candidate_video),
        "duration_seconds":duration,
        "sampled_candidate_frames":len(cands),
        "reference_frames":len(refs),
        "mean_reference_edge_density":redge,
        "mean_candidate_edge_density":cedge,
        "edge_density_ratio":ratio,
        "motion_active_fraction":active,
        "checks":checks,
        "verdict":"PASS" if all(checks.values()) else "FAIL",
    }
    Path(a.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    if report["verdict"]!="PASS": raise SystemExit(2)

if __name__=="__main__": main()
