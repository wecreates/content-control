# Visual analysis evidence

Latest repair source: `6810581ff756dd20d96d03631527f4c82fb20ef9`. Hosted run: https://github.com/wecreates/content-control/actions/runs/38452208211 . Candidate SHA-256: `e8fd5b0b51930c662d89a8d4ad2348b0b81f414bf51ffa0e637afc0618b6d2d8`.

Larger bold captions, larger characters, an animated cape grip, and caption/card/sword clearance repairs are present in the actual rendered video. 25 focused tests pass. All 67 actual final caption cues fit in Chromium; the full 839-frame video decodes. Independent inspection of ten frames confirms sampled repairs, while the artistic decision remains **FAIL** because expressive typography, closer framing, and staging variety still need work. Exact board consistency, device playback and full audiovisual review are not approved.

- [Repair verification](repair-2026-10-13/verification.json)
- [Exact-candidate sampled review](frame-review.json)
- [Comparison measurements](repair-2026-10-13/comparison.json)
- [Every-frame motion measurements](repair-2026-10-13/motion.json)
- [Hosted build record](repair-2026-10-13/hosted-build.json)
- [Frames 1–4](repair-2026-10-13/comparison-evidence/comparison-01.jpg)
- [Frames 5–8](repair-2026-10-13/comparison-evidence/comparison-02.jpg)
- [Frames 9–10](repair-2026-10-13/comparison-evidence/comparison-03.jpg)
- [Actual caption geometry receipt](repair-evidence/caption-bounds.json)
- [Sword-label geometry receipt](repair-evidence/sword-label-sweep.json)

The build record predates this exact-candidate review and correctly blocks its old review hash. The current comparison applies the new documented FAIL verdict. Analysis completion does not imply artistic acceptance. Publishing remains disabled.

Existing top-level `comparison.json`, `motion.json`, `semantic.json` and `comparison-evidence/` are historical snapshots for their own recorded hashes. Do not reuse their model or geometry results for a newer candidate. Hosted visual analysis runs on relevant changes and hourly. Real CPU semantic analysis follows completed V2 builds and runs daily, extracting fresh frames from each exact video. Model descriptions can be wrong and do not replace direct visual judgment.

White backgrounds remain intentional brand direction. The ten reference images lack verified source-video extraction provenance; they establish neither competitor motion nor audio parity. New reference-video intake uses `scripts/reference_frame_manifest.py` to record exact frame and video hashes.

Reproduce caption bounds from the checkout with installed dependencies: `node state/visual-analysis/repair-evidence/verify-caption-bounds.mjs`. The recorded observed input is included. `python state/visual-analysis/repair-evidence/check-sword.py` repeats the bounded sword/label geometry comparison; it is not a general video-quality test.
