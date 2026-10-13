# Final corrected V2 evidence

Candidate SHA-256: `896006c7af0571fa98f2f17e22aafa7030a424c9c47f2f85d130c7173f181edf`.
Source: `e9fb2d8711f0b3a3aca5787ebcf06e367382aadd`; hosted build: [38473857671](https://github.com/wecreates/content-control/actions/runs/38473857671).

The actual video contains 840 decoded frames at 24fps (35.0 seconds); the container lasts 35.041 seconds. The pre-mux caption lattice has 841 frames. Independent verification confirms all 68 cues and 71 words occur in the actual 840-frame video. All 204 caption animation geometry samples pass. Eight hosted technical checks pass; 38 focused Node tests and 17 Python evidence/reconciliation tests pass.

The independently reviewed 15-frame sample passes typography, character scale, staging, board consistency and 360px raster readability. Full-resolution ending frames verify the sandwich is visible. `superseded-occlusion-fail.json` records the rejected previous candidate and must never approve this or any other video. Comparison and motion reports are newly calculated from the exact candidate; historical semantic-model results are not reused as new evidence.

`hosted-build.json` preserves the original build result, including its expected stale-review-hash block. The live production-status file is updated separately by the reconciliation workflow after the new exact review is committed. The original build outcome is not rewritten as success.

These receipts do not establish full audiovisual review, physical Android-device testing or competitor motion/audio parity. Stored reference stills lack independently verified source-video linkage. Publishing, production approval and customer handoff remain disabled pending complete creative review. Wan remains optional and disabled.
