#!/usr/bin/env python3
import argparse,copy,json
from pathlib import Path
def apply(doc,story=None,spatial=None):
 out=copy.deepcopy(doc);weak=set((story or {}).get("weak_scene_ids",[]));bad=set(x.get("scene_id") for x in (spatial or {}).get("rows",[]) if x.get("status")!="PASS")
 for s in out.get("scenes",[]):
  if s.get("id") in weak:
   s.setdefault("editorial",{})["repair"]="tighten_and_clarify";s.setdefault("camera",{})["move"]="guided_track";s.setdefault("composition",{})["staging_strategy"]="clean_triangle";s.setdefault("story",{})["repair_note"]="one idea, visible consequence, explicit payoff"
  if s.get("id") in bad:
   for ch in s.get("characters",[]):ch.setdefault("motion_engine",{}).update({"foot_lock":True,"contact_ik":True});ch.setdefault("performance_engine",{}).setdefault("gaze_track",[{"frame":0,"target":"active_speaker"},{"frame":12,"target":"story_prop"}])
 out["repair_applied"]=bool(weak or bad);out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--story");ap.add_argument("--spatial");ap.add_argument("--out",required=True);a=ap.parse_args()
 load=lambda p: json.loads(Path(p).read_text()) if p and Path(p).is_file() else {}
 r=apply(json.loads(Path(a.ccsd).read_text()),load(a.story),load(a.spatial));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","repair":r["repair_applied"]}))
if __name__=="__main__":main()
