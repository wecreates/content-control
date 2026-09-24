#!/usr/bin/env python3
import json, pathlib
sw=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
ct=json.loads(pathlib.Path("control/cco-production-contract.json").read_text())
ids={a["id"] for a in sw["agents"]}
required=set(ct["required_agents"])
assert required <= ids, (required-ids)
assert sw["publication_enabled"] is False
assert sw["cco"]["first_video_publish"] is False
assert ct["publication_enabled"] is False and ct["first_video_publish"] is False
assert ct["formats"]["shorts"]["canvas"] == [1080,1920]
assert ct["formats"]["long_form"]["canvas"] == [1920,1080]
assert ct["layout"]["anti_overlap"] is True
assert ct["retention"]["pattern_interrupt_max_sec"] <= 5
assert "timeline_blueprint" in ct["output_schema"]
print(json.dumps({"status":"PASS","agents":len(ids),"required_cco_agents":sorted(required),"publication_enabled":False}))
