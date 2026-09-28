#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd))
    for i,s in enumerate(out.get("scenes",[])):
        phase=(s.get("color_script") or {}).get("phase","setup")
        s["lighting"]={"key":"soft_front" if phase!="danger" else "hard_side","fill":"minimal","rim":"teal" if phase in ["setup","resolution"] else "red" if phase=="danger" else "yellow","shadow_opacity":.12 if phase!="danger" else .22,"story_motivation":phase}
    out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
