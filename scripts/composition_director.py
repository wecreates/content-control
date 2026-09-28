#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for i,s in enumerate(out.get("scenes",[])):
        scale=(s.get("camera") or {}).get("shot_scale","medium")
        char_count=max(1,len(s.get("characters",[])))
        focal_x=.44 if i%2==0 else .56
        if char_count>1: focal_x=.5
        s["composition"]={
          "focal_point":[focal_x,.58 if scale!="close" else .52],
          "text_zone":[.12,.24],
          "action_zone":[.28,.76],
          "cta_zone":[.82,.94],
          "foreground_clearance":.06,
          "safe_inset":.05,
          "silhouette_separation_min":.12,
          "negative_space_target":.34,
          "screen_direction":"ltr" if i%2==0 else "rtl",
          "visual_priority":["character","primary_prop","kinetic_text","overlay","background"]
        }
    out["publication_enabled"]=False
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))

if __name__=="__main__":main()
