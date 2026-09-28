#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build(plan,project_id):
    scenes=[]
    for s in plan.get("scenes",[]):
        scenes.append({"id":f"scene-{s.get('index',len(scenes)):03d}","start":s["start"],"end":s["end"],"story":{"beat":s.get("adaptation","reference adaptation"),"purpose":"entertainment-first education"},"camera":{"shot_scale":s.get("shot_scale","medium"),"move":s.get("camera","tracking"),"screen_direction":"ltr"},"characters":[{"id":s.get("character","dave"),"pose":s.get("pose","recoil"),"emotion":"active"}],"environment":{"id":"white_stage"},"props":[{"id":s.get("prop","finance_prop"),"state":"active"}],"lighting":{"key":"soft","fill":"minimal","rim":"none"},"audio":{"dialogue":[],"sfx":s.get("audio_events",[]),"music":{"energy":.5}},"text":{"zone":s.get("text_zone","upper_third"),"content":""},"fx":[],"continuity":{"callbacks":[],"source_reference_id":plan.get("source_reference_id")},
          "reference_mechanics":{"character_action":s.get("reference_character_action",""),"prop_action":s.get("reference_prop_action",""),"retention_reason":s.get("reference_retention_reason",""),"motion_intensity":s.get("motion_intensity",0),"flow_direction":s.get("reference_flow_direction","stable"),"flow_speed":s.get("reference_flow_speed",0),"structure":s.get("reference_structure",{})}})
    return {"schema_version":1,"project_id":project_id,"source_reference_id":plan.get("source_reference_id"),"scenes":scenes,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--scene-plan",required=True);ap.add_argument("--project-id",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(json.loads(Path(a.scene_plan).read_text()),a.project_id);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r["scenes"])}))
if __name__=="__main__":main()
