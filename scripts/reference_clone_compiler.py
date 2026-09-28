#!/usr/bin/env python3
import argparse, json
from pathlib import Path

ALLOWED_CHARACTERS={"dave","points_monk","cashback_goblin"}

def flow_for_window(ref,start,end):
    curve=((ref.get("optical_flow") or {}).get("camera_curve") or [])
    rows=[x for x in curve if start <= float(x.get("time",0)) < end]
    if not rows:
        return {"direction":"stable","speed":0.0}
    speed=sum(float(x.get("speed",0)) for x in rows)/len(rows)
    counts={}
    for x in rows:
        d=x.get("direction","stable");counts[d]=counts.get(d,0)+1
    direction=max(counts,key=counts.get)
    return {"direction":direction,"speed":round(speed,5)}

def compile_clone(ref, selected_characters):
    selected=[c for c in selected_characters if c in ALLOWED_CHARACTERS]
    if not selected:
        selected=["dave"]
    timeline=ref.get("shot_timeline") or []
    beats=[]
    for i,row in enumerate(timeline):
        start=float(row["start"]);end=float(row["end"]);flow=flow_for_window(ref,start,end)
        beats.append({
            "index":i,
            "start":start,
            "end":end,
            "shot_scale":row.get("shot_scale","medium"),
            "camera":row.get("camera","static"),
            "reference_character_action":row.get("character_action",""),
            "reference_prop_action":row.get("prop_action",""),
            "motion_activity":float(row.get("motion_activity",0) or 0),
            "reference_flow_direction":flow["direction"],
            "reference_flow_speed":flow["speed"],
            "state_change":bool(row.get("state_change")),
            "retention_reason":row.get("why_it_retains",""),
            "content_control_character":selected[i%len(selected)],
            "adaptation_rule":"preserve timing/camera/motion function; rebuild staging, props, spoken copy, and creator-specific identity"
        })
    duration=max((b["end"] for b in beats),default=float(ref.get("source",{}).get("duration_seconds",0) or 0))
    return {
        "schema_version":1,
        "mode":"reference_clone",
        "duration_seconds":duration,
        "source_reference_id":ref.get("source",{}).get("id"),
        "source_type":ref.get("source",{}).get("type"),
        "character_source":"control/character-bible-v1.json",
        "style_source":"control/style-dna-v3.json",
        "renderer":"remotion/CharacterSystem.jsx",
        "selected_characters":selected,
        "hook":ref.get("hook_first_second",{}),
        "motion_verbs":ref.get("motion_verbs",[]),
        "camera_verbs":ref.get("camera_verbs",[]),
        "comedy_engine":ref.get("comedy_engine"),
        "payoff_timestamp":ref.get("payoff_timestamp"),
        "audio_punctuation":ref.get("audio_punctuation",[]),
        "transferable_mechanics":ref.get("transferable_mechanics",[]),
        "visual_style_fingerprint":ref.get("visual_style_fingerprint",{}),
        "optical_flow_summary":ref.get("optical_flow",{}),
        "motion_summary":ref.get("motion_summary",{}),
        "beats":beats,
        "originality":{
            "reference_mechanics_only":True,
            "exact_reference_character_copy":False,
            "forbidden_creator_specific_elements":ref.get("distinctive_creator_elements_not_to_copy",[])
        },
        "publication_enabled":False
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference",required=True)
    ap.add_argument("--characters",default="dave,points_monk,cashback_goblin")
    ap.add_argument("--out",required=True)
    args=ap.parse_args()
    ref=json.loads(Path(args.reference).read_text())
    selected=[x.strip() for x in args.characters.split(",") if x.strip()]
    out=compile_clone(ref,selected)
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":"PASS","beats":len(out["beats"]),"duration_seconds":out["duration_seconds"],"characters":out["selected_characters"]},sort_keys=True))

if __name__=="__main__":
    main()
