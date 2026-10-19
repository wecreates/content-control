# Comparison evidence repair — 2026-10-19

Inspected content-control main `826973e8599e403caa18ff684c5c6c69e7f8e356` and Money-factory main `b254a78bfe3f83f020967e1cfa04919ec06c0022` in isolated local clones. No VPS, production renderer, restricted Library media, provider inference, credentials or publishing used.

## Defect and integration

The hosted `/v2` acceptance path, exact-review CLI, V2 workflow and retained-render verifier share `creative-handoff.js`. It required candidate coverage but counted references from source URLs, full-review flags and generic prose alone. The Episode 1 creator-parity scorer likewise counted full-AV flags without observation coverage.

Both now require a reference artifact SHA256, finite positive duration, continuous interval union covering its duration, and separate audio/video observations. Duplicate reference bytes and candidate self-comparisons cannot inflate counts. Existing source-URL deduplication remains. Missing evidence fails closed. The generated exact-review request describes these fields. Existing reviewer JSON must be completed through actual review, not mechanically upgraded with invented observations.

The generic handoff retains its two-reference requirement. Episode 1's own rubric counts remain unchanged. No Episode 1 requirements were applied to short/long/V2 versions. Character and voice production components are untouched.

Money-factory's `integrations/check_live_content_control.py` observes the existing Content Control service; searches of its integrations and workflows found no independent audiovisual comparator. No changes there were needed for this shared-gate repair.

## Local validation

- `node --test tests/creative-handoff.test.mjs tests/comparison-ui.test.mjs tests/comparison-app.test.mjs tests/comparison-pipeline.test.mjs`: 48 passed.
- `node --test tests/exact-av-review.test.mjs`: 29 passed, 4 existing POSIX FIFO tests skipped on Windows.
- `python -m unittest discover -s tests -p test_creator_parity_compare.py`: 9 passed.
- `python -m unittest discover -s tests -p test_free_review_guards.py`: 4 passed.
- `git diff --check`: passed.
- `test_exact_av_workflow.py`: 15 failures in setup because Windows Bash returned `E_ACCESSDENIED`; workflow commands did not execute. The Linux PR workflow runs this suite.
- `tests/review-smoke-contract.test.mjs`: Windows shell-backed assertion failed; Linux PR workflow runs this suite. No success claimed locally.

The new comparison pipeline test creates three explicitly SYNTHETIC, one-second colored video/sine-tone files locally with FFmpeg. It fully decodes both streams, obtains real hashes/durations, prepares the existing review contract, invokes the real exact-review CLI, and verifies successful schema validation becomes BLOCKED when reference coverage is removed or references are absent. All result receipts retain publication and production approval false. Review statements are synthetic fixtures, not observations of actual candidates or competitors. The test removes only its own temporary files.

The existing UI event-handler harness needed a CRLF-compatible import-removal regex to run on Windows; its 15 tests now pass. This is event-handler coverage, not browser audiovisual review.

## Remaining real-media requirements

This repair validates evidence structure, not truth or authenticity of reviewer claims. Hashes in submitted references are declarations until an independent reviewer binds them to accessible source bytes. No real candidate or competitor was reviewed, no creative score is accepted, and full system creative acceptance remains blocked.

Supply authorized accessible candidate and distinct reference files, the intended version-specific rubric, exact reference hashes/durations, traceable reviewer provenance, complete audiovisual observation intervals and concrete differences. Use the existing `/compare` workspace for notes and exact-review preparation/validation for the final review. UI notes alone remain REVIEW_PENDING. A provider route additionally needs an already approved demonstrably free configuration; none was configured or invoked here. The blocked CYZOR-Split-Media-Review.zip was not accessed through any route.

Review independently before merge. No deployment or publication is part of this change.
