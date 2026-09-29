#!/usr/bin/env python3
import argparse,copy,json
from pathlib import Path
def score(c,weights=None):
    base={"clarity":.72,"energy":.70,"comedy":.69}.get(c.get("id"),.6)
    if c.get("staging")=="diagonal_depth": base+=.05
    if c.get("staging")=="misdirection_reveal": base+=.04
    if c.get("edit_bias")=="readable": base+=.03
    weights=weights or {}
    base*=float((weights.get("camera") or {}).get(c.get("camera"),1))
    base*=float((weights.get("staging") or {}).get(c.get("staging"),1))
    return round(min(1,base),3)
def select(ccsd,weights=None):
    out=copy.deepcopy(ccsd);receipt={"schema_version":1,"scenes":[],"publication_enabled":False}
    for s in out.get("scenes",[]):
        cs=s.get("creative_candidates") or []
        ranked=sorted([{**c,"score":score(c,weights)} for c in cs],key=lambda x:x["score"],reverse=True)
        winner=ranked[0] if ranked else None
        if winner:
            s["candidate_selection"]={"winner":winner["id"],"score":winner["score"],"ranked":ranked,"rollback_on_regression":True}
            s.setdefault("camera",{})["candidate_bias"]=winner["camera"];s.setdefault("composition",{})["staging_strategy"]=winner["staging"]
            for ch in s.get("characters",[]):ch.setdefault("performance_engine",{})["candidate_scale"]=winner["performance_scale"]
        receipt["scenes"].append({"scene_id":s.get("id"),"winner":winner["id"] if winner else None,"ranked":ranked})
    out["publication_enabled"]=False;return out,receipt
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);ap.add_argument("--receipt",required=True);ap.add_argument("--learning-profile");a=ap.parse_args()
    profile={}
    if a.learning_profile and Path(a.learning_profile).is_file():profile=json.loads(Path(a.learning_profile).read_text()).get("weights",{})
    o,r=select(json.loads(Path(a.ccsd).read_text()),profile)
    Path(a.out).write_text(json.dumps(o,indent=2,sort_keys=True)+"\n");Path(a.receipt).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r["scenes"])}))
if __name__=="__main__":main()
