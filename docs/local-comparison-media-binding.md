# Local comparison byte binding and playback telemetry

Local follow-up on `local/comparison-media-binding`, based on PR #278 head `cfeee40620d2f855464dadce409899448d722666`. This work has not been pushed, submitted as a PR, merged or deployed.

## Explicit local validation

```
node scripts/exact_av_review.mjs validate-bound candidate.mp4 receipt.json review.json references.json
```

`references.json` is an array of 2..20 objects with `url` (matching the submitted comparison URL exactly) and `path` (local file, relative to the manifest or absolute). Files must be explicitly supplied and authorized. Nothing is fetched by URL. Existing candidate/review schemas remain in use.

The bound path independently hashes/probes and fully decodes video and audio for the candidate and each reference. Reference hashes and durations must match review claims; interval coverage is revalidated against measured durations. Every reference must have one mapping. It rechecks hashes after processing all files, protects media/review/manifest paths from receipt overwrite, and writes a BLOCKED marker before media operations so an unsuccessful attempt cannot leave stale success. Success is `VALIDATED_BOUND_REVIEW`, with independently measured `reference_media` and `perception_verified:false`. Production approval and publication remain false.

The existing `validate` command still validates declarations only; this opt-in path has NOT been wired into hosted acceptance, production workflows or the Python scorer. Promoting it to those entry points requires a separately reviewed integration and authorized reference-file transport. No existing production gate has been silently represented as byte-bound.

## Playback sessions

The existing UI now assigns a new random session ID on accepted file selection and exports `playback_sessions` bound to its independently computed file hash. Conservative media progression samples produce `video_playback_intervals` and `unmuted_playback_intervals`. Seeking, pauses, stalls, visibility changes, volume/rate changes and media replacement break continuity. Samples farther than one second apart or inconsistent with elapsed time do not bridge gaps. Muted/unselected reference audio receives no audio credit. Unsupported or unavailable sampling simply leaves coverage incomplete.

These are player telemetry intervals, NOT observed/perceived coverage, frame-by-frame delivery, audible hardware output or proof of attention. They never set full-review flags. Session identifiers are correlation identifiers, not authentication. Exported JSON is editable. An importer joining reviewer observations to these sessions and a trusted independent review process remain future work; the validator does not yet consume the UI playback records.

## Local evidence

- `node --test tests/comparison-playback.test.mjs tests/comparison-app.test.mjs tests/comparison-pipeline.test.mjs tests/exact-av-review.test.mjs tests/creative-handoff.test.mjs tests/comparison-ui.test.mjs`: 84 passed, 4 existing POSIX-only skips on Windows, zero failures.
- `python -m unittest discover -s tests -p test_creator_parity_compare.py`: 10 passed.
- `git diff --check`: passed.

The synthetic media test uses locally generated one-second color/sine-tone files. It invokes the real CLI and checks valid byte binding, forged hash rejection, short claimed reference duration/coverage rejection, swapped/missing reference rejection, missing audio rejection, malformed manifest rejection and reference-file overwrite protection. UI handler tests verify session replacement and audio/seek interval behavior. These are not real-media creative acceptance or an actual browser run. No external CI was triggered.

No restricted media, provider calls, paid inference, security/credential configuration, production renderer/VPS resources or publication were used.
