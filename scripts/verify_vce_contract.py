#!/usr/bin/env python3
import json,pathlib
v=json.loads(pathlib.Path("control/autonomous-viral-content-engine.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
ids={a["id"] for a in s["agents"]}
assert "autonomous_viral_content_engine" in ids
assert v["publication_enabled"] is False
assert v["zero_overlap"]["required"] is True
assert v["entertainment"]["max_visual_hold_sec"] <= 2
assert v["entertainment"]["comment_bait_required"] is True
assert set(v["dual_pass_qa"])=={"bored_scroller","credit_card_nerd"}
assert v["handoff_order"][-1]=="release_guard"
print("VCE contract PASS")
