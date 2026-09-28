#!/usr/bin/env python3
import html,json,re
from pathlib import Path

ROOT=Path(".")
contract=json.loads((ROOT/"state/episode1-sync-contract.json").read_text())
source=html.unescape((ROOT/"remotion/V9ArticulatedVisual.jsx").read_text())
factual=json.loads((ROOT/"state/episode1-factual-contract.json").read_text())
narration=factual.get("narration_text","")

checks={}
m=re.search(r"const cuts=\[([^\]]+)\];",source)
if not m:
    raise SystemExit("cuts array not found")
cuts=[float(x.strip()) for x in m.group(1).split(",") if x.strip()]
expected=[float(x) for x in contract["cuts"]]
checks["cuts_match_contract"]=cuts==expected
checks["starts_at_zero"]=bool(cuts) and cuts[0]==0
checks["ends_at_duration"]=bool(cuts) and abs(cuts[-1]-float(contract["duration_seconds"]))<1e-9
durations=[b-a for a,b in zip(cuts,cuts[1:])]
checks["scene_count_matches"]=len(durations)==int(contract["expected_scene_count"])
checks["max_scene_duration_ok"]=bool(durations) and max(durations)<=float(contract["max_scene_duration_seconds"])+1e-9
checks["positive_scene_durations"]=all(x>0 for x in durations)

pos=-1
scene_positions=[]
for phrase in contract["ordered_scene_headlines"]:
    p=source.find(phrase,pos+1)
    scene_positions.append({"phrase":phrase,"position":p})
    if p<0: break
    pos=p
checks["scene_headlines_present_and_ordered"]=all(x["position"]>=0 for x in scene_positions) and all(
    scene_positions[i]["position"]<scene_positions[i+1]["position"] for i in range(len(scene_positions)-1)
)

checks["required_visual_tokens_present"]=all(tok in source for tok in contract["required_visual_tokens"])

nlow=narration.lower()
npos=-1
narr_positions=[]
for phrase in contract["narration_semantic_order"]:
    p=nlow.find(phrase.lower(),npos+1)
    narr_positions.append({"phrase":phrase,"position":p})
    if p<0: break
    npos=p
checks["narration_semantics_present_and_ordered"]=all(x["position"]>=0 for x in narr_positions) and all(
    narr_positions[i]["position"]<narr_positions[i+1]["position"] for i in range(len(narr_positions)-1)
)

checks["no_fullscreen_slide_marker"]=all(x not in source.lower() for x in ["fullscreen slide","lecture slide","slide deck"])
checks["finance_math_visible"]="$80 − $20" in source and "$60" in source
checks["final_rule_visible"]="REAL VALUE > FEE" in source
checks["publication_disabled"]=contract.get("publication_enabled") is False

status="PASS" if all(checks.values()) else "FAIL"
report={
    "schema_version":1,
    "status":status,
    "scene_count":len(durations),
    "scene_durations_seconds":durations,
    "max_scene_duration_seconds":max(durations) if durations else None,
    "checks":checks,
    "scene_positions":scene_positions,
    "narration_positions":narr_positions,
    "failed_checks":[k for k,v in checks.items() if not v],
    "publication_enabled":False,
}
(ROOT/"state/sync-retention-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
