#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
def qa(ref,clone):
    r=ref.get("shot_timeline",[]); c=clone.get("shots",clone.get("beats",[]))
    checks={}
    checks["shot_count_close"]=abs(len(r)-len(c))<=max(1,round(len(r)*.15))
    n=min(len(r),len(c))
    timing=[]
    camera=[]
    scale=[]
    for i in range(n):
        rd=float(r[i]["end"])-float(r[i]["start"]); cd=float(c[i]["end"])-float(c[i]["start"])
        timing.append(abs(rd-cd)<=max(.18,rd*.18))
        camera.append(r[i].get("camera")==c[i].get("camera"))
        scale.append(r[i].get("shot_scale")==c[i].get("shot_scale"))
    checks["timing_parity"]=bool(timing) and sum(timing)/len(timing)>=.8
    checks["camera_grammar_parity"]=bool(camera) and sum(camera)/len(camera)>=.7
    checks["shot_scale_parity"]=bool(scale) and sum(scale)/len(scale)>=.7
    checks["publication_disabled"]=clone.get("publication_enabled") is False
    failed=[k for k,v in checks.items() if not v]
    return {"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--reference",required=True);ap.add_argument("--candidate-timeline",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    result=qa(json.loads(Path(a.reference).read_text()),json.loads(Path(a.candidate_timeline).read_text()));Path(a.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n");print(json.dumps(result,sort_keys=True));raise SystemExit(0 if result["status"]=="PASS" else 2)
if __name__=="__main__":main()
