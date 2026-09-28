#!/usr/bin/env python3
import json,pathlib
v=json.loads(pathlib.Path("control/autonomous-viral-content-engine.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
b=json.loads(pathlib.Path("control/character-bible-v1.json").read_text())
d=json.loads(pathlib.Path("control/style-dna-v3.json").read_text())
c=json.loads(pathlib.Path("control/creative-director-v3.json").read_text())
r=json.loads(pathlib.Path("control/reference-decomposition-contract.json").read_text())
ids={a["id"] for a in s["agents"]}
assert {"autonomous_viral_content_engine","character_continuity_director","reference_decomposition_agent"} <= ids
assert v["publication_enabled"] is False
assert v["zero_overlap"]["required"] is True
assert v["entertainment"]["max_visual_hold_sec"] <= 1
assert v["entertainment"]["character_conflict_required"] is True
assert v["entertainment"]["physicalized_finance_required"] is True
assert v["entertainment"]["min_story_engines_considered"] >= 5
assert set(v["dual_pass_qa"])=={"bored_scroller","credit_card_nerd"}
assert v["handoff_order"][-1]=="release_guard"
assert v["character_system"]["continuity_required"] is True
assert pathlib.Path(v["character_system"]["bible"]).is_file()
assert pathlib.Path(v["character_system"]["renderer"]).is_file()
assert pathlib.Path(v["creative_director"]).is_file()
assert pathlib.Path(v["style_dna"]).is_file()
assert pathlib.Path(v["reference_decomposition_contract"]).is_file()
assert pathlib.Path(v["pre_render_gate"].split()[1]).is_file()
assert b["publication_enabled"] is False and d["publication_enabled"] is False and c["publication_enabled"] is False and r["publication_enabled"] is False
assert {"dave","points_monk","cashback_goblin"} <= set(b["characters"])
assert "slide lecture" in c["hard_failures"]
print("VCE creative-system contract PASS")
