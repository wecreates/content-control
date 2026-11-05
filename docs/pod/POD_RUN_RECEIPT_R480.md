# POD run receipt R480

Date: 2026-11-05 (UTC)

## Outcome

This run repaired the Money Factory POD authority and event HTTP admission boundary. A timed-out exported handler can return before a wrapped or custom request-body iterator settles after `destroy()`. The implementation now retains that slow-body admission slot until both the handler and the underlying read settle, so detached reads cannot grow past the shared 32-request ceiling.

Publication was not enabled. Live state remains `production_approved:false`, `publication:false`, and readiness fail-closed. This bounded resource-exhaustion repair is implementation and test evidence, not live marketplace acceptance.

## Concurrent work preserved

- Initial and pre-publication Content Control head: `a9e65184ac17b4fa694581c44cb516e21e614e25`.
- Initial and pre-publication Money Factory head: `c2732de9e267fba1822bb5b5d10dd481461f637a`.
- Both repositories had no open pull requests when the run began.
- The Money Factory upstream head was fetched again immediately before publication and had not advanced; the connector-created tree exactly matched local tree `15a54468a3c74b7553181606c7a374b656532dc1` before the review branch was created.
- Etsy was not modified or included.

## Changes and merge

- Money Factory PR #435, **Retain POD body admission through settlement**, passed exact-head review and was squash-merged as `944f600cf33001e2e6b4f1ee883cc317d46f5a97`.
- Authority timeouts retain admission until their underlying body read resolves or rejects; overflow remains the existing redacted HTTP 409 response and does not enter snapshot lookup.
- Event timeouts use the same dual-settlement rule; overflow remains the existing redacted HTTP 503 response and does not acquire a database client.
- New regressions exercise 32 wrapped iterators that ignore request destruction, verify the next request is rejected before downstream work, settle the detached reads, and verify capacity recovery.
- Content Control functional code and the Money Factory immutable Content Control pin were unchanged, so no new functional Render deployment or pin PR was appropriate.

## Verification evidence

### Money Factory

- Focused authority/event regression set: 61 passed, 0 failed.
- Full local Node POD suite with the Content Control checkout configured: 275 passed, 1 expected local PostgreSQL-only skip, 0 failed (276 total).
- Full local Python adapter suite: 81 passed, 0 failed.
- `git diff --check`: passed.
- GitHub Actions `POD cross-repository review verification`, exact-head run `42087690748`, job `127457114830`: success. All checkout, dependency, pinned-contract, recovery, original-art/layout, independent KDP PDF/cover, font-rights, official-template, metadata/editorial QA, Node, Python, and cleanup steps completed successfully.
- An initial local full-Node invocation without `CONTENT_CONTROL_ROOT` failed only the cross-repository tests with `CONTENT_CONTROL_ROOT_REQUIRED`; it was not counted as a passing run. The correctly configured complete invocation above passed.

## Render evidence

- Authorized workspace/service: `tea-darsafojo6nc739844hg` / `srv-darsdb8u01pc73dn4i2g`.
- Service remains an unsuspended one-instance free Docker web service on branch `main`, with auto-deploy enabled and health path `/health`.
- Deploy `dep-dbmck2eq1p3s73aqtgl0` remains live on the last functional Content Control merge `858c83a0ade49c61dba6b82fce3589e3e06f4f35`; the Money Factory-only merge did not create a Content Control deployment.
- Documentation-only evidence PR #1066 merged as `d978fded18b2aa5803deb87f2e0362ad1ff72787`; Render event `evt-dbmd2c6q1p3s73arn0k0` recorded it as `commit_ignored`, preserving the verified functional deployment.
- The first `/health` request received no bytes within 45 seconds during wake-up and was not treated as successful evidence. A fresh retry returned HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/livez`: HTTP 200 with `production_approved:false` and `publication:false`.
- Fresh `/readyz`: HTTP 503 with `ok:false`, `production_approved:false`, `publication:false`, and the current QA hash bound.
- No current `server_failed` or `service_suspended` event was observed in the inspected service event page.

## Acceptance state and limitations

All 24 acceptance areas remain **OPEN** because code, automated tests, and a live fail-closed worker are not proof of live marketplace acceptance, current account evidence, production database acceptance, independent human/platform review, financial reconciliation, measured launch capacity, or controlled-launch approval.

The previously failed database administration path was not retried because no credible connector or browser access change was present. No credential, clearance, revenue, marketplace approval, or completed acceptance was inferred. This scheduled run used only the GitHub and Render permissions actually available; it did not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. The completion automation remains enabled because the 24-area completion gate has not been met.
