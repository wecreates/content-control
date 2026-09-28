#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def summarize_motion(samples):
    vals=[float(x.get("activity",0)) for x in samples]
    if not vals:return {"mean_activity":0,"peak_activity":0,"energy_curve":[]}
    return {"mean_activity":round(sum(vals)/len(vals),6),"peak_activity":round(max(vals),6),"energy_curve":[round(v,5) for v in vals],"bursts":[i for i,v in enumerate(vals) if v>sum(vals)/len(vals)*1.5]}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--reference",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();d=json.loads(Path(a.reference).read_text());r=summarize_motion(d.get("motion_curve",[]));r["schema_version"]=2;r["publication_enabled"]=False;Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
