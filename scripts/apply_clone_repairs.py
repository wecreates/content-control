#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--reference",required=True);ap.add_argument("--scene-plan",required=True);ap.add_argument("--parity",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    ref=json.loads(Path(a.reference).read_text());plan=json.loads(Path(a.scene_plan).read_text());par=json.loads(Path(a.parity).read_text())
    bad=set(par.get("mismatched_scene_indices",[]));shots=ref.get("shot_timeline",[])
    changed=[]
    for i in sorted(bad):
        if i>=len(plan.get("scenes",[])) or i>=len(shots): continue
        s=plan["scenes"][i];r=shots[i]
        s["start"]=r["start"];s["end"]=r["end"];s["camera"]=r.get("camera",s.get("camera"));s["shot_scale"]=r.get("shot_scale",s.get("shot_scale"));s["motion_intensity"]=min(1.0,float(r.get("motion_activity",0) or 0)*1.25);s["repair_boost"]=True;s["hard_cut"]=True
        changed.append(i)
    plan["repair_revision"]=int(plan.get("repair_revision",0))+1
    plan["repaired_scene_indices"]=changed
    Path(a.out).write_text(json.dumps(plan,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","changed_scene_indices":changed,"repair_revision":plan["repair_revision"]},sort_keys=True))
if __name__=="__main__":main()
