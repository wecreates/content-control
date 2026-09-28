#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def apply(ccsd):
    out=json.loads(json.dumps(ccsd));out["finishing"]={"white_point":"D65","target_luma":.94,"max_accent_saturation":.85,"contrast_floor":4.5,"platform_safe_levels":True,"compression_preview_required":True,"mobile_legibility_required":True};out["publication_enabled"]=False;return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
