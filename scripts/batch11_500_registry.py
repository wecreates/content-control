#!/usr/bin/env python3
import argparse,json
from pathlib import Path
GROUPS=[
("character_acting_v4",25),("facial_animation_v4",25),("body_mechanics_v4",25),("character_interaction_v4",25),("advanced_prop_sim",25),
("camera_intelligence_v4",25),("editing_intelligence_v4",25),("composition_intelligence_v4",25),("lighting_color_v4",25),("typography_v4",25),
("motion_graphics_v3",25),("sound_design_v4",25),("music_director_v4",25),("voice_director_v4",25),("story_search_v4",25),
("audience_modeling_v4",25),("learning_memory_v4",25),("autonomous_experimentation",25),("production_intelligence_v5",25),("studio_acceptance_v5",25)]
def build():
 rows=[];n=2001
 for group,count in GROUPS:
  for i in range(1,count+1):
   rows.append({"id":n,"capability":f"{group}_{i:02d}","group":group,"state":"INSTALLED","target_state":"RENDER_PROVEN","evidence_required":True,"publication_enabled":False});n+=1
 assert len(rows)==500 and rows[0]["id"]==2001 and rows[-1]["id"]==2500 and n==2501
 return {"schema_version":1,"batch":11,"range":[2001,2500],"endpoint_assertion":2500,"total":500,"lifecycle":["MISSING","IMPLEMENTED","INTEGRATED","TESTED","RENDER_PROVEN"],"capabilities":rows,"publication_enabled":False}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--out",required=True);a=ap.parse_args();r=build();Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","first":r["capabilities"][0]["id"],"last":r["capabilities"][-1]["id"],"total":r["total"]}))
if __name__=="__main__":main()
