#!/usr/bin/env python3
import argparse, json, hashlib
from pathlib import Path
import cv2
import numpy as np

METRIC_WEIGHTS={"edge_density":0.35,"white_fraction":0.35,"mean_brightness":0.30}

def frame_metrics(img):
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    edge=cv2.Canny(gray,80,180)
    return {
        "edge_density":float((edge>0).mean()),
        "white_fraction":float((gray>245).mean()),
        "mean_brightness":float(gray.mean()/255.0),
    }

def compare_metric_series(refs,cands,threshold=0.14):
    n=min(len(refs),len(cands))
    if n<2:
        return {"framewise_style_parity":False,"mean_frame_distance":1.0,"frame_distances":[],"paired_frames":n}
    distances=[]
    for r,c in zip(refs[:n],cands[:n]):
        d=0.0
        for k,w in METRIC_WEIGHTS.items():
            d+=abs(float(r[k])-float(c[k]))*w
        distances.append(d)
    mean=float(np.mean(distances))
    p90=float(np.percentile(distances,90))
    return {
        "framewise_style_parity":mean<=threshold and p90<=threshold*1.5,
        "mean_frame_distance":mean,
        "p90_frame_distance":p90,
        "frame_distances":distances,
        "paired_frames":n,
    }

def sample_video(path,count):
    cap=cv2.VideoCapture(str(path))
    fps=float(cap.get(cv2.CAP_PROP_FPS) or 0)
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps<=0 or total<=0:
        cap.release(); raise RuntimeError("cannot decode candidate video")
    out=[]
    for i in range(count):
        pos=0 if count==1 else round((total-1)*i/(count-1))
        cap.set(cv2.CAP_PROP_POS_FRAMES,pos)
        ok,frame=cap.read()
        if not ok:
            cap.release(); raise RuntimeError(f"cannot sample candidate frame {i}")
        out.append(frame_metrics(frame))
    duration=total/fps
    cap.release()
    return out,duration

def load_reference_metrics(path):
    refs=[]
    for p in sorted(Path(path).glob("ref-*.jpg")):
        img=cv2.imread(str(p))
        if img is None:
            continue
        refs.append(frame_metrics(img))
    if len(refs)<4:
        raise RuntimeError("insufficient reference frames")
    return refs

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-video",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--threshold",type=float,default=0.14)
    a=ap.parse_args()
    refs=load_reference_metrics(a.reference_dir)
    cands,duration=sample_video(a.candidate_video,len(refs))
    comp=compare_metric_series(refs,cands,a.threshold)
    checks={
        "candidate_decodes":duration>0,
        "reference_frames_present":len(refs)>=4,
        "framewise_style_parity":comp["framewise_style_parity"],
    }
    report={
        "schema_version":1,
        "engine":"rendered-frame-parity-v1",
        "candidate_sha256":sha256(a.candidate_video),
        "candidate_duration_seconds":duration,
        "reference_frames":len(refs),
        "checks":checks,
        **comp,
        "status":"PASS" if all(checks.values()) else "FAIL",
        "publication_enabled":False,
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":report["status"],"mean_frame_distance":comp["mean_frame_distance"],"p90_frame_distance":comp["p90_frame_distance"]},sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" else 2)

if __name__=="__main__":
    main()
