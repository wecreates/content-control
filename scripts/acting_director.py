#!/usr/bin/env python3
import argparse,json
from pathlib import Path
PERF={
 "dave":{"posture":"forward_anxious","gaze":"prop_then_monk","micro":["blink","swallow","side_eye"],"weight_shift":"unstable"},
 "points_monk":{"posture":"upright_still","gaze":"dave_then_camera","micro":["single_brow","micro_smirk"],"weight_shift":"minimal"},
 "cashback_goblin":{"posture":"compressed_spring","gaze":"reward_target","micro":["coin_eyes","grin"],"weight_shift":"rapid"}
}
def apply(ccsd):
 out=json.loads(json.dumps(ccsd))
 for s in out.get("scenes",[]):
  contacts=(s.get("choreography") or {}).get("contact_events",[])
  for ch in s.get("characters",[]):
   cid=ch.get("id","dave");base=PERF.get(cid,PERF["dave"])
   ch["acting"]={**base,"anticipation_frames":5 if cid=="dave" else 2,"thought_hold_frames":4 if cid=="points_monk" else 2,"contact_driven":any(x.get("actor")==cid for x in contacts),"hand_targets":[x.get("target") for x in contacts if x.get("actor")==cid]}
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS"}))
if __name__=="__main__":main()
