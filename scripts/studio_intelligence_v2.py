#!/usr/bin/env python3
import argparse,copy,json,math
from pathlib import Path
CHAR_SIG={
"dave":{"movement":"protective_nervous","reaction":5,"gesture":"guard_then_reach"},
"points_monk":{"movement":"economical_precise","reaction":2,"gesture":"minimal_point"},
"cashback_goblin":{"movement":"springy_grabby","reaction":1,"gesture":"snatch_and_present"}}
def clamp(x,a=0,b=1):return max(a,min(b,x))
def apply(doc):
 out=copy.deepcopy(doc);prop_state={};callbacks=[];used=[]
 for i,s in enumerate(out.get("scenes",[])):
  dur=max(.1,float(s.get("end",0))-float(s.get("start",0)));story=s.setdefault("story",{});intent=story.get("intent","setup")
  dialogue=" ".join(d.get("text","") for d in (s.get("audio") or {}).get("dialogue",[]));words=len(dialogue.split())
  visual_load=len(s.get("characters",[]))+len(s.get("props",[]))+len(s.get("fx",[]))+bool((s.get("text") or {}).get("content"))
  load=clamp(words/max(1,dur)/5*.55+visual_load/7*.45)
  s["attention_model"]={"primary":"story_prop" if s.get("props") else "active_speaker","secondary":"reaction_character","max_competing_foci":2,"predicted_load":round(load,3),"simplify":load>.82}
  if load>.82:s["text"]["content"]="" if isinstance(s.get("text"),dict) else None;s["fx"]=(s.get("fx") or [])[:1]
  ed=s.setdefault("editorial",{});ed.update({"cut_trigger":"motion_completion_or_dialogue_turn","punchline_hold_frames":8 if intent=="reveal" else 0,"music_cut_sync":True,"eye_trace_match":True})
  for ch in s.get("characters",[]):
   sig=CHAR_SIG.get(ch.get("id"),{"movement":"natural","reaction":3,"gesture":"natural"})
   ch["acting_memory"]=sig
   ch.setdefault("motion_engine",{}).update({"center_of_mass":True,"planted_feet":True,"shoulder_hip_counter_rotation":True,"pose_to_pose":True,"overlap_action":True})
   ch.setdefault("performance_engine",{})["expression_interpolation"]="asymmetric_spline"
  for p in s.get("props",[]):
   pid=p.get("id","prop");prev=prop_state.get(pid,{"owner":None,"state":"available","orientation":0})
   owner=(s.get("characters") or [{}])[0].get("id") if s.get("characters") else prev["owner"]
   cur={"owner":owner,"state":"held" if owner else prev["state"],"orientation":prev["orientation"],"visible":True,"damaged":False}
   p["state_machine"]={"in":prev,"out":cur,"grasp_release":True,"rigid_body":True};prop_state[pid]=cur
  env=s.setdefault("environment",{});env["set_memory"]={"canonical_id":env.get("id","white_stage"),"geometry_lock":True,"zones":["foreground","action","background"],"recurring_set":True}
  if story.get("setup"):callbacks.append({"seed_scene":s.get("id"),"seed":story["setup"]})
  if intent=="reveal" and callbacks: s.setdefault("continuity",{})["visual_callback"]=callbacks[-1]
  grammar=(s.get("camera") or {}).get("move","static");used.append(grammar)
  s["novelty_control"]={"recent_camera_moves":used[-5:],"repeat_penalty":round(max(0,(used[-5:].count(grammar)-1)*.18),2),"force_variant":used[-5:].count(grammar)>2}
  s["shot_candidates"]=[{"id":f"{s.get('id')}-v{k}","performance_scale":v,"camera_variant":m,"repairable":True} for k,(v,m) in enumerate([(0.85,"clarity"),(1.0,"balanced"),(1.2,"energy"),(1.3,"comedy")],1)]
  s.setdefault("audio",{})["music_architecture"]={"section":intent,"motif":"episode_core","stems":["pulse","melody","texture"],"build":intent=="pressure","drop":intent=="reveal","callback":i>3,"punchline_silence":intent=="reveal"}
  for d in (s.get("audio") or {}).get("dialogue",[]):d["take_search"]={"takes":3,"dimensions":["emotion","pace","emphasis"],"selection":["transcription","timing","naturalness"]}
 out["macro_retention"]={"open_loops":callbacks,"chapter_resets_seconds":60,"escalation_required":True,"callback_required":True,"payoff_before_end":True}
 out["packaging_promise_gate"]={"hook_delivery_seconds":15,"require_title_promise_in_opening":True,"require_thumbnail_object_or_consequence":True}
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
