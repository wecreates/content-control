#!/usr/bin/env python3
import argparse, json, hashlib, math
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
    if not math.isfinite(threshold) or threshold<=0:
        raise ValueError("threshold must be finite and positive")
    if len(refs)!=len(cands):
        raise ValueError("reference and candidate sample counts must match")
    n=min(len(refs),len(cands))
    if n<2:
        return {"framewise_style_parity":False,"mean_frame_distance":1.0,"frame_distances":[],"paired_frames":n}
    distances=[]
    components={k:[] for k in METRIC_WEIGHTS}
    for r,c in zip(refs[:n],cands[:n]):
        d=0.0
        for k,w in METRIC_WEIGHTS.items():
            rv,cv=float(r[k]),float(c[k])
            if not all(math.isfinite(v) and 0<=v<=1 for v in (rv,cv)):
                raise ValueError("frame metrics must be finite normalized values")
            delta=abs(rv-cv)*w
            d+=delta
            components[k].append(delta)
        distances.append(d)
    mean=float(np.mean(distances))
    p90=float(np.percentile(distances,90))
    return {
        "framewise_style_parity":mean<=threshold and p90<=threshold*1.5,
        "mean_frame_distance":mean,
        "p90_frame_distance":p90,
        "frame_distances":distances,
        "paired_frames":n,
        "weighted_mean_distance_components":{k:float(np.mean(v)) for k,v in components.items()},
    }

def explain_comparison(comp):
    if not comp.get('paired_frames',0)>=2:
        return 'Insufficient paired reference frames; no comparison established.'
    components=comp['weighted_mean_distance_components']
    key=max(components,key=components.get)
    if comp['framewise_style_parity']:
        return 'Sampled brightness and edge statistics match; this does not establish creative or competitive quality.'
    return (f"Reference frame statistics differ; dominant component: {key} "
            f"({components[key]:.4f} of {comp['mean_frame_distance']:.4f}). "
            'This does not assess creative quality or override the required brand style.')

def sample_video(path,count):
    if type(count) is not int or count<2:
        raise ValueError("at least two candidate samples required")
    cap=cv2.VideoCapture(str(path))
    try:
        fps=float(cap.get(cv2.CAP_PROP_FPS) or 0)
        frame_count=float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if not math.isfinite(fps) or fps<=0 or not math.isfinite(frame_count) or frame_count<1 or not frame_count.is_integer():
            raise RuntimeError("invalid candidate video metadata")
        total=int(frame_count)
        if total<count:
            raise RuntimeError("insufficient distinct candidate frames")
        out=[]
        for i in range(count):
            pos=round((total-1)*i/(count-1))
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,pos):
                raise RuntimeError(f"cannot seek candidate frame {pos}")
            ok,frame=cap.read()
            if not ok or frame is None:
                raise RuntimeError(f"cannot sample candidate frame {pos}")
            # OpenCV reports the next frame index after a successful read.
            # Unsupported position reporting is not evidence of correct sampling.
            actual=float(cap.get(cv2.CAP_PROP_POS_FRAMES))
            if not math.isfinite(actual) or abs(actual-(pos+1))>.5:
                raise RuntimeError(f"candidate seek position unverified at frame {pos}")
            out.append(frame_metrics(frame))
        return out,total/fps
    finally:
        cap.release()


def load_reference_metrics(path):
    refs=[]
    for p in sorted(Path(path).glob("ref-*.jpg")):
        img=cv2.imread(str(p))
        if img is None:
            raise RuntimeError(f"cannot decode reference frame: {p.name}")
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
        "reference_manifest":[{"file":p.name,"sha256":sha256(p)} for p in sorted(Path(a.reference_dir).glob('ref-*.jpg'))],
        "threshold":a.threshold,
        "metric_weights":METRIC_WEIGHTS,
        "scope":"Sampled pixel statistics only; not a full audiovisual or semantic style review.",
        "reason":explain_comparison(comp),
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
