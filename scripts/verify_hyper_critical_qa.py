#!/usr/bin/env python3
import json,pathlib
p=json.loads(pathlib.Path("control/hyper-critical-qa-director.json").read_text())
assert p["fail_closed"] is True
assert p["publication_enabled"] is False
assert p["personas"]["bored_scroller"]["attention_span_sec"] == 3
assert p["personas"]["bored_scroller"]["reject_if_static_gt_sec"] <= 3
assert set(["visual_coma","visual_collision","av_desync","flabby_hook"]) <= set(p["failure_codes"])
assert len(p["required_passes"])==3
assert p["rewrite_output"]=="valid JSON production block"
print('hyper-critical QA contract PASS')
