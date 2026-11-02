# POD run receipt R410 — separate rollout liveness from evidence readiness

Date: 2026-11-02 UTC

## Scope and observed deployment failure

This scheduled run read the current completion checklist, implementation status,
free-deployment guide, open pull requests, exact-head workflow results and the
authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg`.
The service was still a one-instance Docker service on the existing free plan,
tracking `main`, with auto-deploy enabled and configured deployment health path
`/health`.

Free pipeline capacity had reset. Deploy `dep-dbkfii0qp2hc73cm1ekg` for commit
`57ece30db5d6d99dadb00bd67d0a66130eec11ca` built successfully and started the
container, but rollout timed out. Application logs showed the worker listening on
port 10000 while reporting `Review artifact exists but is not accepted by canonical
health state`. The cause was a contract mismatch: `/health` represented hash-bound,
accepted-evidence readiness and correctly returned 503 for the blocked review, while
Render treated that same endpoint as process liveness during rollout.

## Repair sequence

Content Control PR #954 first changed the checked-in Render blueprint and deployment
contract to the existing `/livez` liveness endpoint. The pre-fix regression
reproduced the `/health` mismatch. Six focused deployment tests, the readiness test,
all 15 deployment-verifier checks and the full POD suite passed locally; the full
suite ran 1,052 tests with 1,043 passes, nine PostgreSQL-only skips and zero
failures. Exact remote head `f95ed05b09edcfabefbe64d6794e3fe91a4d7f26`
matched all four locally tested blobs. PR #954 merged as
`682dc94de4bb5cb9aa26c122a218a42adcc3f0d9`.

That source-only blueprint change did not mutate the already-created Render service,
whose actual health path remained `/health`. Deploy `dep-dbkg566q1p3s73adom00`
started at `2026-11-02T21:37:28Z` and ended `update_failed` at
`2026-11-02T21:52:56Z`. This failure was retained as evidence rather than called a
successful deployment.

PR #955 repaired the existing-service contract without weakening review acceptance:

- `/health` is now process liveness only and returns 200 without granting approval;
- `/readyz` preserves the former accepted-evidence, hash-bound 200/503 readiness
  behavior and explicitly reports `production_approved:false`;
- `/media` remains fail-closed on the same canonical evidence acceptance function;
- `/livez` remains a liveness alias;
- Render configuration remains aligned with the actual `/health` service setting;
- review and live-verification workflows use `/readyz`, not `/health`, when they
  require evidence acceptance.

The expected-red HTTP test failed before the repair with `503 !== 200`; the
deployment contract also rejected `/livez != /health`. After the repair, the HTTP
liveness/readiness/media test, all six deployment tests, all 15 deployment-verifier
checks, syntax/YAML validation and `git diff --check` passed. The complete local POD
suite again ran 1,052 tests with 1,043 passes, nine PostgreSQL-only skips and zero
failures.

## Exact-head hosted verification and merge

All ten remote blobs at exact PR head
`844da643fb260969d7f60d1cf243c38923422d22` matched the locally tested files.
The exact head passed:

- AV reviewer run `41530780431`: browser-transport job `125570077376`, test job
  `125570077621`, Node 24 admission-runtime job `125570077687` and Node 22
  admission-runtime job `125570077847` all succeeded;
- POD integration run `41530780593`, job `125570077902`: success;
- POD container run `41530780544`, job `125570078222`: success.

PR #955 merged as `fef32e3a547d1f465a97532f7121a7679508d0bb`.

## Authorized Render verification

Render deployed descendant commit
`c321c9cab2e50300e4f1c71cf3d9e2bfde0a7c4d`; repository ancestry verifies that
the PR #955 merge is its ancestor. Deploy `dep-dbkg59q9cmtc73c0hjug` started at
`2026-11-02T21:52:56.477769Z`, finished at
`2026-11-02T21:53:58.656098Z` and reached status `live`. Render logs showed the
new instance listening on port 10000 followed by `Your service is live`.

This is deployment-liveness evidence only. The available public fetch path did not
return a direct response body during this run, so no direct `/health` or `/readyz`
body is claimed. The current `state/live-deployment-health.json` remains `FAIL` with
`probe_completed:false`; it was generated before rollout completed and was not
rewritten as success. Application evidence remained unaccepted, so `/readyz` should
remain blocked until canonical review acceptance is independently proved.

## Acceptance truth and execution limits

This run repaired and verified the rollout liveness contract. It did not establish
accepted review evidence, a production database/schema, durable recovery, external
marketplace authorization, a real submission, economics/reconciliation, measured
capacity or end-to-end launch readiness. No credible changed database-administration
path appeared, so that failed route was not retried. No paid resource, secret,
social-vault access, message, Etsy work, bot-evasion or network widening was used.
The scheduled run used only its actually available tools and did not claim a
continuously running self-hosted worker.

All 24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory, no publication was attempted and
the completion automation remains enabled.
