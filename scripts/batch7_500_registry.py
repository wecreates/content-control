#!/usr/bin/env python3
import argparse,json
from pathlib import Path
GROUPS=[
("character_renderer",40),("procedural_animation",40),("physical_props",35),("cinematography",35),("composition_sets_depth",35),
("typography_graphics",30),("fx_finishing",30),("voice_dialogue",35),("foley_ambience",30),("music",25),
("story_comedy_retention",40),("reference_style",35),("rendered_qa",40),("repair_learning",30),("reliability_acceptance",20)]
def build():
 rows=[];n=1
 for group,count in GROUPS:
  for i in range(1,count+1):
   rows.append({"id":n,"capability":f"{group}_{i:02d}","group":group,"state":"INSTALLED","target_state":"RENDER_PROVEN","evidence_required":True,"publication_enabled":False});n+=1
 assert len(rows)==500 and len({x["id"] for x in rows})==500
 return {"schema_version":1,"batch":7,"name":"500-capability production upgrade","total":500,"lifecycle":["MISSING","IMPLEMENTED","INTEGRATED","TESTED","RENDER_PROVEN"],"capabilities":rows,"publication_enabled":False}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--out",required=True);a=ap.parse_args();r=build();Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","total":r["total"]}))
if __name__=="__main__":main()
