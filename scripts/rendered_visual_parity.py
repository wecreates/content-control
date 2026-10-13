#!/usr/bin/env python3
import argparse, json, hashlib, math
from pathlib import Path
from urllib.parse import urlparse
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

def compare_aligned_images(reference, candidate):
    """Qualified same-art comparison; not cross-story creative/style approval."""
    try:
        from scripts.style_structure_diagnostic import compare_structure
    except ModuleNotFoundError:
        from style_structure_diagnostic import compare_structure
    result=compare_structure(reference,candidate)
    iou=result.get('mask_iou')
    distance=1-iou if iou is not None else None
    return {'foreground_distance':distance,
            'foreground_present_in_both':result.get('foreground_present_in_both',False),
            'calibrated':False,'acceptance_effect':'none',
            'scope':'Aligned foreground geometry only; not creative approval'}


def qualified_structure_comparison(reference_dir, candidate_video, contract, threshold=0.14):
    blocked={'status':'BLOCKED','blocker':'BLOCKED_UNSUPPORTED_REFERENCE','framewise_style_parity':False,'reason':'Reference provenance and exact-candidate aligned-frame contract required; raw background difference is diagnostic only.'}
    if not isinstance(contract,dict) or contract.get('method')!='aligned_line_art' or contract.get('status')!='VERIFIED':
        return blocked
    if contract.get('candidate_sha256')!=sha256(candidate_video):
        return dict(blocked,reason='Reference alignment is not bound to this candidate')
    source=urlparse(str(contract.get('source_url','')))
    pairs=contract.get('pairs')
    if source.scheme!='https' or not source.hostname or source.username or source.password or not isinstance(pairs,list) or len(pairs)<4:
        return blocked
    allowed={p.name:p for p in Path(reference_dir).glob('ref-*.jpg')}
    cap=cv2.VideoCapture(str(candidate_video))
    results=[]
    seen=set()
    try:
        total=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        for pair in pairs:
            if not isinstance(pair,dict):return blocked
            name=pair.get('reference_file');index=pair.get('candidate_frame');seconds=pair.get('source_seconds')
            if name not in allowed or name in seen or pair.get('reference_sha256')!=sha256(allowed[name]):return blocked
            if type(index) is not int or not math.isfinite(total) or not 0<=index<total:return blocked
            if type(seconds) not in (float,int) or not math.isfinite(seconds) or seconds<0:return blocked
            seen.add(name)
            if not cap.set(cv2.CAP_PROP_POS_FRAMES,index):return blocked
            ok,image=cap.read();actual=cap.get(cv2.CAP_PROP_POS_FRAMES)
            if not ok or not math.isfinite(actual) or abs(actual-index-1)>.5:return blocked
            results.append(compare_aligned_images(cv2.imread(str(allowed[name])),image))
    finally:
        cap.release()
    return {'status':'BLOCKED','framewise_style_parity':False,
            'blocker':'STRUCTURE_CALIBRATION_REQUIRED',
            'method':'aligned_line_art_experiment','pairs':results,
            'reason':'Aligned measurements available, but no independently validated structural acceptance calibration exists. Full audiovisual and competitor review remain mandatory.'}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-video",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--threshold",type=float,default=0.14)
    ap.add_argument("--reference-contract",help="Verified exact-candidate aligned-frame provenance JSON; absent contract blocks approval")
    a=ap.parse_args()
    refs=load_reference_metrics(a.reference_dir)
    cands,duration=sample_video(a.candidate_video,len(refs))
    comp=compare_metric_series(refs,cands,a.threshold)
    contract=json.loads(Path(a.reference_contract).read_text()) if a.reference_contract else None
    structural=qualified_structure_comparison(a.reference_dir,a.candidate_video,contract,a.threshold)
    checks={
        "candidate_decodes":duration>0,
        "reference_frames_present":len(refs)>=4,
        "framewise_style_parity":structural["framewise_style_parity"],
    }
    report={
        "schema_version":1,
        "engine":"reference-qualified-parity-v2",
        "candidate_sha256":sha256(a.candidate_video),
        "candidate_duration_seconds":duration,
        "reference_frames":len(refs),
        "reference_manifest":[{"file":p.name,"sha256":sha256(p)} for p in sorted(Path(a.reference_dir).glob('ref-*.jpg'))],
        "threshold":a.threshold,
        "metric_weights":METRIC_WEIGHTS,
        "scope":"Sampled pixel statistics only; not a full audiovisual or semantic style review.",
        "reason":structural["reason"],
        "raw_pixel_diagnostic":dict(comp,reason=explain_comparison(comp),acceptance_effect="none"),
        "qualified_structure":structural,
        "checks":checks,
        **{k:v for k,v in comp.items() if k!="framewise_style_parity"},
        "framewise_style_parity":structural["framewise_style_parity"],
        "status":"BLOCKED" if structural["status"]=="BLOCKED" else ("PASS" if all(checks.values()) else "FAIL"),
        "publication_enabled":False,
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":report["status"],"mean_frame_distance":comp["mean_frame_distance"],"p90_frame_distance":comp["p90_frame_distance"]},sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" else 2)

if __name__=="__main__":
    main()
