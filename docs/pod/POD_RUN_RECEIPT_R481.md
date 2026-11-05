# POD run receipt R481

Date: 2026-11-05 (UTC)

## Outcome

This run repaired Money Factory's authority and event HTTP timeout settlement. Both handlers previously invoked a caller-provided request `destroy()` hook before settling their server-owned timeout promise. If a wrapped hook threw, the authority path could later continue into snapshot lookup and grant signing, while the event path could later enter and commit the durable inbox after already returning HTTP 408. Request destruction is now best effort and cannot prevent timeout rejection.

Publication was not enabled. Live state remains `production_approved:false`, `publication:false`, and readiness fail-closed. This authority/inbox repair is implementation and test evidence, not live marketplace acceptance.

## Concurrent work preserved

- Initial and pre-publication Content Control head: `8cf51d63dd47ca6f7b0bae86a8ec572464548b66`.
- Initial Money Factory head: `7ff73aba91a1e4c39c2fb4e73d4e2f7d09cdf127`.
- Concurrent Money Factory commit `7ff73aba91a1e4c39c2fb4e73d4e2f7d09cdf127` changed only `FREE_MONITOR_EVENTS.json` and `FREE_MONITOR_STATE.json`; it was preserved as the implementation base and did not overlap the POD HTTP handlers.
- Both repositories had no open pull requests when the run began.
- The Money Factory upstream head was fetched again before publication and had not advanced; the connector-created tree exactly matched local tree `078b96a4e5c57d22b16022182a59848b1e1ea891` before the review branch was created.
- Etsy was not modified or included.

## Changes and merge

- Money Factory PR #436, **Settle POD timeouts despite destroy failures**, passed exact-head review and was squash-merged as `832c344dbdc75dde7696650f9ef362462d0d4638`.
- The authority body timeout now settles even if request destruction throws, so a late body cannot reach snapshot lookup or grant signing.
- The event body timeout now settles even if request destruction throws, so a late body cannot acquire a database client or commit an inbox event after HTTP 408.
- Regression tests use wrapped request streams with throwing destroy hooks and deliberately release the body only after the timeout. They verify fixed redacted responses, no callback exception, no authority lookup, no grant signing, no database acquisition and no late commit.
- Content Control functional code and the Money Factory immutable Content Control pin were unchanged, so no new functional Render deployment or pin PR was appropriate.

## Verification evidence

### Money Factory

- Focused authority/event regression set: 63 passed, 0 failed.
- Full local Node POD suite against current Content Control main: 277 passed, 1 expected local PostgreSQL-only skip, 0 failed (278 total).
- Full local Python adapter suite: 81 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD cross-repository review verification`, exact-head run `42101168367`, job `127504031960`: success. All checkout, dependency, pinned-contract, recovery, original-art/layout, independent KDP PDF/cover, font-rights, official-template, metadata/editorial QA, Node, Python and cleanup steps completed successfully.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with auto-deploy enabled and health path `/health`.
- Deploy `dep-dbmck2eq1p3s73aqtgl0` remains live on the last functional Content Control merge `858c83a0ade49c61dba6b82fce3589e3e06f4f35`; the Money Factory-only merge did not create a Content Control deployment.
- Fresh `/health`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/livez`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/readyz`: HTTP 503 with `ok:false`, `production_approved:false`, `publication:false`, and the current QA hash bound.
- No current `server_failed` or `service_suspended` event was observed in the inspected service event page.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, automated tests and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity or controlled-launch approval.

The previously failed database administration path was not retried because no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval or completed acceptance was inferred. This scheduled run used only the GitHub and Render permissions actually available; it did not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. The completion automation remains enabled because the 24-area completion gate has not been met.
