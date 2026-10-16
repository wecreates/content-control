# POD/KDP implementation and acceptance status

This change extends server-lowmem.js and the existing capability registry. It does
not replace Content Control or enable publication. Runtime records use dedicated
PostgreSQL tables; cyzor_social_vault is never accessed by this lane.

| Stage | Implemented | Remaining acceptance requirement |
|---|---|---|
| 1 Durable storage | Transactional migrations, bounded content-addressed PostgreSQL artifacts, immutable evidence | Provision scoped runtime credentials, execute migration, restart/restore verification. 128 MiB default budget stops production when full. Large-scale storage is not provisioned. |
| 2 Money Factory integration | Exact bridge rules, signed scoped grants, upstream readiness adapter, idempotent event inbox/outbox | Mount inbox/grant adapters in deployed MF authority and verify full round trip. PRELAUNCH ceiling remains unchanged. |
| 3 Market collection | Authorized-source intake, JSON-LD extraction, reference geometry, signed observation ingestion | Authorize and validate each platform data source. No invented BSR, search volume or print dimensions. |
| 4 Rights screening | Country/category coverage checks, terminology matching, uncertainty tombstones, signed evidence | Supply current registry coverage and independently verified asset/font rights. This is screening, not automated legal clearance. |
| 5 Original generation | Deterministic geometric art generator, provenance, licensed-font composition | Validate commercially useful briefs and diversity; no AI provider configured. 100 concepts/day is a budget, not measured successful throughput. |
| 6 Templates | Signed template provenance, dimensions, native PPI, safe-zone checks, aspect-preserving placement | Import current official product templates and approve print proofs for each product. |
| 7 KDP books | Cover PDF, embedded-font text interiors, page count/text/size checks | Editorial review, supported official trim/gutter specs, cover/interior combined release manifest and actual KDP preview validation. |
| 8 QA | Exact OCR, hashes, geometry, DPI, collision checks, mandatory competitive evidence | Configure calibrated independent comparative reviewer; CLIP never proves superiority. No claim of 100% objective perfection. |
| 9 Orchestration | Atomic queue claims, leases, fencing, budgets, expiry recovery, bounded repair, awaited worker loop | Supply production task/grant/artifact resolvers, run worker on a durable always-on host and load-test 100/1,000 concepts/day. |
| 10 Publishing | Fail-closed executor, per-account quotas, dry-run isolation, ambiguous-outcome hold and observed-live reconciliation | Implement and verify authorized submit/readback adapter for each marketplace. None is enabled. No anti-bot evasion. |
| 11 Financial feedback | Immutable evidence-backed events, currency-separated totals, outbox/inbox | Connect actual provider statements and core MF verified ledger. Recorded net is not proven profit or cash balance. |
| 12 Mobile operations | Authenticated metrics and responsive dashboard, unavailable-state errors | Deploy and verify owner access on phone. Dashboard is read-only; operational mutation controls remain API-only. |

## Run and test

`npm run test:pod` runs Node unit/HTTP tests. The PostgreSQL test runs only when
POD_TEST_DATABASE_URL points to a disposable test database; never use production.
`npm run test:pod-python` exercises actual OCR, geometry and PDF rendering.
`.github/workflows/pod-integration.yml` supplies PostgreSQL 18 and Python 3.12,
matching the database version verified in the owner's Render workspace.
POD_DEPLOYMENT_READINESS.json records the inspected service/database configuration
and the blocked live-schema inspection. The earlier PostgreSQL 16 CI also passed.
The full model QA additionally requires requirements-free-qa.txt/lock dependencies.

Run `npm run pod:storage-init` as a separate deployment step with
DATABASE_MIGRATION_URL and DATABASE_RUNTIME_USER. The runtime role must already
exist and have login/connection permissions without superuser, role-management,
schema ownership or DDL grants. This migration grants access only to named POD
tables. Never place migration credentials in the web worker environment. It does
not revoke unrelated existing role grants; audit those independently.

Configure POD_DATABASE_URL (verified TLS), POD_STORAGE_EXPIRES_AT,
POD_BRIDGE_PATH, INTERNAL_OPERATIONS_KEY and distinct >=32-byte keys for
POD_UPSTREAM_KEY, POD_QA_KEY, POD_INTAKE_KEY, POD_FINANCE_KEY, POD_MARKET_KEY,
POD_PROVIDER_KEY. Python gates additionally use POD_REGISTRY_KEY,
POD_RIGHTS_KEY, POD_TEMPLATE_KEY, POD_REVIEW_KEY and POD_SOURCE_KEY.
Keep publication and production flags false until acceptance requirements pass.
Short-lived attestations must be refreshed against current authoritative evidence;
do not re-sign stale approvals simply to extend their lifetime.

Setting POD_SERVICE_ENABLED=true checks existing migration checksums; it never
auto-creates storage. A POD failure blocks this lane without killing unrelated
Content Control services. `/api/print/dashboard` loads the read-only dashboard;
all data endpoints require a bearer operations key. Keep that key off URLs/logs.

The free-tier-first package provides no always-on hosting guarantee. Queue
backpressure stops before storage/quota exhaustion. No paid resources, platform
accounts, marketplace listings or live revenue were created by this change.


## Evidence history and current acceptance

All 24 live acceptance areas remain OPEN. Publication remains disabled. See
[POD_COMPLETION_CHECKLIST.md](POD_COMPLETION_CHECKLIST.md) for the current full
acceptance criteria and [POD_FREE_DEPLOYMENT.md](POD_FREE_DEPLOYMENT.md) for the
protected deployment path and existing resource limits.

The complete, unedited report through PR 180 is preserved in
[the implementation history](docs/pod/POD_IMPLEMENTATION_HISTORY_2026-10-16.md). Its source is commit
[c8288c7abd337871c8a7d5e504e912906e113b2d](https://github.com/wecreates/content-control/blob/c8288c7abd337871c8a7d5e504e912906e113b2d/POD_IMPLEMENTATION_STATUS.md).
This split keeps the active status readable without discarding evidence or
changing any acceptance claim. Recent receipts are retained below.

### 2026-10-16 — r41 verified receipt: artwork and embedded-font identity

- [CC PR 176](https://github.com/wecreates/content-control/pull/176) merged tested head 10c34bbe8064ae2f4fb33f73252b5ac25339ef16 as 051567e3fb732f6a0fc6f29a154eaa15ea7f403e. Merged tree e0e7348aa7218f9c0802b731e98b72c713b7e8d5 exactly equals its tested tree. The layout renderer verifies and decodes the same bounded artwork/font snapshots, preventing path substitution after identity checks. The signed source mismatch fails before output creation. Eight new regressions pass; 16 local raster/generation tests passed with actual Pillow/font decoding after four baseline failures and two errors.
- [PR integration 38966790338](https://github.com/wecreates/content-control/actions/runs/38966790338), job 117195125337, and [main integration 38966952526](https://github.com/wecreates/content-control/actions/runs/38966952526), job 117195663083, each passed 349 Node, 136 Python, one durable PostgreSQL/Python E2E and three guards with zero failures/skips. Main wiring 38966952453 passed.
- Continued with [CC PR 177](https://github.com/wecreates/content-control/pull/177): tested head 0f6010a0eafa7f529b8e705ff9f73a13b8553810 merged as 66e0a600efbc3f1b521051a329fdcd74a8aa9e61. Tree 591476f61ea0d8bb47a0cf0b9bb7ead8a325ba6e matches the tested tree. KDP interior fonts are now hashed and embedded from the same nonempty, at-most-16-MiB snapshot. Five added regressions cover changed/deleted fonts, byte bounds and identity. Local 28-test book/cover suite passed with real ReportLab/PyMuPDF after two baseline failures and two errors. Invalid-annotation fixtures emit expected nonfatal MuPDF warnings.
- [PR integration 38966999421](https://github.com/wecreates/content-control/actions/runs/38966999421), job 117195827647, and [main integration 38967180923](https://github.com/wecreates/content-control/actions/runs/38967180923), job 117196438395, each passed 349 Node, 141 Python (28 book/cover, 16 raster/generation), one durable E2E and three guards with zero failures/skips. Main wiring 38967180914 passed. Both runtime merges rechecked unchanged bases, exact heads, clean mergeability and successful checks. No competing POD PR was overwritten; MF remains 15576ab5b4957a762feb2a823469ae50765e2fa2.
- Render dep-db993ajm8hqs73fdkmm0 for PR 176 failed at 2026-10-16T21:05:47.320681Z; its 21:05:47.034420208Z log confirms exhausted build minutes. Dep-db99480u01pc739mpjeg for PR 177 failed at 21:07:44.77576Z; its 21:07:44.553438991Z log reports the same quota. Individually re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual build retry, duplicate job, paid workaround or database administration retry occurred. Live smoke 38965979366 independently reports stale media hashes and missing watch/range/caption acceptance despite health/publication-disabled checks passing; those failures were not suppressed.

All 24 live acceptance areas remain OPEN and publication flags false. Production restricted role/schema/migrations, retained storage/recovery, deployed hybrid dependencies, live MF grants/revocation, actual accounts/sources/rights/templates/reviewers, permitted adapters, real finance, owner-phone acceptance, measured capacity and actual end-to-end execution remain unverified. No credentials, social-vault data, network access, spending, clearance, approvals, publication or revenue was changed or invented. Disposable hosted CI and merged code are not live acceptance or a continuously running worker. This report-only receipt uses [skip render]; runtime commits did not skip deployment or CI.


### 2026-10-16 — r42 checkpoint: rendering authority expiry

Inspected CC f3c674c6f186f01ebb51a6bdf3a8f04be6da27c1 and unchanged MF 15576ab5b4957a762feb2a823469ae50765e2fa2, current acceptance/deployment documents, open PRs/workflows and Render. No competing POD PR or AGENTS.md; Render quota and database access blockers are unchanged.

Asset, standalone interior and book-package CLIs now reverify their original signed evidence after rendering/hashing, before reporting success. Interior receipt writes are also followed by a final check. Replacing an evidence file cannot renew the authority used for rendering. Expiry returns BLOCKED/exit 2, so the worker cannot persist the failed stage; local output files alone are not acceptance. Seven new controlled-time tests pass after baseline reproduced eight failed assertions and two errors. Actual local Pillow/ReportLab/PyMuPDF suites pass 16 raster and 28 book/cover tests; full hosted verification pending. No live authorization is invented. All 24 live areas remain OPEN; publication stays disabled.


### 2026-10-16 — r42 verified receipt: final rendering authority

[PR 179](https://github.com/wecreates/content-control/pull/179) merged tested bee4a2234d7bb8adf28d6703700610fe04feaeb2 as 3d1d7ea654d64e5fee7a285abdaece82b371054e. Tree 85c67585ffe5bb1095348e0b8203e353a0ec4c92 exactly matches the tested tree. Fresh head/base, clean mergeability and passing checks were verified before merge. Asset/interior/package CLI success now requires the original rights/template evidence still be valid after rendering; replacing files cannot extend it.

[PR CI 38969436508](https://github.com/wecreates/content-control/actions/runs/38969436508), job 117203893826, and [main CI 38969618714](https://github.com/wecreates/content-control/actions/runs/38969618714), job 117204500536, each passed 349 Node, 148 Python, one durable PostgreSQL/Python E2E and three guards, zero failures/skips. Main wiring 38969618715 passed. The new seven-test suite uses controlled time and stubbed render stages; existing real rendering/E2E tests remain passing. These fixtures provide no live approval.

Render dep-db99dvlg1s2s73bv9fig failed at 2026-10-16T21:28:31.614167Z; build log 21:28:31.372680056Z confirms exhausted build minutes. Re-read dep-db7r0lh42hec739jiusg remains live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual retry, duplicate dispatch, paid workaround or unchanged DB-access retry occurred.

All 24 live areas remain OPEN, with existing production/data/authority/provider/acceptance dependencies unresolved. Publication flags remain false. No credentials, social-vault access, network widening, spending, clearance, approvals, publication or revenue was changed or invented. CI is not deployment or continuous execution. This report-only receipt uses [skip render]; runtime code did not skip CI or deployment.


### 2026-10-16 — r43 checkpoint: market observation time identity

Read CC c8288c7abd337871c8a7d5e504e912906e113b2d, MF ce42f709e4867905ce49550fffd530169a405965, open PRs/workflows and all three status/deployment documents. MF changed only monitor reports; no competing POD PR exists. Render remains free Docker with the same failed quota-limited deployment; no changed database access path was found or retried.

Market observations previously accepted zone-less or normalized dates and excess precision. They now share financial intake's explicit timestamp validator, preserving valid original offset/microsecond parameters while rejecting ambiguous input before database access. Four new regression tests failed against baseline; all 26 market/financial unit tests now pass. Added PostgreSQL coverage verifies exact replay across Honolulu/Tokyo sessions with equivalent offsets, rejection without insertion and distinct microseconds. Hosted database verification is pending; local injected pools do not prove it. The complete prior status is archived byte-for-byte and linked above. All 24 live areas remain OPEN and publication flags false.


### 2026-10-16 — r43 verified receipt: market observation time identity

[PR 181](https://github.com/wecreates/content-control/pull/181) merged tested 1a28d34ad4fd692bc234facd90c96b0a79a824fa as 79aa9d3f626161bbd265b2b935a75f4ae8a52baa. Tree 19864884050c08a7bc44f3088041c22b21196f69 exactly matches the tested tree. Fresh head/base, clean mergeability and passing checks were verified before merge. Market and financial intake now share explicit timezone/calendar/precision validation; valid offsets and microseconds reach PostgreSQL unchanged.

[PR CI 38975850098](https://github.com/wecreates/content-control/actions/runs/38975850098), job 117224986813, and [main CI 38976033658](https://github.com/wecreates/content-control/actions/runs/38976033658), job 117225588706, each passed 355 Node, 148 Python, one durable PostgreSQL/Python E2E and three guards, zero failures/skips. [Main wiring 38976034068](https://github.com/wecreates/content-control/actions/runs/38976034068), job 117225590145, passed. Actual disposable PostgreSQL checks verified equivalent-offset replay between Honolulu/Tokyo sessions, exact microsecond storage, distinct microsecond identity and rejection without insertion. These synthetic records do not authorize live collection.

The complete pre-r43 status (261,732 characters, Git blob 83affb26b193f32b87fa507da9f1b4475d9280fe) was preserved byte-for-byte in [the linked history](docs/pod/POD_IMPLEMENTATION_HISTORY_2026-10-16.md). The active status retains implementation/run instructions and recent receipts.

Render dep-db9aaetg1s2s73a93bf0 failed at 2026-10-16T22:29:16.088168Z for this merge; build log 22:29:15.916834396Z confirms exhausted build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg remains live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual retry, duplicate dispatch, paid workaround or unchanged database-access retry occurred. MF ce42f709e4867905ce49550fffd530169a405965 contained only newer monitor reports relative to the last inspected head; no MF implementation change was needed for this repair.

All 24 live acceptance areas remain OPEN. Existing restricted production database/schema, retained storage/recovery, deployed dependencies, live MF authority/grants/revocation, real accounts/sources/rights/templates/reviewers, permitted adapters, actual economics/reconciliation, owner-phone acceptance, monitoring drills, measured capacity and real end-to-end evidence remain outstanding. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; no credentials, social-vault access, network widening, spending, clearance, approvals, publication or revenue was changed or invented. Hosted CI is not live acceptance or a continuously running worker. This report-only receipt uses [skip render]; the runtime change did not skip CI or deployment.
