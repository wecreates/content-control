#!/usr/bin/env python3
import json, sys
from pathlib import Path

MAX_BEAT_SECONDS=2.0
ALLOWED_CAMERAS={"punch_in","snap_wide","whip_pan","impact_close","tracking","handheld","crash_zoom","orbit","push_in","pull_out"}

def validate_blueprint(bp):
    beats=bp.get("beats",[])
    checks={}
    checks["hook_action_first"]=bool(bp.get("hook",{}).get("starts_with_action")) and float(bp.get("hook",{}).get("seconds_to_conflict",99))<=1.0
    checks["character_driven"]=len(bp.get("characters",[]))>=1 and all(c.get("signature_pose") for c in bp.get("characters",[]))
    checks["beat_duration"]=bool(beats) and all(float(b.get("end",0))-float(b.get("start",0))<=MAX_BEAT_SECONDS for b in beats)
    checks["state_change_each_beat"]=bool(beats) and all(bool(b.get("state_change")) for b in beats)
    checks["camera_motion_each_beat"]=bool(beats) and all(b.get("camera") in ALLOWED_CAMERAS for b in beats)
    checks["visual_payoff_density"]=bool(beats) and sum(bool(b.get("visual_payoff")) for b in beats)/len(beats)>=0.75
    checks["white_black_core"]=bp.get("style",{}).get("background")=="#FFFFFF" and bp.get("style",{}).get("line_art")=="#111111"
    checks["limited_accents"]=int(bp.get("style",{}).get("max_simultaneous_accents",99))<=3
    checks["cut_after_payoff"]=bool(bp.get("ending",{}).get("cut_after_payoff"))
    checks["lesson_recalled"]=bool(bp.get("ending",{}).get("rule_recalled"))
    originality=bp.get("originality",{})
    checks["original_character_identity"]=originality.get("exact_reference_character_copy") is False
    checks["reference_mechanics_only"]=originality.get("reference_mechanics_only") is True
    failed=[k for k,v in checks.items() if not v]
    return {"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed}

def main():
    if len(sys.argv)!=2:
        print("usage: validate_creative_blueprint.py BLUEPRINT.json",file=sys.stderr)
        return 2
    bp=json.loads(Path(sys.argv[1]).read_text())
    result=validate_blueprint(bp)
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if result["status"]=="PASS" else 1

if __name__=="__main__":
    raise SystemExit(main())
