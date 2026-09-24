#!/usr/bin/env python3
import json,pathlib
c=json.loads(pathlib.Path("control/cinematic-director.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
assert "cinematic_director_lighting_engineer" in {a["id"] for a in s["agents"]}
assert c["publication_enabled"] is False
assert c["thumbnail_parity"]["required"] is True
assert c["camera_matrix"]["required_every_scene"] is True
assert c["lighting"]["required_every_scene"] is True
assert c["audio"]["environmental_bed_required"] is True
assert c["audio"]["foley_required"] is True
assert c["audio"]["voice_music_sfx_separate_tracks"] is True
print("cinematic director contract PASS")
