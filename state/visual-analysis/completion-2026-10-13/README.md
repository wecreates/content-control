# Final corrected V2 evidence

Candidate SHA-256: `896006c7af0571fa98f2f17e22aafa7030a424c9c47f2f85d130c7173f181edf`.
Source: `e9fb2d8711f0b3a3aca5787ebcf06e367382aadd`; hosted build: [38473857671](https://github.com/wecreates/content-control/actions/runs/38473857671).

The actual video contains 840 decoded frames at 24fps (35.0 seconds); the container lasts 35.041 seconds. The pre-mux caption lattice has 841 frames. Independent verification confirms all 68 cues and 71 words occur in the actual 840-frame video. All 204 caption animation geometry samples pass. Eight hosted technical checks pass; 38 focused Node tests and 17 Python evidence/reconciliation tests pass.

The independently reviewed 15-frame sample passes typography, character scale, staging, board consistency and 360px raster readability. Full-resolution ending frames verify the sandwich is visible. `superseded-occlusion-fail.json` records the rejected previous candidate and must never approve this or any other video. Comparison and motion reports are newly calculated from the exact candidate; historical semantic-model results are not reused as new evidence.

`hosted-build.json` preserves the original build result, including its expected stale-review-hash block. The live production-status file is updated separately by the reconciliation workflow after the new exact review is committed. The original build outcome is not rewritten as success.

These receipts do not establish full audiovisual review, physical Android-device testing or competitor motion/audio parity. Stored reference stills lack independently verified source-video linkage. Publishing, production approval and customer handoff remain disabled pending complete creative review. Wan remains optional and disabled.

Fresh semantic run [38474835714](https://github.com/wecreates/content-control/actions/runs/38474835714) completed real OpenCLIP and Florence CPU inference on this candidate. The artifact ZIP digest and all 12 candidate-frame hashes were verified. Semantic similarity is diagnostic and does not grant artistic approval. Visual-analysis run 38475378861 and review reconciliation 38475379030 both succeeded; `reconciled-build.json` archives the resulting nine PASS checks and REVIEW_REQUIRED state.

Final repository handoff [38474835778](https://github.com/wecreates/content-control/actions/runs/38474835778) executed all eight operations across the six non-Wan repositories against the exact candidate: clip, caption burn, vertical export, transcript windows, HTML parsing, content audit, Toonflow brief import/read-back, and Ruflo canonical memory rehydration. All output hashes and receipts were independently verified. The content audit itself returns `attention_required` with two editorial advisories; operation success is not editorial approval. Ruflo rehydrates the pinned canonical project memory in ephemeral SQLite, not a persistent service or current-video memory. Derived clips are unapproved repurposing outputs. Full upstream model/provider/OAuth features are not claimed.
