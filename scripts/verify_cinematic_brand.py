#!/usr/bin/env python3
import json,pathlib
c=json.loads(pathlib.Path("control/cinematic-brand-contract.json").read_text())
s=json.loads(pathlib.Path("control/agent-swarm.json").read_text())
ids={a["id"] for a in s["agents"]}
assert {"brand_asset_coordinator","cinematic_director_lighting_engineer"} <= ids
assert c["publication_enabled"] is False
assert c["thumbnail_parity"]["required"]
assert c["logo_head_protocol"]["generic_circle_heads_for_brand_fighters"] is False
assert c["cinematic_scene_requirements"]["camera_matrix_required"]
assert c["cinematic_scene_requirements"]["lighting_vectors_required"]
assert set(c["cinematic_scene_requirements"]["audio_tracks_required"])=={"narration","environment_bed","foley_sfx","music"}
print("cinematic brand contract PASS")
