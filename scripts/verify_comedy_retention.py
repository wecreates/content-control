#!/usr/bin/env python3
import json,pathlib
c=json.loads(pathlib.Path("control/comedy-retention-engineer.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
ids={a["id"] for a in s["agents"]}
assert "lead_comedy_retention_engineer" in ids
assert c["publication_enabled"] is False
assert c["retention"]["max_single_visual_sec"] <= 2
assert c["retention"]["pattern_interrupt_required_every_sec"] <= 2
assert len(c["required_devices"]) == 4
assert c["audio"]["sfx_separate_from_voiceover"]
assert c["audio"]["narration_must_not_read_sfx"]
assert c["factuality"]["unsupported_claims_rejected"]
print("comedy retention contract PASS")
