#!/usr/bin/env python3
import argparse,copy,json
from pathlib import Path
def apply(ccsd,candidate):
    out=copy.deepcopy(ccsd)
    for s in out.get("scenes",[]):
        opts={x.get("id"):x for x in s.get("creative_candidates",[])}
        x=opts.get(candidate) or next(iter(opts.values()),None)
        if not x: continue
        s.setdefault("candidate_selection",{})["preview_candidate"]=candidate
        s.setdefault("camera",{})["candidate_bias"]=x.get("camera")
        s.setdefault("composition",{})["staging_strategy"]=x.get("staging")
        for ch in s.get("characters",[]): ch.setdefault("performance_engine",{})["candidate_scale"]=x.get("performance_scale",1)
        # translate candidate into visible renderer behavior
        if candidate=="energy": s["camera"]["move"]="creeping_push";s["camera"]["parallax_strength"]=max(.18,s["camera"].get("parallax_strength",0))
        elif candidate=="comedy": s["camera"]["move"]="snap_reveal";s.setdefault("editorial",{})["reaction_hold_frames"]=8
        else: s["camera"]["move"]="guided_track";s["camera"]["parallax_strength"]=min(.12,s["camera"].get("parallax_strength",.1))
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--candidate",required=True,choices=["clarity","energy","comedy"]);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()),a.candidate);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","candidate":a.candidate}))
if __name__=="__main__":main()
