#!/usr/bin/env python3
import argparse,json
from pathlib import Path

REQUIRED_REF={"source","hook_first_second","shot_timeline","motion_verbs","camera_verbs","comedy_engine","payoff_timestamp","audio_punctuation","transferable_mechanics","distinctive_creator_elements_not_to_copy"}

def validate_reference(ref):
    checks={}
    checks["required_fields"]=REQUIRED_REF <= set(ref)
    source=ref.get("source") or {}
    checks["source_identity"]=bool(source.get("id")) and bool(source.get("type")) and float(source.get("duration_seconds",0) or 0)>0
    shots=ref.get("shot_timeline") or []
    checks["shots_present"]=len(shots)>=2
    checks["shots_ordered"]=all(float(s.get("end",0))>float(s.get("start",0)) for s in shots)
    checks["timeline_monotonic"]=all(float(shots[i]["start"])>=float(shots[i-1]["end"])-0.05 for i in range(1,len(shots))) if shots else False
    checks["state_changes_measured"]=all("state_change" in s for s in shots)
    checks["camera_measured"]=all(bool(s.get("camera")) and bool(s.get("shot_scale")) for s in shots)
    checks["originality_boundary"]=isinstance(ref.get("distinctive_creator_elements_not_to_copy"),list)
    failed=[k for k,v in checks.items() if not v]
    return {"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}

def validate_clone(clone):
    checks={}
    beats=clone.get("beats") or []
    checks["character_lock"]=clone.get("character_source")=="control/character-bible-v1.json" and clone.get("renderer")=="remotion/CharacterSystem.jsx"
    checks["style_lock"]=clone.get("style_source")=="control/style-dna-v3.json"
    checks["beats_present"]=len(beats)>=2
    checks["characters_valid"]=all(x in {"dave","points_monk","cashback_goblin"} for x in clone.get("selected_characters",[]))
    checks["timing_present"]=all(float(b.get("end",0))>float(b.get("start",0)) for b in beats)
    o=clone.get("originality") or {}
    checks["no_exact_character_copy"]=o.get("exact_reference_character_copy") is False
    checks["mechanics_only"]=o.get("reference_mechanics_only") is True
    checks["publication_disabled"]=clone.get("publication_enabled") is False
    failed=[k for k,v in checks.items() if not v]
    return {"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference")
    ap.add_argument("--clone")
    args=ap.parse_args()
    if bool(args.reference)==bool(args.clone):
        raise SystemExit("provide exactly one of --reference or --clone")
    obj=json.loads(Path(args.reference or args.clone).read_text())
    result=validate_reference(obj) if args.reference else validate_clone(obj)
    print(json.dumps(result,indent=2,sort_keys=True))
    raise SystemExit(0 if result["status"]=="PASS" else 2)

if __name__=="__main__":
    main()
