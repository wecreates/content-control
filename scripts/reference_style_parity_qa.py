#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
def qa(ref,clone):
    r=ref.get("shot_timeline",[]); c=clone.get("shot_timeline",clone.get("shots",clone.get("beats",[])))
    checks={}
    checks["shot_count_close"]=abs(len(r)-len(c))<=max(1,round(len(r)*.15))
    n=min(len(r),len(c))
    timing=[]
    camera=[]
    scale=[]
    timing_bad=[];camera_bad=[];scale_bad=[]
    for i in range(n):
        rd=float(r[i]["end"])-float(r[i]["start"]); cd=float(c[i]["end"])-float(c[i]["start"])
        tok=abs(rd-cd)<=max(.18,rd*.18); cok=r[i].get("camera")==c[i].get("camera"); sok=r[i].get("shot_scale")==c[i].get("shot_scale")
        timing.append(tok);camera.append(cok);scale.append(sok)
        if not tok: timing_bad.append(i)
        if not cok: camera_bad.append(i)
        if not sok: scale_bad.append(i)
    checks["timing_parity"]=bool(timing) and sum(timing)/len(timing)>=.8
    checks["camera_grammar_parity"]=bool(camera) and sum(camera)/len(camera)>=.7
    checks["shot_scale_parity"]=bool(scale) and sum(scale)/len(scale)>=.7
    rm=[float(x.get("activity",0)) for x in ref.get("motion_curve",[])]
    cm=[float(x.get("activity",0)) for x in clone.get("motion_curve",[])]
    if rm and cm:
        ravg=sum(rm)/len(rm); cavg=sum(cm)/len(cm)
        checks["motion_density_parity"]=abs(cavg-ravg)<=max(.025,ravg*.55)
    else:
        checks["motion_density_parity"]=True
    rf=ref.get("visual_style_fingerprint",{}); cf=clone.get("visual_style_fingerprint",{})
    if rf and cf:
        deltas=[]
        for k,tol in [("mean_luma",.22),("mean_saturation",.22),("edge_density",.06),("white_background_fraction",.30)]:
            if k in rf and k in cf: deltas.append(abs(float(rf[k])-float(cf[k]))<=tol)
        checks["visual_style_parity"]=all(deltas) if deltas else True
    else:
        checks["visual_style_parity"]=True
    checks["publication_disabled"]=clone.get("publication_enabled") is False
    failed=[k for k,v in checks.items() if not v]
    mismatched=sorted(set(timing_bad+camera_bad+scale_bad))
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"mismatched_scene_indices":mismatched,"timing_mismatches":timing_bad,"camera_mismatches":camera_bad,"scale_mismatches":scale_bad,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--reference",required=True);ap.add_argument("--candidate-timeline",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    result=qa(json.loads(Path(a.reference).read_text()),json.loads(Path(a.candidate_timeline).read_text()));Path(a.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n");print(json.dumps(result,sort_keys=True));raise SystemExit(0 if result["status"]=="PASS" else 2)
if __name__=="__main__":main()
