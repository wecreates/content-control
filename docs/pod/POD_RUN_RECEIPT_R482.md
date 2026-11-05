# POD run receipt R482

Date: 2026-11-05 (UTC)

## Outcome

This run repaired Money Factory's event HTTP timeout settlement when response delivery itself fails. The timeout callback previously attempted its HTTP 408 response before rejecting the server-owned timeout promise. A throwing wrapped response hook could therefore strand the handler; releasing the request body later could enter and commit the durable event inbox after the deadline. Timeout response delivery is now best effort and cannot prevent deadline settlement.

Publication was not enabled. Live state remains `production_approved:false`, `publication:false`, and readiness fail-closed. This event-inbox repair is implementation and test evidence, not live marketplace acceptance.

## Concurrent work preserved

- Initial Content Control head: `37dc97740dfd00250f454f3d96256289e64044ca`; it changed only the live-deployment health report and Render recorded it as ignored.
- While hosted review ran, Content Control advanced to concurrent watchdog commit `941f4723c468775e25773325a4200a184c934bd3`. It changed `state/free-production-watchdog.json`, `state/operations-snapshot.json`, and `state/system-completion.json`, remained fail-closed, and was preserved as this receipt's base.
- Initial and pre-publication Money Factory head: `832c344dbdc75dde7696650f9ef362462d0d4638`.
- Both repositories had no open pull requests when the run began.
- The Money Factory upstream head was fetched again before publication and had not advanced; the connector-created tree exactly matched local tree `0d20cc0ca91ede9bc92dad2a5f12417dd4bf140b` before the review branch was created.
- Etsy was not modified or included.

## Changes and merge

- Money Factory PR #437, **Settle event timeout despite response failure**, passed exact-head review and was squash-merged as `c1163c4b61d6ade281cab7ef6ef6dd3358b6cfb7`.
- The event timeout now treats its HTTP response socket as best effort while always rejecting the server-owned deadline promise.
- The regression uses a blocked request body and a response hook that throws on the first timeout write. It verifies the handler settles before the body is released, returns a redacted timeout rejection on the retryable response path, never acquires a database client, and never commits after the body later settles.
- Content Control functional POD code and the Money Factory immutable Content Control pin were unchanged, so no pin PR was appropriate.

## Verification evidence

### Money Factory

- Focused event-handler/connection/transaction set: 36 passed, 0 failed.
- Full local Node POD suite against current Content Control main: 278 passed, 1 expected local PostgreSQL-only skip, 0 failed (279 total).
- Full local Python adapter suite: 81 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD cross-repository review verification`, exact-head run `42105509107`, job `127519147503`: success. All checkout, dependency, pinned-contract, recovery, original-art/layout, independent KDP PDF/cover, font-rights, official-template, metadata/editorial QA, Node, Python and cleanup steps completed successfully.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with auto-deploy enabled and health path `/health`.
- Concurrent watchdog commit `941f4723c468775e25773325a4200a184c934bd3` triggered deploy `dep-dbmelfd9el5s73c15rdg`; it finished live successfully and deactivated the previous deployment. This was concurrent report/state work, not the Money Factory repair and not POD acceptance.
- Documentation-only evidence PR #1070 merged as `e6d8ca6101fc98cc183cfeae1afad44668f75358`; Render event `evt-dbmenfavcj2c73egodg0` recorded it as `commit_ignored`, preserving the verified concurrent deployment.
- Fresh `/health`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/livez`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/readyz`: HTTP 503 with `ok:false`, `production_approved:false`, `publication:false`, and the current QA hash bound.
- No current `server_failed` or `service_suspended` event was observed in the inspected service event page.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, automated tests and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity or controlled-launch approval.

The previously failed database administration path was not retried because no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval or completed acceptance was inferred. This scheduled run used only the GitHub and Render permissions actually available; it did not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. The completion automation remains enabled because the 24-area completion gate has not been met.
