#!/usr/bin/env python3
import argparse,copy,json,math
from pathlib import Path

EMOTIONS={"dave":"anxious","points_monk":"deadpan","cashback_goblin":"mischievous"}
PHONEMES=["rest","MBP","FV","L","AI","E","O","U","WQ"]

def clamp(x,a=0,b=1): return max(a,min(b,x))
def scene_intent(s):
    story=s.get("story") or {}; txt=" ".join(str(story.get(k,"")) for k in ("beat","purpose","turn","payoff")).lower()
    if any(k in txt for k in ("reveal","payoff","win","reward")): return "reveal"
    if any(k in txt for k in ("danger","loss","trap","problem","conflict")): return "pressure"
    if any(k in txt for k in ("explain","learn","rule","how")): return "explain"
    return "setup"

def apply(ccsd):
    out=copy.deepcopy(ccsd); scenes=out.get("scenes",[])
    prop_state={}; char_state={}
    for i,s in enumerate(scenes):
        intent=scene_intent(s); dur=max(.1,float(s.get("end",0))-float(s.get("start",0)))
        story=s.setdefault("story",{}); story["intent"]=intent
        intensity=clamp(.25 + .55*(i/max(1,len(scenes)-1)) + (.15 if intent in ("pressure","reveal") else 0))
        # motivated cinematography, not round-robin presets
        cam=s.setdefault("camera",{})
        cam.update({
          "motivation":{"setup":"establish_goal","explain":"preserve_clarity","pressure":"compress_space","reveal":"reveal_consequence"}[intent],
          "shot_scale":{"setup":"medium_wide","explain":"medium","pressure":"close","reveal":"impact_close"}[intent],
          "move":{"setup":"settle_in","explain":"guided_track","pressure":"creeping_push","reveal":"snap_reveal"}[intent],
          "lens_equivalent_mm":{"setup":35,"explain":50,"pressure":70,"reveal":45}[intent],
          "eyeline_axis":"preserve_180_rule","reframe_trigger":"speaker_or_prop_attention_change",
          "depth_layers":3,"parallax_strength":round(.08+.16*intensity,3)
        })
        # performance + animation language
        for ci,ch in enumerate(s.get("characters",[])):
            cid=ch.get("id","dave"); base=EMOTIONS.get(cid,"neutral")
            previous=char_state.get(cid,base)
            emotion=("alarm" if intent=="pressure" and cid=="dave" else "delight" if intent=="reveal" and cid=="cashback_goblin" else base)
            ch["performance_engine"]={
              "emotion_curve":[{"t":0,"state":previous,"intensity":round(intensity*.65,2)},{"t":round(dur*.55,2),"state":emotion,"intensity":round(intensity,2)},{"t":dur,"state":emotion,"intensity":round(intensity*.8,2)}],
              "gaze_targets":["active_speaker","story_prop","reaction_partner"],"blink_policy":"thought_and_turn_boundaries",
              "gesture_family":{"dave":"protective_nervous","points_monk":"economical_precise","cashback_goblin":"springy_grabby"}.get(cid,"natural"),
              "pose_language":{"line_of_action":round(.15+.35*intensity,2),"asymmetry":round(.2+.45*intensity,2),"silhouette_priority":True},
              "reaction_delay_frames":3+ci*2,"micro_expression_frames":6,"breath_cycle_frames":72,
              "lip_sync":{"mode":"phoneme_viseme","visemes":PHONEMES,"coarticulation":True,"lead_frames":1},
              "secondary_motion":{"follow_through":True,"overlap":True,"settle_frames":8}
            }
            ch["motion_engine"]={"interpolation":"cubic_bezier","anticipation_frames":max(2,round(6*intensity)),"overshoot":round(.04+.08*intensity,3),"ease_in":.22,"ease_out":.68,"arc_motion":True,"weight": "light" if cid=="cashback_goblin" else "grounded","foot_lock":True,"contact_ik":True}
            char_state[cid]=emotion
        # props/environments are stateful actors
        for p in s.get("props",[]):
            pid=p.get("id","prop"); prev=prop_state.get(pid,"available")
            p["behavior"]={"state_in":prev,"state_out":"handled" if s.get("characters") else prev,"rig":"stateful_prop","collision":True,"secondary_motion":True,"attention_priority":intent in ("explain","reveal")}
            prop_state[pid]=p["behavior"]["state_out"]
        env=s.setdefault("environment",{})
        env["depth_system"]={"foreground":True,"midground":True,"background":True,"parallax":True,"occlusion":True,"interactive_props":True}
        # lighting/compositing/FX
        s["lighting"]={"motivation":intent,"key_direction":"story_focus","character_separation":True,"contact_shadows":True,"ambient_occlusion":True,"depth_falloff":True,"accent_energy":round(intensity,2)}
        fx=s.setdefault("fx",[])
        if intent in ("pressure","reveal"): fx.append({"type":"story_impact","particles":intent=="reveal","speed_lines":intent=="pressure","motion_blur":True,"duration_frames":8})
        s["compositing"]={"depth_sort":True,"contact_shadows":True,"motion_blur":True,"grade":"clean_high_key","focus_separation":True,"mobile_contrast_check":True}
        # audio performance + foley
        audio=s.setdefault("audio",{})
        audio["direction"]={"emotion":intent,"energy":round(intensity,2),"beat_sync":True,"dialogue_ducking":True,"room_acoustics":"scene_matched","spatial_mix":True,"master_target_lufs":-14}
        audio.setdefault("foley",[]).extend([{"event":"character_motion","sync_tolerance_ms":45},{"event":"prop_contact","sync_tolerance_ms":35}] if s.get("props") else [{"event":"character_motion","sync_tolerance_ms":45}])
        for d in audio.get("dialogue",[]):
            d.setdefault("performance",{}).update({"intent":intent,"emotion_strength":round(intensity,2),"breaths":"natural","pause_logic":"punctuation_and_thought","dynamic_emphasis":True})
        # continuity carries actual state
        s["continuity"]={"character_state":copy.deepcopy(char_state),"prop_state":copy.deepcopy(prop_state),"screen_axis":cam["eyeline_axis"],"unresolved_setup":story.get("setup"),"emotional_intent":intent}
        # creative search: three genuinely different staging candidates
        s["creative_candidates"]=[
          {"id":"clarity","camera":"medium","staging":"clean_triangle","performance_scale":.8,"edit_bias":"readable"},
          {"id":"energy","camera":"dynamic_close","staging":"diagonal_depth","performance_scale":1.15,"edit_bias":"fast"},
          {"id":"comedy","camera":"reaction_first","staging":"misdirection_reveal","performance_scale":1.3,"edit_bias":"hold_then_snap"}
        ]
        s["candidate_selection"]={"objective":["story_clarity","character_readability","retention","style_fit"],"winner":"auto_at_dailies","rollback_on_regression":True}
    out["creative_depth_engine"]={"version":1,"performance":True,"animation":True,"cinematography":True,"stateful_assets":True,"fx":True,"audio_direction":True,"continuity":True,"candidate_search":True}
    out["publication_enabled"]=False
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--ccsd",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=apply(json.loads(Path(a.ccsd).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","scenes":len(r.get("scenes",[]))}))
if __name__=="__main__": main()
