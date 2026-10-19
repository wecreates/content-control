# Post-merge diagnostics: local patch only

Base: `4668d7eefa89f17910774bda12fd6a528e597caf`. Branch: `local/postmerge-smoke-diagnostics`. No PR, push, deployment, provider call, security change or evidence approval was performed for this patch.

All four failed workflow logs show checkout of merge revision `10c83df1a21eb2471721daf7d66cf13802f41101`. Later main state is not substituted for those run inputs.

## Exact failure classification

| Run | Evidence and root cause | Classification |
| --- | --- | --- |
| [Live Render Deployment Smoke 39195413596](https://github.com/wecreates/content-control/actions/runs/39195413596) | `KeyError: caption_sha256` while reading the failed caption receipt, before the first curl. Receipt explicitly says upstream caption generation/transcription failed. | Missing valid evidence; brittle preflight is a code defect. This run did not test Render availability. |
| [Review Server Smoke 39195413404](https://github.com/wecreates/content-control/actions/runs/39195413404) | Downloaded diagnostic log says the worker listened on port 10000 and the artifact was not accepted. Startup waits for `/health` 200, although that endpoint intentionally returns 503 when caption acceptance is blocked. | Correct readiness block, incorrectly described as startup failure. Separate liveness without changing readiness/media gates. |
| [Free Production Watchdog 39195413571](https://github.com/wecreates/content-control/actions/runs/39195413571) | Failed checks: runtime integrity, live deployment, caption candidate/health, provenance currency, candidate identity consistency/convergence. Integrity snapshot expected an older server hash. Main subsequently received an automatic runtime-manifest update. | Correct rejection of stale/missing evidence at its checkout; concurrent evidence refresh does not retroactively make this run pass. No watchdog gate weakened. |
| [V2 Acceptance 39195413677](https://github.com/wecreates/content-control/actions/runs/39195413677) | Rendered candidate `1f1a2b090cff4c75bf22fbe297141257d7c17d7bd2b14c2409214289eb2e8056`; supplied `state/visual-analysis/frame-review.json` binds draft `db60b8c4820012a497e42920b122d70aed5895ca8ffed03154998d0db2d31e34`. Inspection reports `INVALID_VISUAL_REVIEW`: review hash does not match exact video. | Correct stale-review block. That report is explicitly sampled-frame analysis, not full audiovisual acceptance. Do not copy its observations or change its hash. |

One read-only request at 2026-10-19 03:42:34 UTC to the configured Render `/health` returned HTTP 200, `publication:false`, and old candidate `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`. Repository candidate is `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`. Thus current observation shows a stale deployed candidate, not a quota failure. It does not prove historical availability or authorize deployment.

## Caption bytes and missing input

Authorized repository VTT exists. Its exact Git blob at the merge is 673 bytes, SHA256 `488545502ef9d1485ece67700eab3cbf81c383e0093e14b389a51a89e236d548`. Windows checkout CRLF conversion produces different working-file bytes (710 bytes, `a15a03f62a9f3304ba45cf7a8fcd061a422991d3289219d6115ba4e3009ef3da`); validators must hash whichever bytes are actually used, never substitute the Git hash for a differing file.

Narration bytes exist and hash to `77ae2168527509c49a02ab08d9e54f8c04fd5774309bba82e8eefa88974074fb`, matching the factual contract. The transcription receipt has no `audio_sha256`. Running the actual caption validator into a separate diagnostic output, after repairing its Windows `O_NONBLOCK` portability error, returns FAIL: `Current narration hash must match transcription and approved contract`.

Raw caption metadata can be computed deterministically. A passing provenance/acceptance receipt cannot. Required next input: a fresh transcription generated from those exact narration bytes, with its measured timing and source hash, then the existing caption contract/VTT validation against the current candidate. Merely inserting the known audio hash into the old receipt is not valid. Full V2 acceptance separately needs independent review of the exact new candidate and authorized full-duration references with both audio and video coverage.

## Local repairs

- Add `/livez` returning process liveness only, explicitly no production/publication approval. `/health` readiness and `/media` rejection stay unchanged.
- Smoke startup uses `/livez`; acceptance still requires `/health` 200 and all existing route assertions.
- Add read-only, bounded regular-file input preflight. Missing caption hashes produce structured BLOCKED reasons and observed byte hashes, never a fabricated PASS or uncaught KeyError.
- Fix live smoke to check the actual hash-qualified caption URL.
- Receipts require successful probe/assertion step outcomes. Existing output files or two missing hashes cannot create passing evidence.
- Require the stale-candidate guard to succeed before persisting live evidence, including failed-probe receipts.
- Make existing caption snapshot reads portable when Windows lacks `O_NONBLOCK`; POSIX keeps nonblocking opens and the regular-file gate.

## Validation and limits

New regressions exercise synthetic byte receipts, missing/changed inputs, actual workflow receipt scripts, and production route handlers over loopback HTTP: liveness 200 with readiness 503 and media 409. No synthetic observation is presented as real-media approval.

Passing local validation: six new Python smoke tests, 27 Node readiness/creative-handoff/validator-isolation tests, and 13 portable existing caption-provenance tests (46 total). Node syntax and `git diff --check` pass. The full existing caption suite cannot run on this Windows host: three Bash-backed test methods report WSL `E_ACCESSDENIED` (seven failing subcases), and the FIFO test errors because `os.mkfifo` is unavailable. These cases require Linux; no external CI was triggered. A standalone YAML parser was unavailable locally (`PyYAML` is not installed); changed receipt Python blocks are executed by regression tests, but full Actions workflow execution remains unverified locally.

Independent review found Windows Python 3.14 can expose different creation/change timestamps through `Path.stat` and `os.fstat`. The follow-up now compares each API's complete identity (including its own change timestamp) before/after, and compares device/inode, size and modification time across APIs. It does not discard mutation/replacement checks. Four added regressions cover the API timestamp difference, path and descriptor timestamp mutations, and same-size/timestamp inode replacement. On Windows Python 3.14.0, all ten Python smoke tests passed 30 consecutive rounds (300 executions, zero failures); the 27 Node tests and 13 portable caption tests passed again. Patch remains local-only.
