#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path
STAGES=["story","board","animatic","layout","animation","lighting","sound","qa","final"]
def build(ccsd):
    shots=[]
    for s in ccsd.get("scenes",[]):
        shots.append({"scene_id":s["id"],"status":"story","allowed_statuses":STAGES,"owner":"autonomous_cco","blockers":[],"estimated_cost_credits":0,"render_priority":"high" if float(s["start"])<5 else "normal"})
    return {"schema_version":1,"shots":shots,"counts":dict(Counter(x["status"] for x in shots)),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","shots":len(r["shots"])}))
if __name__=="__main__":main()
