# Reference-clone transition repair

Both portrait and landscape reference-clone renderers flattened entrance and exit styles, then spread them over the camera transform. At frame zero of a synthetic 48-frame scene with six-frame whip transitions, the entrance's `translateX(110%)` was overwritten by the inactive exit's `translateX(0%)`. Transition transforms also replaced the camera transform.

Separate full-viewport exit, entrance and camera layers preserve each transform, clipping and opacity. Transform origins remain centered, viewport overflow remains clipped, and artwork ordering is unchanged. Existing transition equations moved unchanged into `SceneTransitions.mjs`, re-exported from `ChoreographyRuntime.jsx`. Character rigs, voices, publication gates and other compositions are not modified.

## Evidence

- Reviewed five-file fingerprint: `1e1542a9c9972e7ab978425edd9022b6cb70d3bbc573d258627e4f53e5dd0993`, SHA-256 over sorted relative path, NUL, raw file bytes, NUL for each of the three edited JSX files, `SceneTransitions.mjs`, and `scene-transitions.test.mjs`.
- Author's local validation: 37 Node tests and 5 Python choreography tests passed; all edited JSX parsed; diff checks passed. Dependencies came from the existing official-registry lockfile with lifecycle scripts disabled.
- Independent review reported no blocking defect, 7 Node and 5 Python tests passed, and inspected synthetic contact-sheet layering. Its broader rerun did not execute because approval-review capacity was unavailable; no broader independent pass is claimed.
- Four local synthetic actual-composition renders: before/after portrait (180x320) and landscape (480x270), each 36 frames at 24 fps. Only generated silence was available to the renderer; outputs were muted. All four fully decoded without errors. Inspected before/after contact sheets and every repaired frame in sequence. Entrance movement and camera push coexist after repair; no unintended layout/z-order change was evident in these fixtures.
- After-render SHA-256: portrait `a4189c463dc63b12406fb0f77eff6c9f4f1e22e27cec296e88677b4a07e6f984`; landscape `619cf722ed6e17882ed18c09e30c973a754c5e087996921890ce22b06a936edc`. These are local synthetic artifacts, not production candidate identities.
- Dedicated PR CI runs the 37 Node and 5 Python tests and bundles both real reference-clone entry points without media. CI results must be checked on the exact PR head.

## Limits

Synthetic renders exercised whip entrances/exits plus a camera push. Other transition types have mathematical test coverage, not exhaustive rendered coverage. Reduced-resolution frame-sequence inspection is not real-time audiovisual review. This repair does not establish natural character animation, audio synchronization or parity with viral same-style references. Full creative acceptance still requires the exact authorized candidate, full-motion references, version-appropriate rubric and complete audiovisual evidence. Restricted Library media was not accessed. Publication remains disabled; independent review is required before merge.
