#!/usr/bin/env python3
import argparse, json, hashlib
from pathlib import Path
import cv2
import numpy as np

METRIC_WEIGHTS={"edge_density":0.35,"white_fraction":0.35,"mean_brightness":0.30}

def foreground_diagnostics(gray):
    """Describe composition without treating paper tint as foreground.

    Supplemental evidence only: these measurements cannot change acceptance.
    The 90th percentile estimates a light backdrop, not a semantic subject mask.
    """
    background=float(np.percentile(gray,90))
    ink=gray.astype(float)<background-40.0
    height,width=gray.shape
    ys,xs=np.nonzero(ink)
    return {
        "estimated_background_luma":background/255.0,
        "dark_foreground_fraction":float(ink.mean()),
        "foreground_centroid_xy":([float(xs.mean()/width),float(ys.mean()/height)] if len(xs) else None),
        "foreground_vertical_quarters":[float(part.mean()) for part in np.array_split(ink,4,axis=0)],
        "method":"luma_40_below_frame_p90_descriptive_only",
    }

def benchmark_diagnostics(refs,cands):
    """Expose why the existing gate failed; never substitute a new score."""
    n=min(len(refs),len(cands))
    if not n:
        return {"acceptance_effect":"none","paired_frames":0}
    contributions={k:float(np.mean([abs(r[k]-c[k])*w for r,c in zip(refs[:n],cands[:n])])) for k,w in METRIC_WEIGHTS.items()}
    total=sum(contributions.values())
    return {
        "acceptance_effect":"none",
        "scope":"pixel statistics only; not full audiovisual or competitor-quality review",
        "paired_frames":n,
        "reference_means":{k:float(np.mean([r[k] for r in refs[:n]])) for k in METRIC_WEIGHTS},
        "candidate_means":{k:float(np.mean([c[k] for c in cands[:n]])) for k in METRIC_WEIGHTS},
        "weighted_distance_contributions":contributions,
        "white_fraction_distance_share":contributions["white_fraction"]/total if total else 0.0,
        "reference_foreground":[r.get("foreground_diagnostics") for r in refs[:n]],
        "candidate_foreground":[c.get("foreground_diagnostics") for c in cands[:n]],
        "review_guidance":"Check reference background and composition against the approved brief. Do not recolor output or loosen thresholds merely to pass this metric.",
    }

def frame_metrics(img):
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    edge=cv2.Canny(gray,80,180)
    background=float(np.percentile(gray,90))
    # Only compensate mild illumination on an already light stage. Dark video
    # must not become acceptable by division or exposure normalization.
    normalized=np.clip(gray.astype(float)*255.0/max(background,210.0),0,255).astype(np.uint8)
    normalized_edge=cv2.Canny(normalized,80,180)
    # The project's reserved caption region is above y=320 on its 1280px stage.
    # Density guards measure action below that band, so replacing paragraphs
    # with truthful progressive captions cannot masquerade as erased artwork.
    action=gray[gray.shape[0]//4:]
    action_normalized=normalized[gray.shape[0]//4:]
    return {
        "edge_density":float((edge>0).mean()),
        "white_fraction":float((gray>245).mean()),
        "mean_brightness":float(gray.mean()/255.0),
        "foreground_diagnostics":foreground_diagnostics(gray),
        "background_diagnostics":{
            "p90_bgr":np.percentile(img.reshape(-1,3),90,axis=0).tolist(),
            "p90_luma":background,
            "light_pixel_fraction":float((gray>=210).mean()),
        },
        "light_stage_normalized":{
            "edge_density":float((normalized_edge>0).mean()),
            "white_fraction":float((normalized>245).mean()),
            "mean_brightness":float(normalized.mean()/255.0),
        },
        "action_region_diagnostics":{
            "top_fraction":.25,
            "dark_foreground_fraction":foreground_diagnostics(action)["dark_foreground_fraction"],
            "edge_density":float((cv2.Canny(action_normalized,80,180)>0).mean()),
        },
    }

def compare_white_stage(refs,cands,threshold=0.14):
    """Explicit white-background profile, separate from legacy absolute color.

    Mild paper tint is removed before applying the SAME weights and distances.
    Independent raw-white, nonempty and factor-two content-density guards stop
    blank/dark/tiny/dense frames from passing a global-color similarity score.
    This remains technical style QA, never semantic or creative acceptance.
    """
    if len(refs)!=len(cands) or len(refs)<4:
        return {"framewise_style_parity":False,"checks":{"paired_reference_coverage":False},"paired_frames":min(len(refs),len(cands))}
    comparison=compare_metric_series([r["light_stage_normalized"] for r in refs],[c["light_stage_normalized"] for c in cands],threshold)
    def foreground_mean(xs):
        return float(np.mean([x["action_region_diagnostics"]["dark_foreground_fraction"] for x in xs]))
    def edge_mean(xs):
        return float(np.mean([x["action_region_diagnostics"]["edge_density"] for x in xs]))
    reference_ink,reference_edges=foreground_mean(refs),edge_mean(refs)
    ink_ratio=foreground_mean(cands)/reference_ink if reference_ink else 0.0
    edge_ratio=edge_mean(cands)/reference_edges if reference_edges else 0.0
    checks={
        "paired_reference_coverage":True,
        "light_reference_stage":all(r["background_diagnostics"]["p90_luma"]>=210 and r["background_diagnostics"]["light_pixel_fraction"]>=.55 for r in refs),
        "raw_white_candidate_background":all(min(c["background_diagnostics"]["p90_bgr"])>=245 and max(c["background_diagnostics"]["p90_bgr"])-min(c["background_diagnostics"]["p90_bgr"])<=10 and c["background_diagnostics"]["light_pixel_fraction"]>=.55 for c in cands),
        "nonempty_reference_frames":all(r["foreground_diagnostics"]["dark_foreground_fraction"]>=.005 for r in refs),
        "nonempty_candidate_frames":all(c["foreground_diagnostics"]["dark_foreground_fraction"]>=.005 for c in cands),
        "foreground_density_preserved":.5<=ink_ratio<=2.0,
        "edge_density_preserved":.5<=edge_ratio<=2.0,
        "normalized_style_distance":comparison["framewise_style_parity"],
    }
    return {**comparison,"framewise_style_parity":all(checks.values()),"checks":checks,
            "foreground_density_ratio":ink_ratio,"edge_density_ratio":edge_ratio,
            "density_scope":"action region below the reserved top-quarter caption band",
            "profile_limits":{"reference_p90_luma_min":210,"light_pixel_luma_min":210,
                              "light_pixel_fraction_min":.55,"candidate_p90_channel_min":245,
                              "candidate_p90_channel_spread_max":10,"foreground_fraction_min":.005,
                              "foreground_density_ratio":[.5,2.0],"edge_density_ratio":[.5,2.0],"action_region_top_fraction":.25},
            "profile":"white-stage-v2","creative_acceptance":False}

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
    ap.add_argument("--comparison-profile",choices=["legacy","white-stage-v2"],default="legacy")
    a=ap.parse_args()
    refs=load_reference_metrics(a.reference_dir)
    cands,duration=sample_video(a.candidate_video,len(refs))
    legacy=compare_metric_series(refs,cands,a.threshold)
    comp=compare_white_stage(refs,cands,a.threshold) if a.comparison_profile=="white-stage-v2" else legacy
    checks={
        "candidate_decodes":duration>0,
        "reference_frames_present":len(refs)>=4,
        "framewise_style_parity":comp["framewise_style_parity"],
        **comp.get("checks",{}),
    }
    report={
        "schema_version":1,
        "engine":"rendered-frame-parity-v1" if a.comparison_profile=="legacy" else "rendered-frame-parity-white-stage-v2",
        "comparison_profile":a.comparison_profile,
        "legacy_absolute_color_comparison":legacy,
        "candidate_sha256":sha256(a.candidate_video),
        "candidate_duration_seconds":duration,
        "reference_frames":len(refs),
        "thresholds":{"mean_frame_distance":a.threshold,"p90_frame_distance":a.threshold*1.5},
        "reference_frame_sha256":{p.name:sha256(p) for p in sorted(Path(a.reference_dir).glob("ref-*.jpg")) if cv2.imread(str(p)) is not None},
        "benchmark_diagnostics":benchmark_diagnostics(refs,cands),
        **comp,
        "checks":checks,
        "status":"PASS" if all(checks.values()) else "FAIL",
        "publication_enabled":False,
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":report["status"],"mean_frame_distance":comp["mean_frame_distance"],"p90_frame_distance":comp["p90_frame_distance"]},sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" else 2)

if __name__=="__main__":
    main()

