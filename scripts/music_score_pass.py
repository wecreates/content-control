#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd));n=max(1,len(out.get("scenes",[])))
    for i,s in enumerate(out.get("scenes",[])):
        tension=i/max(1,n-1);phase=(s.get("color_script") or {}).get("phase","setup")
        energy=.35+.4*tension if phase!="resolution" else .28
        s.setdefault("audio",{}).setdefault("music",{}).update({"energy":round(min(.85,energy),2),"motif":"curious_pluck" if phase=="setup" else "tension_pulse" if phase=="danger" else "reward_sting" if phase=="reward" else "resolve_tag","duck_under_dialogue":True})
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
