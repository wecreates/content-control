# POD run receipt R483

Date: 2026-11-05 (UTC)

## Outcome

This run repaired Content Control's bounded bridge response cleanup. `readBridgeJSON` already treated stream cancellation as best effort, but an exception from a custom reader's `releaseLock()` could replace a successful authenticated result or the fixed status, size, abort or deadline failure. Reader release is now best effort too, and a regression proves both successful JSON and the primary oversized-body failure survive a throwing cleanup hook.

Publication was not enabled. Live state remains `production_approved:false`, `publication:false`, and readiness fail-closed. This bridge repair and its tests are implementation evidence, not live marketplace acceptance.

## Concurrent work preserved

- Initial Content Control head: `05c21aa22da65493d3fccd483704cb9474b989ee`.
- The run preserved the two current pre-existing state commits `b9102c5a3156a6c1f2a5370d7d0c4d61e351a1ad` and `05c21aa22da65493d3fccd483704cb9474b989ee`; both had already deployed successfully before this repair.
- Initial Money Factory head: `c1163c4b61d6ade281cab7ef6ef6dd3358b6cfb7`.
- Both repositories had no open pull requests when reconciled, and neither main branch advanced independently before its corresponding publication step.
- Connector-created trees exactly matched the tested local trees before review branches were created: Content Control `b1270faba27ffbc377c714318ac38299970b15cf`; Money Factory `40dcf30602b7355519a5f700f849b992d14c0885`.
- Etsy was not modified or included.

## Changes and merges

- Content Control PR #1072, **Protect POD bridge results from reader cleanup errors**, passed exact-head review and was squash-merged as `f7366f0e65fcf5af0d5b81f46f5c793883adaf26`.
- `readBridgeJSON` now catches a throwing reader `releaseLock()` just as it already catches synchronous and asynchronous cancellation failures.
- The regression verifies that a cleanup exception cannot replace either a successful authenticated JSON value or the fixed `SIZE` rejection.
- Money Factory PR #438, **Pin Content Control bridge cleanup repair**, passed exact-head cross-repository review and was squash-merged as `40468e81790589f83f296544db7a7c3e15878df3`.
- Money Factory's immutable Content Control checkout now pins the exact tested merge `f7366f0e65fcf5af0d5b81f46f5c793883adaf26`.

## Verification evidence

### Content Control

- Focused bridge-response suite: 43 passed, 0 failed.
- Full local Node POD suite: 1,144 passed, 9 expected environment skips, 0 failed (1,153 total).
- Full local Python POD suite: 385 passed, 0 failed.
- The fresh worktree initially lacked installed Node dependencies and eight files could not import the declared `pg` package. `npm ci --ignore-scripts --no-audit --no-fund` restored the lockfile dependencies; the complete rerun above passed. The setup-only first attempt is not reported as a product pass.
- `git diff --check`: passed.
- GitHub Actions `POD integration gates`, exact-head run `42113934040`, job `127548438077`: success.
- GitHub Actions `POD container runtime gates`, exact-head run `42113933908`, job `127548438507`: success.

### Money Factory

- Local Node POD adapter suite against the repaired Content Control tree: 278 passed, 1 expected local PostgreSQL-only skip, 0 failed (279 total).
- Local Python adapter suite: 81 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD cross-repository review verification`, exact-head run `42115102771`, job `127552539567`: success. Checkout, pinned contracts, recovery, original-art/layout, independent KDP PDF/cover, font-rights, retained official-template, metadata/editorial QA, PostgreSQL, Node, Python and cleanup steps completed successfully.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with commit auto-deploy enabled and health path `/health`.
- Content Control merge `f7366f0e65fcf5af0d5b81f46f5c793883adaf26` deployed as `dep-dbmfg1uq1p3s73ee1fl0`; build and deploy completed successfully and the deployment is live.
- Fresh `/health`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/livez`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/readyz`: HTTP 503 with `ok:false`, `production_approved:false`, `publication:false`, `qaStatus:"GREEN"`, and exact expected/actual QA hashes while remaining not ready.
- No current `server_failed` or `service_suspended` event appeared in the inspected recent service event page.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, automated tests and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity or controlled-launch approval.

The previously failed database administration path was not retried because no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval or completed acceptance was inferred. This scheduled run used only the GitHub, Render and local execution permissions actually available; it did not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. The completion automation remains enabled because the 24-area completion gate has not been met.
