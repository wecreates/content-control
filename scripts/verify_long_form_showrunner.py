#!/usr/bin/env python3
import json,pathlib
l=json.loads(pathlib.Path("control/long-form-showrunner.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
ids={a["id"] for a in s["agents"]}
assert "long_form_showrunner" in ids
assert l["minimum_runtime_sec"] >= 510
assert l["act_max_without_structural_pivot_sec"] <= 60
assert len(l["acts"]) == 5
assert l["visual"]["native_canvas"] == "16:9"
assert l["visual"]["anti_overlap"]
assert l["publication_enabled"] is False
assert l["audio"]["narration_sfx_music_separate"]
print("long-form showrunner contract PASS")
