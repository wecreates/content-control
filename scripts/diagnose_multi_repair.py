#!/usr/bin/env python3
import argparse,copy,json
from pathlib import Path
CATS=["story","acting","camera","composition","clutter","timing","audio","identity","render"]
def diagnose(doc,story=None,spatial=None,candidate=None):
 rows=[]
 weak=set((story or {}).get("weak_scene_ids",[]));bad=set(x.get("scene_id") for x in (spatial or {}).get("rows",[]) if x.get("status")!="PASS")
 for s in doc.get("scenes",[]):
  causes=[]
  if s.get("id") in weak:causes.append("story")
  if s.get("id") in bad:causes.append("acting")
  if (s.get("attention_model") or {}).get("predicted_load",0)>.82:causes.append("clutter")
  if (s.get("novelty_control") or {}).get("force_variant"):causes.append("camera")
  if not (s.get("audio") or {}).get("music_architecture"):causes.append("audio")
  rows.append({"scene_id":s.get("id"),"causes":causes,"severity":len(causes)})
 return {"schema_version":1,"status":"PASS" if not any(x["causes"] for x in rows) else "REPAIR","scenes":rows,"publication_enabled":False}
def variants(doc,diag):
 outs=[]
 for mode in ["clarity","performance","editorial"]:
  d=copy.deepcopy(doc)
  bad={x["scene_id"]:x["causes"] for x in diag["scenes"] if x["causes"]}
  for s in d.get("scenes",[]):
   causes=bad.get(s.get("id"),[])
   if not causes:continue
   if mode=="clarity":s.setdefault("composition",{})["staging_strategy"]="clean_triangle";s["fx"]=(s.get("fx") or [])[:1]
   if mode=="performance":
    for ch in s.get("characters",[]):ch.setdefault("performance_engine",{})["candidate_scale"]=1.08;ch.setdefault("motion_engine",{})["anticipation_frames"]=6
   if mode=="editorial":s.setdefault("editorial",{}).update({"repair":"tighten","cut_trigger":"dialogue_turn","punchline_hold_frames":6})
  d["repair_variant"]=mode;d["publication_enabled"]=False;outs.append(d)
 return outs
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--story");ap.add_argument("--spatial");ap.add_argument("--diagnosis",required=True);ap.add_argument("--variants-dir",required=True);a=ap.parse_args()
 load=lambda p:json.loads(Path(p).read_text()) if p and Path(p).is_file() else {}
 doc=json.loads(Path(a.ccsd).read_text());dg=diagnose(doc,load(a.story),load(a.spatial));Path(a.diagnosis).write_text(json.dumps(dg,indent=2,sort_keys=True)+"\n");Path(a.variants_dir).mkdir(parents=True,exist_ok=True)
 for d in variants(doc,dg):Path(a.variants_dir,f"{d['repair_variant']}.json").write_text(json.dumps(d,indent=2,sort_keys=True)+"\n")
 print(json.dumps({"status":dg["status"],"variants":3}))
if __name__=="__main__":main()
