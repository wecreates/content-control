# Comparison media and session binding

This follow-up connects local media binding and playback-record import to the existing hosted V2 acceptance function and creator-parity scorer CLI. It preserves production approval/publication false in binding receipts and does not infer perception from decoding or player events.

## Review inputs and workflow

1. Load authorized candidate/reference files in the existing `/compare` workspace. It hashes the same browser Files used for playback. Each accepted file selection creates a new session ID. Export each reference pair's notes/session records, then collect the exported objects in a JSON array (`sessions.json`). Choose and play each audio track separately. Muted, skipped, stalled or otherwise unrecorded intervals do not count toward unmuted playback coverage.
2. Supply `references.json`: an array of 2..20 `{ "url": "https://...", "path": "local/reference.mp4" }` objects. Paths resolve relative to that manifest. URLs must exactly match submitted comparisons. Nothing is fetched from those URLs.
3. Independently perform the audiovisual review. In the existing reviewer report, set root `review_session_id` to the candidate session and each comparison's `review_session_id` to its reference session. Preserve separate actual audiovisual observations, full-review declarations and reviewed intervals. Copying playback intervals into observation fields without actual review is not valid evidence.
4. Run:

```
node scripts/exact_av_review.mjs validate-bound candidate.mp4 result.json review.json references.json sessions.json
```

The shared validator independently hashes, probes and fully decodes both streams for all supplied files. It compares actual hashes, sizes and durations with reports and session records; checks coverage against measured durations; rechecks media hashes and manifest/session-file hashes; and blocks missing, changed or mismatched inputs. Successful output includes imported sessions separately from reviewer observations and a `comparison_evidence` object containing manifest/session paths. The original `validate` command remains structural-only for existing preparation/diagnostic workflows and is not a substitute for this gate.

## Existing entrypoints

- Hosted `server-lowmem.js::v2Acceptance` still requires the existing creative, technical, runtime and publication gates. It additionally calls the shared bound validator using `health.comparison_evidence.manifest_path` and `.sessions_path`. Missing configuration or files blocks acceptance. Place the authorized files on the same host and preserve paths in the locally prepared health record; a bound receipt alone does not mark health READY. No production health record was changed here.
- `scripts/creator_parity_compare.py` retains the Episode 1 rubric. Its CLI additionally requires `--candidate-media`, `--references-manifest`, and `--sessions` to permit a passing result, invokes the same Node binding/importer code, and records a critical binding fault on failure. Candidate/reference reports use their own `review_session_id`. The pure `compare()` function remains a structural scoring function for unit tests; CLI acceptance requires binding as well.

## Honest scope and operational limits

Player telemetry records media progression and unmuted routing, not frame-by-frame display, audible hardware output, attention or semantic perception. Hidden, paused, seeking, stalled, replacement and rate/volume boundaries break continuity. Missing boundary samples fail closed; replay unrecorded portions rather than filling gaps manually. Session IDs correlate files and reviewer records; they do not authenticate a reviewer. Exported JSON and observation prose remain editable claims. Hashing cannot authenticate the footage-to-source-URL association. All bound results explicitly retain `perception_verified:false` and `production_approved:false`; separate authentic review remains required.

Hosted validation currently performs synchronous local hashing/probing/decoding when the structural gate passes. This is conservative and bounded per subprocess but can be expensive for long media; it must be assessed during review before deployment. No background production jobs, infrastructure or credentials were added.

## Tests and limitations

The combined local Node suites passed 85 tests with 4 existing POSIX-only skips on Windows. The new integration test generates eight one-second SYNTHETIC color/tone videos, produces session records through the real UI model/tracker with explicitly synthetic events, invokes the actual server acceptance function against temporary persisted records (without unrelated service startup), and invokes the real Python scorer CLI. Both pass valid binding and reject missing sessions/files, stale session IDs, mismatched file hashes, partial visual playback, muted reference audio, partial observation coverage, absent audio observations and absent candidate audiovisual review. No real candidate/competitor creative acceptance is asserted.

Local Python: scorer 10 passed; free-review guards 4 passed; offline packaging 3 passed; packet tests 2 passed. The existing 52-test Gemini mock suite had 4 failures and 5 errors on Windows due to unavailable POSIX `signal.setitimer`/deadline facilities; it made no real provider inference. Bash-backed workflow/smoke tests require the normal Linux CI. Browser CI additionally checks both served and standalone offline exports, file/session binding and full synthetic playback in both audio selections while review flags stay false.

No restricted media, paid inference, credential/security changes, renderer/VPS operations or publishing were used. PR #278 is the separately reviewed structural prerequisite; this follow-up requires independent review before merge.

The new full-playback browser check initially exposed a 3.75 ms start gap in pinned Chromium: asynchronous play events arrived after playback began. The UI now records an exact requested-start anchor before calling play; the anchor alone credits nothing and subsequent actual progression is required. The focused app/tracker suite passed all 23 tests. Served and standalone offline browser suites then both passed locally using the same official Playwright 1.64.1 / Chromium 156 headless version as CI. Both tracks exported exact [0,5] synthetic playback coverage while all review/perception flags remained false. The local Windows offline build needed execution outside the directory-read sandbox; it only wrote the task's HTML bundle.
