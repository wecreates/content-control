#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def map_feedback(ccsd,analytics):
    scenes=ccsd.get("scenes",[]);points=[]
    for p in analytics.get("retention_points",[]):
        t=float(p["time"]);s=next((x for x in scenes if float(x["start"])<=t<float(x["end"])),None)
        if s: points.append({"time":t,"retention":p.get("retention"),"scene_id":s["id"],"camera":s.get("camera"),"characters":[x.get("id") for x in s.get("characters",[])],"story":s.get("story")})
    dips=[x for x in points if float(x.get("retention",1) or 1)<.55]
    return {"schema_version":1,"mapped_points":points,"retention_dips":dips,"learning_rules":[{"scene_id":x["scene_id"],"rule":"avoid or repair similar configuration"} for x in dips],"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--analytics",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=map_feedback(json.loads(Path(a.ccsd).read_text()),json.loads(Path(a.analytics).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","mapped":len(r["mapped_points"]),"dips":len(r["retention_dips"])}))
if __name__=="__main__":main()
