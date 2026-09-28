#!/usr/bin/env python3
import argparse,json
from pathlib import Path
BASE_DEPS=["story","board","environment","props","rig","dialogue_timing","camera"]
def schedule(ccsd):
    shots=[]
    for i,s in enumerate(ccsd.get("scenes",[])):
        deps=list(BASE_DEPS)
        if (s.get("choreography") or {}).get("contact_events"): deps+=["contact_physics"]
        if s.get("crowd",{}).get("enabled"): deps+=["crowd"]
        if (s.get("audio") or {}).get("dialogue"): deps+=["voice"]
        shots.append({
          "scene_id":s.get("id"),"priority":100-i if float(s.get("start",0))<5 else 50-i,
          "dependencies":deps,"ready_when":{d:False for d in deps},
          "parallel_group":i%4,"render_scope":"scene","repair_scope":"scene"
        })
    return {"schema_version":1,"shots":shots,"critical_path":["story","board","rig","dialogue_timing","animation","qa"],"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=schedule(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","shots":len(r["shots"])}))
if __name__=="__main__":main()
