# POD run receipt R484

Date: 2026-11-05 (UTC)

## Outcome

This run repaired Content Control's pre-reader bridge response cleanup. `readBridgeJSON` could reject with a fixed status, abort or deadline result before acquiring a body reader, then evaluate a custom `response.body` accessor outside the cleanup guard. A throwing accessor could replace the primary failure with an untrusted cleanup exception. Body acquisition for best-effort cancellation is now guarded and performed once, and a regression proves both status and pre-aborted results survive a throwing cleanup accessor.

Publication was not enabled. Live state remains `production_approved:false`, `publication:false`, and readiness fail-closed. This bridge repair and its tests are implementation evidence, not live marketplace acceptance.

## Concurrent work preserved

- Initial Content Control head: `63fdc1ecc10a78105a4ed33b9a423b7ea3152967`.
- The run preserved the current pre-existing state/watchdog commits `265fd6f4b583ac8c6625d154b702eeb8c6abc4b5`, `a2d2f4f09b6ca490e6568cc155529740ba98d2c3`, and `63fdc1ecc10a78105a4ed33b9a423b7ea3152967`; each deployed successfully before this repair.
- Initial Money Factory head: `40468e81790589f83f296544db7a7c3e15878df3`.
- Both repositories had no open pull requests when reconciled, and neither main branch advanced independently before its corresponding publication step.
- Connector-created trees exactly matched the tested local trees before review branches were created: Content Control `dc9f6cf5ddfa565d572436fc4d313044cd635817`; Money Factory `bc4db7c07d40ef0621c87762b2aed82412ac2966`.
- Etsy was not modified or included.

## Changes and merges

- Content Control PR #1075, **Protect POD bridge failures from body cleanup access**, passed exact-head review and was squash-merged as `70795920e4697d57a4e470c4997e6775776b112d`.
- Pre-reader cleanup now obtains `response.body` at most once inside a best-effort guard before testing lock state or requesting cancellation.
- The regression verifies that the fixed `STATUS` rejection and an existing `AbortError` cannot be replaced by a throwing body accessor.
- Money Factory PR #439, **Pin Content Control body cleanup repair**, passed exact-head cross-repository review and was squash-merged as `2890d3bb22294c7ead72109d47aecc29dc7329bf`.
- Money Factory's immutable Content Control checkout now pins the exact tested merge `70795920e4697d57a4e470c4997e6775776b112d`.

## Verification evidence

### Content Control

- Focused bridge-response suite: 44 passed, 0 failed.
- Full local Node POD suite: 1,145 passed, 9 expected environment skips, 0 failed (1,154 total).
- Full local Python POD suite: 385 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD integration gates`, exact-head run `42125434083`, job `127588278270`: success.
- GitHub Actions `POD container runtime gates`, exact-head run `42125434135`, job `127588277429`: success.

### Money Factory

- Local Node POD adapter suite against the repaired Content Control tree: 278 passed, 1 expected local PostgreSQL-only skip, 0 failed (279 total).
- Local Python adapter suite: 81 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD cross-repository review verification`, exact-head run `42126567490`, job `127592164238`: success. Checkout, pinned contracts, recovery, original-art/layout, independent KDP PDF/cover, font-rights, retained official-template, metadata/editorial QA, PostgreSQL, Node, Python and cleanup steps completed successfully.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with commit auto-deploy enabled and health path `/health`.
- Content Control merge `70795920e4697d57a4e470c4997e6775776b112d` deployed as `dep-dbmglpgu01pc738a0h90`; build and deploy completed successfully and the deployment is live.
- Fresh `/health`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/livez`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/readyz`: HTTP 503 with `ok:false`, `production_approved:false`, `publication:false`, `qaStatus:"GREEN"`, and matching expected/actual QA hash `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e` while remaining not ready.
- No current `server_failed` or `service_suspended` event appeared in the inspected recent service event page.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, automated tests and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity or controlled-launch approval.

The previously failed database administration path was not retried because no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval or completed acceptance was inferred. This scheduled run used only the GitHub, Render and local execution permissions actually available; it did not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. The completion automation remains enabled because the 24-area completion gate has not been met.
