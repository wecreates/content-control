#!/usr/bin/env python3
import argparse,copy,json,math
from pathlib import Path
LANDMARKS={"dave":{"head_body":.295,"shoulder":.54},"points_monk":{"head_body":.25,"shoulder":.46},"cashback_goblin":{"head_body":.42,"shoulder":.62}}
def apply(doc):
 out=copy.deepcopy(doc);prev_env=None;prev_move=None
 for i,s in enumerate(out.get("scenes",[])):
  dur=max(.1,float(s.get("end",0))-float(s.get("start",0)));intent=(s.get("story") or {}).get("intent","setup")
  for ch in s.get("characters",[]):
   cid=ch.get("id","dave");pe=ch.setdefault("performance_engine",{});me=ch.setdefault("motion_engine",{})
   pe.update({"eye_engine":{"saccade_frames":[5,17],"fixation_min_frames":8,"anticipation_look":True,"eyeline_match":True},"expression_blend":{"interpolation":"cubic","asymmetry":.12,"squash_stretch":True},"audio_driven":True})
   me.update({"ground_solver":{"foot_pin":True,"com_correction":True,"slide_tolerance_px":2},"pose_solver":{"source":"intent_emotion","joint_limits":True,"silhouette_optimize":True},"secondary_solver":{"head_lag":.08,"limb_overlap":.12,"prop_follow":.1}})
   ch["landmark_lock"]=LANDMARKS.get(cid,LANDMARKS["dave"])
  for p in s.get("props",[]):
   p.setdefault("state_machine",{}).update({"hand_solver":{"acquire":True,"maintain_attach":True,"release":True,"inherit_velocity":True},"physics":{"mass":1,"gravity":True,"collision":True}})
  s["depth_compositor"]={"z_layers":["background","midground","action","foreground","overlay"],"occlusion":True,"parallax":True,"contact_shadows":True,"focus_hierarchy":True}
  s["camera_blocking_solver"]={"safe_margin":.08,"prevent_clipping":True,"reposition_for_scale":True,"preserve_eyeline":True}
  s["render_qa_targets"]={"saliency_target":"story_prop" if s.get("props") else "active_character","overlap_check":True,"pose_check":True,"smoothness_check":True}
  s["shot_tournament"]={"variants":5,"dimensions":["staging","camera","acting","timing","metaphor"],"render_required":True}
  s["repair_tournament"]={"compare_original":True,"variants":3,"accept_only_if_improved":True}
  audio=s.setdefault("audio",{});audio["stem_engine"]={"rhythm":True,"pulse":True,"melody":True,"texture":True,"stings":True,"event_reactive":True}
  for d in audio.get("dialogue",[]):d["voice_tournament"]={"takes":3,"render_required":True,"emotion_sync":True,"audio_drives_face":True}
  s["comedy_optimizer"]={"timing_variants_frames":[-4,0,4,8],"select_from_render":True}
  env=(s.get("environment") or {}).get("id");move=(s.get("camera") or {}).get("move")
  s["fatigue_features"]={"environment_repeat":env==prev_env,"camera_repeat":move==prev_move,"pace_bucket":"fast" if dur<1.8 else "medium" if dur<3 else "slow"}
  s["retention_risk"]={"risk":round(min(1,.25+(dur>3)*.2+(env==prev_env)*.18+(move==prev_move)*.18),2),"localize_seconds":True}
  s["metaphor_search"]={"candidates":4,"selection":["instant_comprehension","visuality","novelty"]}
  s["style_drift"]={"check_landmarks":True,"check_line_weight":True,"check_palette":True,"check_motion_grammar":True}
  prev_env,prev_move=env,move
 out["reference_dna_v4"]={"velocity_curves":True,"zoom_acceleration":True,"text_trajectories":True,"silence_timing":True,"density_curve":True,"reaction_delay_curve":True,"multi_reference":True}
 out["episode_memory_graph"]={"entities":["characters","locations","props","jokes","concepts","open_loops"],"cross_episode":True,"lore_enabled":True}
 out["audience_v3"]={"segments":["finance_beginner","enthusiast","comedy_first","silent_mobile","impatient_scroller"],"second_level_confusion":True,"retention_curve":True}
 out["gold_master_memory"]={"positive_scenes":True,"negative_scenes":True,"failure_reason_required":True,"asset_quality_ranking":True}
 out["quality_accounting"]={"before_after_required":True,"discard_non_improving_repairs":True,"scene_best_ledger":True}
 out["renderer_determinism"]={"seeded":True,"approved_scene_reproducible":True}
 out["final_tribunal"]={"judges":["story","animation","cinematography","sound","character","factual","bored_viewer"],"technical_unanimous":True,"creative_consensus":True}
 out["publication_enabled"]=False;return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__":main()
