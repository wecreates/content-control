#!/usr/bin/env python3
import argparse,json
from pathlib import Path
POSES={"dave":["recoil","wallet_clutch","frozen_mid_reach"],"points_monk":["deadpan_point","door_kick","calculator_drop"],"cashback_goblin":["coin_scamper","ankle_drag","card_hug"]}
def build(bp):
    chars=bp.get("selected_characters") or ["dave"]
    scenes=[]
    for i,b in enumerate(bp.get("beats",[])):
        ch=b.get("content_control_character") or chars[i%len(chars)]
        scenes.append({
          "index":i,"start":b["start"],"end":b["end"],"character":ch,
          "pose":POSES[ch][i%len(POSES[ch])],"camera":b.get("camera","tracking"),
          "shot_scale":b.get("shot_scale","medium"),"prop":"finance_prop_"+str(i%4),
          "text_zone":"upper_third","action_zone":"center","cta_zone":"lower_third",
          "state_change":True,"intentional_contact":False,"motion_intensity":float(b.get("motion_activity",0) or 0),
          "audio_events":[x for x in bp.get("audio_punctuation",[]) if b["start"]<=float(x.get("time",x.get("start",-1)))<b["end"]],
          "adaptation":"original staging using locked Content Control character"
        })
    return {"schema_version":1,"mode":"reference_clone_scene_plan","source_reference_id":bp.get("source_reference_id"),"duration_seconds":bp.get("duration_seconds"),"character_source":bp.get("character_source") or "control/character-bible-v1.json","renderer":"remotion/ReferenceCloneComposition.jsx","visual_style_fingerprint":bp.get("visual_style_fingerprint",{}),"scenes":scenes,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--blueprint",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    out=build(json.loads(Path(a.blueprint).read_text()));Path(a.out).write_text(json.dumps(out,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(out["scenes"])}))
if __name__=="__main__":main()
