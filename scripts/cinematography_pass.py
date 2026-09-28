#!/usr/bin/env python3
import argparse,json
from pathlib import Path
MOVES=["punch_in","tracking","snap_wide","whip_pan","impact_close"]
SCALES=["close","medium","wide","medium"]
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for i,s in enumerate(out.get("scenes",[])):
        cam=s.setdefault("camera",{})
        cam.setdefault("shot_scale",SCALES[i%len(SCALES)]);cam.setdefault("move",MOVES[i%len(MOVES)])
        cam["screen_direction"]="ltr" if i%2==0 else "rtl"
        cam["lens_equivalent_mm"]=[35,50,28,65][i%4]
        cam["motivation"]="follow character goal or reveal consequence"
        cam["eyeline_locked"]=True
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
