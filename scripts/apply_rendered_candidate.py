#!/usr/bin/env python3
import argparse,copy,json
from pathlib import Path
def apply(ccsd,receipt):
    out=copy.deepcopy(ccsd); w=(receipt.get("winner") or {}).get("id")
    if not w: return out
    for s in out.get("scenes",[]):
        opts={x.get("id"):x for x in s.get("creative_candidates",[])};x=opts.get(w)
        if not x: continue
        s["candidate_selection"]={"winner":w,"score":receipt["winner"]["score"],"source":"rendered_evidence","ranked":receipt.get("ranked",[]),"rollback_on_regression":True}
        s.setdefault("camera",{})["candidate_bias"]=x.get("camera");s.setdefault("composition",{})["staging_strategy"]=x.get("staging")
        if w=="energy":s["camera"]["move"]="creeping_push"
        elif w=="comedy":s["camera"]["move"]="snap_reveal"
        else:s["camera"]["move"]="guided_track"
        for ch in s.get("characters",[]):ch.setdefault("performance_engine",{})["candidate_scale"]=x.get("performance_scale",1)
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--receipt",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.receipt).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
