#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for s in out.get("scenes",[]):
        fx=s.setdefault("fx",[])
        beat=(s.get("story") or {}).get("beat","")
        if any(k in beat.lower() for k in ["impact","reveal","payoff","danger"]): fx.append({"type":"impact_lines","physics":"spring","duration_frames":8})
        if s.get("props"): fx.append({"type":"prop_secondary_motion","physics":"gravity+bounce","collision":True})
        s["simulation"]={"gravity":980,"restitution":.45,"drag":.08,"deterministic_seed":int(float(s.get("start",0))*1000)}
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
