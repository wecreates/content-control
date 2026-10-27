Warning: truncated output (original token count: 217138)
Total output lines: 6371

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

## Run receipt r306 — clear stale listing-reconciliation reasons (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`d1dcc0939354d53546d2badb419ba6aecb21f5be` and Money Factory
`135bd3a26fb93d6d3fe108dc501d0ceb038565a3`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

Authenticated provider readback could resolve a submitted or ambiguous queue row
to `published` while retaining a stale failure `reason_code`, leaving contradictory
durable state such as `published` plus `SUBMISSION_UNCERTAIN`. The reconciliation
transaction now clears `reason_code` in the same locked update that records the
provider identity, clears the lease and sets `published`. Immutable events retain
the prior remediation history. The change does not relax evidence, identity,
authorization, fencing or publication gates.

### Verification and merge

- Regression-first verification passed 10/11 reconciliation checks and failed
  exactly the new assertion against the prior code because the published update
  omitted `reason_code=NULL`. The repaired focused publication, reconciliation,
  lease, identity and storage-writer set passed 37/37.
- The complete local Content Control POD Node suite ran 911 tests: 902 passed,
  nine environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax and whitespace checks
  passed.
- Review covered submitted and ambiguous reconciliation, queue/event consistency,
  immutable history, provider identity and repeat observations. It found no
  unresolved material correctness, security or publication-safety issue in the
  final three-file patch.
- Exact [CC PR 744](https://github.com/wecreates/content-control/pull/744) head
  `9a98a94af551b522019341ac9b371409af732e17` passed PostgreSQL integration
  run `40518786002` and production-container run `40518786041`. It merged under
  its exact-head lease as
  `371bb43d00b09b158750b9671048b5b622a898d3`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision, while preserving the later monitoring commit. Exact
  [MF PR 261](https://github.com/wecreates/Money-factory/pull/261) head
  `47d711fe04d9160e846181ab17dfdc7f9abbc42b` changed only the checkout pin,
  passed cross-repository run `40520052133`, and merged under its exact-head
  lease as `ac5e90ce61e8043392a08f751808397b6fb38c7f`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`371bb43d00b09b158750b9671048b5b622a898d3` and started deploy
`dep-dbgb5drrjlhs73d1s84g`, but event `evt-dbgb5e5t17gc738has1g` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration or provider action was run.

This closes only contradictory stale reason cleanup during authenticated listing
reconciliation. Existing code and passing local/hosted tests are not live
acceptance. All 24 acceptance areas remain OPEN. Production preflight with the
real authorities, independently retained recovery, deployed availability,
mounted Money Factory authority and current grants/revocation, real accounts and
authorized sources, rights, official templates, substantive KDP editorial/preview
acceptance, independent review and remediation, all five provider adapters,
actual economics and reconciliation, owner-phone operations, monitoring drills,
measured capacity, a real end-to-end job and controlled launch remain unverified.
Etsy remained excluded. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication occurred. The
checked-in Render definition also keeps the POD service and production loop
false. This run used only its actually available bounded tools and did not claim
a continuously running self-hosted worker.

## Run receipt r305 — isolate failed publisher fallback settlements (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`7effeaa7c046e8272e6dd28465e64ae4e3114553` and Money Factory
`611c4215aeb290051d1ccb263481f137dd550698`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

The publisher already stopped after an indeterminate submitted-state transition,
but the catch path still exposed an underlying database exception when its first
and only `blocked` or `ambiguous` fallback settlement failed. It now maps a
rejected pre-submission block settlement to the fixed non-secret
`RELEASE_SETTLEMENT_UNCERTAIN` error and a rejected post-submission ambiguity
settlement to `SUBMISSION_SETTLEMENT_UNCERTAIN`. It never claims that either
transition committed and issues no second settlement. Durable lease recovery and
authenticated provider readback remain responsible for resolving stored state.

### Verification and merge

- Regression-first verification passed 25/26 focused checks and failed exactly
  the new fallback-settlement assertion against the prior code because the
  private database exception escaped. The repaired publishing, release and lease
  suites passed 66/66.
- The complete local Content Control POD Node suite ran 910 tests: 901 passed,
  nine environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax and whitespace checks
  passed.
- Review covered pre-submission blocks, post-submission adapter uncertainty,
  submitted settlement, recovery-code accuracy, exception disclosure and repeat
  transitions. It found no unresolved material correctness, security or
  publication-safety issue in the final three-file patch.
- Exact [CC PR 742](https://github.com/wecreates/content-control/pull/742) head
  `9b1ea19039ba06d82b8464871d7fb05e64938a3e` passed PostgreSQL integration
  run `40506917704` and production-container run `40506917771`. It merged under
  its exact-head lease as
  `bff89445f1047108afad1eaa3091981bc4734bc6`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision. Exact [MF PR 260](https://github.com/wecreates/Money-factory/pull/260)
  head `9798dd032598252ee2bacc6800af0ca377cf100e` changed only the checkout pin,
  passed cross-repository run `40507775802`, and merged under its exact-head
  lease as `191d6f494f98f34689f4d2f6e96955aa8083e8b1`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`bff89445f1047108afad1eaa3091981bc4734bc6` and started deploy
`dep-dbg9uns9v7es73e7ui4g`, but event `evt-dbg9uo1lfrss73ent05g` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration or provider action was run.

This closes only fallback-settlement exception isolation. Existing code and
passing local/hosted tests are not live acceptance. All 24 acceptance areas
remain OPEN. Production preflight with the real authorities, independently
retained recovery, deployed availability, mounted Money Factory authority and
current grants/revocation, real accounts and authorized sources, rights,
official templates, substantive KDP editorial/preview acceptance, independent
review and remediation, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity,
a real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication occurred. The checked-in Render definition also keeps
the POD service and production loop false. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r304 — stop after uncertain publication settlement (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`bc258ee4b6e5427711b1573f0df004b52b1c3d42` and Money Factory
`fe6c0e100336e3c82baa250489f7832f9ceea2b5`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

After an authorized provider returned a validated submission receipt, the
publisher could receive an indeterminate result while settling the final
`submitted` state. Its catch path then issued a second `ambiguous` transition,
which could not determine whether the first transaction committed and could
replace the authoritative settlement uncertainty with another transition error.
The publisher now records that submitted settlement has begun and, if its result
is unknown, stops immediately with the fixed non-secret
`SUBMISSION_SETTLEMENT_UNCERTAIN` error. It sends no second state transition.
Durable lease recovery and authenticated provider readback remain responsible
for resolving the actual state. Pre-settlement malformed receipts and adapter
uncertainty retain their existing immediate ambiguous transition.

### Verification and merge

- Regression-first verification failed exactly the new assertion against the
  prior code because it attempted a second transition after rejected submitted
  settlement. The repaired focused publishing and lease suites passed 46/46.
- The complete local Content Control POD Node suite ran 909 tests: 900 passed,
  nine environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax and whitespace checks
  passed.
- Review covered the final settlement boundary, malformed-receipt and adapter
  uncertainty, error disclosure, durable recovery and existing fencing behavior.
  It found no unresolved material correctness, security or publication-safety
  issue in the final three-file patch.
- Exact [CC PR 740](https://github.com/wecreates/content-control/pull/740) head
  `d7eddad30da7f2a82addf627243cb4285c0842d0` passed PostgreSQL integration
  run `40499014956` and production-container run `40499014935`. It merged under
  its exact-head lease as
  `3107819adc9dd46dc170f6465ef792f9bcd9cb42`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision. Exact [MF PR 259](https://github.com/wecreates/Money-factory/pull/259)
  head `76ed190a6d0ae032b61cbdc6800369c4c15ba21c` changed only the checkout pin,
  passed cross-repository run `40499952218`, and merged under its exact-head
  lease as `611c4215aeb290051d1ccb263481f137dd550698`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`3107819adc9dd46dc170f6465ef792f9bcd9cb42` and started deploy
`dep-dbg92mq9lscs7393serg`, but event `evt-dbg92n5gtmfc73beels0` reported
exhausted pipeline minutes and the deploy ended build-failed. The authorized
service remained active on the free plan with auto-deploy enabled and no
suspender. No manual retry, paid capacity, cache/plan change, replacement
service, secret access or network widening was attempted. No production
migration or provider action was run.

This closes only duplicate settlement after an indeterminate submitted-state
transaction. Existing code and passing local/hosted tests are not live
acceptance. All 24 acceptance areas remain OPEN. Production preflight with the
real authorities, independently retained recovery, deployed availability,
mounted Money Factory authority and current grants/revocation, real accounts and
authorized sources, rights, official templates, substantive KDP
editorial/preview acceptance, independent review and remediation, all five
provider adapters, actual economics and reconciliation, owner-phone operations,
monitoring drills, measured capacity, a real end-to-end job and controlled
launch remain unverified. Etsy remained excluded. `PUBLICATION_ENABLED=false`
and `POD_PUBLICATION_ENABLED=false` remain mandatory; no publication occurred.
The checked-in Render definition also keeps the POD service and production loop
false. This run used only its actually available bounded tools and did not claim
a continuously running self-hosted worker.

## Run receipt r303 — isolate successful privileged migration sessions (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`7b3f95f0fcd35879c9a2b4ee0ba64cabf55c664a` and Money Factory
`49b3f2a97200ec2857debba3912cbb2848573d5c`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

The privileged migration helper already destroyed clients after rejected
transaction boundaries, but returned a client to the shared owner pool after a
confirmed `COMMIT`. Migration SQL is intentionally extensible and can alter
session-scoped state even when its transaction commits. A successful migration
now destroys that privileged connection before it can serve unrelated pooled
work. Failures before commit still retain reusable-client behavior only after a
confirmed rollback.

### Verification and merge

- Regression-first verification passed 9/10 focused cleanup checks and failed
  exactly the new successful-migration assertion against the prior code because
  `release(false)` returned the owner client to the pool. The repaired focused
  cleanup/provisioning suite passed all 11 runnable checks; four PostgreSQL cases
  were correctly skipped without a local disposable database.
- The complete local Content Control POD Node suite ran 908 tests: 899 passed,
  nine environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax and whitespace checks
  passed.
- Review covered confirmed commit, rejected commit, rejected begin, successful
  and failed rollback, connection acquisition, transactional provisioning,
  backend identity replacement and cleanup. It found no unresolved material
  correctness, security, migration or pooled-client lifecycle issue in the
  final three-file patch.
- Exact [CC PR 738](https://github.com/wecreates/content-control/pull/738) head
  `13d77e8a0ebb626a2d0483f685de12d95431d9aa` passed PostgreSQL integration
  run `40491150970` and production-container run `40491150969`. Hosted
  PostgreSQL verified that the confirmed migration removed the old backend
  before pool reuse. The PR merged under its exact-head lease as
  `7aaf4ab0817e1f7fde65a498700726d2befafb27`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision. Exact [MF PR 258](https://github.com/wecreates/Money-factory/pull/258)
  head `d7692645e2ead21587b52ab4790689e9523c00fb` changed only the checkout pin,
  passed cross-repository run `40492115533`, and merged under its exact-head
  lease as `fe6c0e100336e3c82baa250489f7832f9ceea2b5`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`7aaf4ab0817e1f7fde65a498700726d2befafb27` and started deploy
`dep-dbg85g8ae00c73fs4rh0`, but event `evt-dbg85gfb4ihs73b5r10g` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration or provider action was run.

This closes successful privileged-migration session reuse only. Existing code
and passing local/hosted tests are not live acceptance. All 24 acceptance areas
remain OPEN. Production preflight with the real authorities, independently
retained recovery, deployed availability, mounted Money Factory authority and
current grants/revocation, real accounts and authorized sources, rights,
official templates, substantive KDP editorial/preview acceptance, independent
review and remediation, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity,
a real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition
also keeps the POD service and production loop false. This run used only its
actually available bounded tools and did not claim a continuously running
self-hosted worker.

## Run receipt r302 — isolate ambiguous core transaction commits (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`94030ce4897a030de2def9d2605520964878f205` and Money Factory
`557876b92528659c99741b29bcff40444c2fcca3`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

The central `PodDB.read()` and `PodDB.tx()` pooled-client helpers still treated a
rejected `COMMIT` as an ordinary pre-commit failure. They attempted `ROLLBACK`
and, when that failed, `DISCARD ALL`, then could return an indeterminate
connection to the pool. Both helpers now mark commit as pending before sending
it, send no cleanup SQL when its result is unknown and destroy the client. The
existing pre-commit rollback path and post-commit sanitizer behavior remain
unchanged, and the original commit error remains authoritative.

### Verification and merge

- The focused regression-first run passed 31/35 checks and failed exactly the
  four new rejected-commit assertions against the prior code because cleanup SQL
  followed `COMMIT`. The final focused suites passed 35/35.
- The complete local Content Control POD Node suite ran 906 tests: 898 passed,
  eight environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax and whitespace checks
  passed.
- Review covered both central helpers, normal success, pre-commit rollback,
  rejected commit, post-commit sanitization, original-error identity and
  destructive client release. It found no unresolved material correctness,
  security or lifecycle issue in the final three-file patch.
- Exact [CC PR 736](https://github.com/wecreates/content-control/pull/736) head
  `9c88662e777d78b9d161dc26bbf034050e270d02` passed PostgreSQL integration
  run `40484146816` and production-container run `40484146717`. It merged
  under its exact-head lease as
  `bac672207b5961c0a38100123b0f43959ca3d3dc`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision. Exact [MF PR 257](https://github.com/wecreates/Money-factory/pull/257)
  head `17099b07106ac18c857c9e3ed0be79fb85d05317` changed only the checkout pin,
  passed cross-repository run `40485177377`, and merged under its exact-head
  lease as `49b3f2a97200ec2857debba3912cbb2848573d5c`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`bac672207b5961c0a38100123b0f43959ca3d3dc` and started deploy
`dep-dbg7bmjrjlhs73cse4qg`, but event `evt-dbg7bmvb4ihs73b57ml0` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration or provider action was run.

This closes the ambiguous-commit path in the two central pooled-client helpers
found in the reviewed POD integration. Existing code and passing local/hosted
tests are not live acceptance. All 24 acceptance areas remain OPEN. Production
database role and migrations, independently retained recovery, hosted
availability, deployed Money Factory authority, current grants and revocation,
real accounts, authorized market sources, rights, official templates,
independent review, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity,
a real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition
also keeps the POD service and production loop false. This run used only its
actually available bounded tools and did not claim a continuously running
self-hosted worker.

## Run receipt r301 — isolate ambiguous direct-reader commits (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`9249e00eb870f32345445f6512a35d9f200d6650` and Money Factory
`1377736c93bc5ec69b9dee3dca102e150e8de25f`. The current completion,
implementation and free-deployment records, open pull requests, hosted workflow
results and the authorized Render service were re-read. No open pull request
overlapped this repair. The failed database-administration route had no credible
access-path change and was not retried.

Four direct read-only pooled-client helpers—artifact export, state export,
recorded-capacity reporting and operational metrics—still treated a rejected
`COMMIT` as an ordinary pre-commit failure. They issued `ROLLBACK` and could
return the connection to the pool when that rollback appeared to work. A lost
commit response leaves the transaction and protocol outcome indeterminate.
Each helper now sends no follow-up SQL and destroys its client while commit is
unresolved, while retaining normal rollback/reuse before commit and clean reuse
after a confirmed commit. The original commit error remains authoritative.

### Verification and merge

- Regression-first archive verification passed 99/103 checks and failed exactly
  the four new indeterminate-commit assertions against the prior code because
  `ROLLBACK` followed rejected `COMMIT`. Review found the same defect in the
  two reporting helpers; their regression-first run passed 19/21 and failed
  exactly those two new commit assertions. The final combined focused suites
  passed 124/124.
- The complete local Content Control POD Node suite ran 902 tests: 894 passed,
  eight environment-dependent PostgreSQL cases skipped and zero failed. The
  complete local POD Python suite passed 385/385. Syntax, YAML and whitespace
  checks passed.
- Review covered normal success, failed begin, pre-commit failure, failed
  rollback, rejected commit, post-commit cancellation/flag changes, error
  identity and pooled-client release. It found no unresolved material
  correctness, security or lifecycle issue in the final eight-file patch.
- Exact [CC PR 734](https://github.com/wecreates/content-control/pull/734) head
  `863477ea432100c27e3ca100501fe597447d0eae` passed PostgreSQL integration
  run `40481275048` and production-container run `40481275217`. It merged
  under its exact-head lease as
  `0b50f83246fd7ade78c5adc93a8cbed9ff2957c9`.
- Money Factory's consumer workflow was advanced only to that immutable merged
  Content Control revision. Exact [MF PR 256](https://github.com/wecreates/Money-factory/pull/256)
  head `e459e37d2fd764da582f9e8936c5fb08e1da8e67` changed only the checkout pin,
  passed cross-repository run `40482159720`, and merged under its exact-head
  lease as `557876b92528659c99741b29bcff40444c2fcca3`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`0b50f83246fd7ade78c5adc93a8cbed9ff2957c9` and started deploy
`dep-dbg713vb9u1s73fvbn10`, but event `evt-dbg7147bhrrc73cqkntg` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration or provider action was run.

This closes the remaining direct read-only pooled-client ambiguous-commit paths
found in the reviewed POD integration. Existing code and passing local/hosted
tests are not live acceptance. All 24 acceptance areas remain OPEN. Production
database role and migrations, independently retained recovery, hosted
availability, deployed Money Factory authority, current grants and revocation,
real accounts, authorized market sources, rights, official templates,
independent review, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity,
a real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition
also keeps the POD service and production loop false. This run used only its
actually available bounded tools and did not claim a continuously running
self-hosted worker.

## Run receipt r300 — isolate ambiguous migration commits (2026-10-27 UTC)

### Scope and repair

Fresh inspection began from Content Control
`30b944ed4f11457e808ae2e40442d4a49767c5e3` and Money Factory
`60fe203e999f2f5c3565341b962eb4d1882f6c1b`. The latter contained only an
unrelated automatic monitor-data update after the preceding POD merge. Current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized Render service were re-read; no open pull
request overlapped this repair. The failed database-administration route had no
credible access-path change and was not retried.

The privileged POD schema migration already destroyed pooled PostgreSQL clients
when `BEGIN` rejected, but a rejected `COMMIT` still entered its ordinary
rollback path. A lost commit response has an ambiguous transaction outcome:
follow-up SQL cannot establish whether the schema, role or grants committed, and
returning that connection to the pool risks uncertain protocol state. The
migration now sends no follow-up SQL after a commit attempt and destroys that
client. Failures after confirmed `BEGIN` but before `COMMIT` retain normal
rollback cleanup and reusable-client behavior when rollback succeeds.

### Verification and merge

- Regression-first verification passed 7/9 focused cleanup checks and failed
  exactly the two new ambiguous-commit assertions against the prior code because
  `ROLLBACK` followed rejected `COMMIT`. The repaired focused suite passed 9/9.
- The complete local Content Control POD Node suite ran 900 tests: 892 passed,
  eight environment-dependent PostgreSQL cases skipped and zero failed. With
  the repository-pinned headless OpenCV runtime installed, the complete local
  POD Python suite passed 385/385. Syntax and whitespace checks passed.
- Review of the exact two-file diff found no material correctness, security,
  migration or pooled-client lifecycle issue.
- Exact [CC PR 732](https://github.com/wecreates/content-control/pull/732) head
  `5c767b3e8dd0bcbfc4feb97df155391ba6333baf` passed integration run
  `40470687144` and production-container run `40470687143`, including disposable
  PostgreSQL, the full POD suites, real print/review workflow and disabled
  startup. The merge endpoint returned internal errors without changing the PR;
  the already-tested head was therefore fast-forwarded to unchanged `main`
  under the exact `30b944ed4f11457e808ae2e40442d4a49767c5e3` lease. GitHub records PR
  732 merged at the identical tested head.
- Money Factory's consumer workflow was then pinned to that immutable Content
  Control head. Exact [MF PR 255](https://github.com/wecreates/Money-factory/pull/255)
  head `f64a8124fd65c5a4ce6f530e62e056c71c85d4ef` changed only the checkout pin,
  passed cross-repository run `40471555311`, and merged under its exact-head
  lease as `1377736c93bc5ec69b9dee3dca102e150e8de25f`.

### Deployment and acceptance truth

Render detected functional Content Control commit
`5c767b3e8dd0bcbfc4feb97df155391ba6333baf` and started deploy
`dep-dbg5o07f3r2c73b89fkg`, but event `evt-dbg5o05t17gc738cq4r0` reported
exhausted pipeline minutes and the deploy ended build-failed. No manual retry,
paid capacity, cache/plan change, replacement service, secret access or network
widening was attempted. No production migration was run.

This closes one ambiguous-commit connection-reuse path only. Existing code and
passing local/hosted tests are not live acceptance. All 24 acceptance areas
remain OPEN. Production database role and migrations, independently retained
recovery, hosted availability, deployed Money Factory authority, current grants
and revocation, real accounts, authorized market sources, rights, official
templates, independent review, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity, a
real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition
also keeps the POD service and production loop false. This run used only its
actually available bounded tools and did not claim a continuously running
self-hosted worker.

## Run receipt r299 — discard clients after ambiguous inbox commits (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`f666013907132128306750965e49ee1e58861b54` and Money Factory
`8e7b501d5644ce562de2a5ddbebb9796f592bf61`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized existing Render service. No open pull
request overlapped this repair. Workspace maintenance had removed the prior
scratch checkout, so relevant source and tests were reconstructed from those
immutable remote heads before editing. The failed database-administration route
had no credible access-path change and was not retried.

Money Factory's signed POD event inbox already discarded a pooled PostgreSQL
client when its initial `BEGIN` rejected, but a rejected `COMMIT` still entered
the ordinary rollback path. A commit rejection has an ambiguous transaction
outcome: follow-up SQL cannot establish whether the inbox row committed, and
returning that client to the pool risks reusing uncertain protocol state. The
inbox now sends no follow-up SQL and destroys the client after a failed commit.
Failures after a confirmed begin but before a commit attempt retain normal
rollback cleanup.

### Verification and merge

- Regression-first verification passed six of eight focused transaction checks
  and failed exactly the two new ambiguous-commit assertions against the prior
  implementation. The repaired focused suite passed 8/8.
- The reconstructed local Money Factory POD Node suite ran 121 tests: 120
  passed, one environment-dependent PostgreSQL case skipped and zero failed.
  The Python production/review suite passed 81/81, with five optional
  dependency/environment cases skipped. Syntax checks passed.
- Review of the exact published two-file diff found no material correctness,
  security or connection-lifecycle issue.
- Exact [MF PR 254](https://github.com/wecreates/Money-factory/pull/254) head
  `d2e9cf70aa7a8dbd0074c5364f0c38c70615cfca` passed cross-repository run
  `40463871761`. Every hosted stage passed, including the disposable PostgreSQL
  service-container checks, pinned Content Control contracts, locked Python
  review/rendering suites, official-template, rights, KDP pairing and
  editorial-bound checks, and the complete Money Factory Node and Python suites.
- PR 254 merged under an exact-head lease as
  `0b30a0e7b743b2a10d78b6f07fba7d6de0d46c28`.

### Deployment and acceptance truth

This Money Factory authority/inbox repair does not change the Content Control
runtime image. This durable receipt uses `[skip render]` so it must not consume
deployment capacity. The authorized Render service remains on the free plan
with automatic deployment from Content Control `main`; its latest functional
attempt remains build-failed because pipeline minutes were exhausted. No manual
retry, paid capacity, cache/plan change, replacement service, secret access or
network widening was attempted.

This closes one ambiguous-commit pooled-client reuse path only. Existing code
and passing local/hosted tests are not live acceptance. All 24 acceptance areas
remain OPEN. Production database role and migrations, independently retained
recovery, hosted availability, deployed Money Factory authority, current grants
and revocation, real accounts, authorized market sources, rights, official
templates, independent review, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity, a
real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition
also keeps the POD service and production loop false. This run used only its
actually available bounded tools and did not claim a continuously running
self-hosted worker.

## Run receipt r298 — discard uncertain Money Factory inbox clients (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`bd3fe4ac69874d70cc46596d190d69ea266d95ed` and Money Factory
`9da45e99d64d58e72f0c5be593570608c355b40b`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized existing Render service. No open pull
request overlapped this repair. The failed database-administration route had no
credible access-path change and was not retried.

Money Factory's signed POD event inbox still attempted `ROLLBACK` after its
initial `BEGIN` rejected. That could send additional SQL on a client whose
protocol state was uncertain and then return it to the pool if rollback happened
to succeed. The inbox now sends no follow-up SQL and destroys the client after a
failed transaction open. Failures after a confirmed `BEGIN` retain normal
rollback cleanup, and failed rollback still destroys the client while preserving
the original failure.

### Verification and merge

- Regression-first verification passed four of six focused transaction checks
  and failed exactly the two new failed-open assertions against the prior
  implementation. The repaired focused suite passed 6/6.
- The complete local Money Factory POD Node suite ran 119 tests: 118 passed,
  one environment-dependent PostgreSQL case skipped and zero failed. The local
  Python production/review suite passed 81/81. Syntax and whitespace checks
  passed.
- Review of the exact published two-file diff found no material correctness,
  security or connection-lifecycle issue.
- Exact [MF PR 253](https://github.com/wecreates/Money-factory/pull/253) head
  `4309de1e403e5b84e9ba8fc10fbab30e6972970d` passed cross-repository run
  `40458307916`. Every hosted stage passed, including the disposable PostgreSQL
  service-container checks, pinned Content Control contracts, locked Python
  review/rendering suites, official-template, rights, KDP pairing and
  editorial-bound checks, and the complete Money Factory Node and Python suites.
- PR 253 merged under an exact-head lease as
  `8e7b501d5644ce562de2a5ddbebb9796f592bf61`.

### Deployment and acceptance truth

This is a Money Factory authority/inbox repair; it does not change the Content
Control runtime image. The durable receipt is published with `[skip render]` and
must not consume deployment capacity. The previously inspected authorized
Render service remains quota-blocked at the last functional Content Control
merge; no manual retry, paid capacity, cache/plan change, replacement service,
secret access or network widening was attempted.

This closes one failed-open inbox client-reuse path only. Existing code and
passing local/hosted tests are not live acceptance. All 24 acceptance areas
remain OPEN. Production database role and migrations, independently retained
recovery, hosted availability, deployed Money Factory authority, current grants
and revocation, real accounts, authorized market sources, rights, official
templates, independent review, all five provider adapters, actual economics and
reconciliation, owner-phone operations, monitoring drills, measured capacity, a
real end-to-end job and controlled launch remain unverified. Etsy remained
excluded. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`
remain mandatory; no publication occurred. The checked-in Render definition also
keeps the POD service and production loop false. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r297 — isolate privileged transaction opens (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`caca2b690dde701dbb6ec56c6cf3ec8a5af7ce45` and Money Factory
`7167d57674ef524e014688b18a1551f94b9004a2`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized existing Render service. No open pull
request overlapped this repair. The failed database-administration route had no
credible access-path change and was not retried.

The earlier failed-open isolation covered ordinary managed and direct read
transactions, but the privileged migration and startup-preflight paths still
attempted `ROLLBACK` and could return a client as reusable after their initial
`BEGIN` or `BEGIN READ ONLY` request rejected. Both paths now issue no
follow-up SQL and destroy that uncertain client. Failures after a confirmed
transaction open retain rollback cleanup, and rollback failure still destroys
the client while preserving the original diagnostic boundary.

### Content Control verification and merge

- Regression-first verification passed 40 of 43 focused checks and failed
  exactly the three new failed-open assertions against the prior
  implementation. The repaired migration/preflight suite passed 43/43.
- The complete local serial POD Node suite ran 898 tests: 890 passed, eight
  environment-dependent PostgreSQL cases skipped and zero failed. Syntax and
  whitespace checks passed. A broad local Python discovery was not counted as
  acceptance evidence because that executor lacked `cv2`; the hosted gates
  below installed the locked dependencies and exercised the Python suites.
- Review of the exact published diff found no material correctness, security or
  lifecycle issue.
- Exact [CC PR 728](https://github.com/wecreates/content-control/pull/728) head
  `6a61effbb083b60720e82f090e549d5d12fc18cc` passed POD integration run
  `40450677688` and production-container run `40450677690`. The disposable
  PostgreSQL suite, locked Python QA/rendering dependencies, exact Docker build,
  non-root runtime, durable review and publication-disabled startup stages
  passed.
- PR 728 merged under an exact-head lease as
  `db1a61f9ae3c7739d70f4ad841e35a3045d9411b`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `db1a61f9ae3c7739d70f4ad841e35a3045d9411b`, with both publication flags
  explicitly false.
- Local Money Factory verification passed 116 Node tests, skipped one
  environment-dependent PostgreSQL case and failed zero; the Python
  production/review suite passed 81/81. Generated KDP fixtures remained
  `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact [MF PR 252](https://github.com/wecreates/Money-factory/pull/252) head
  `db0368b5c523687060f972ea6c34d0e941e5b648` passed cross-repository run
  `40451363630`, including pinned review, recovery, rights, template, KDP
  pairing, editorial-bound and bridge stages. It merged under an exact-head
  lease as `9da45e99d64d58e72f0c5be593570608c355b40b`.

### Authorized Render verification

- Render automatically attempted exact Content Control merge
  `db1a61f9ae3c7739d70f4ad841e35a3045d9411b` as deployment
  `dep-dbg2nkq9lscs738su7q0`.
- Deploy-start event `evt-dbg2nkprholc73fb2jl0` bound the merge at
  `2026-10-27T04:42:59.652674Z`; event
  `evt-dbg2nktgtmfc73ba2ae0` recorded `pipeline_minutes_exhausted` at
  `2026-10-27T04:42:59.697018Z`; and deploy-ended event
  `evt-dbg2nkr5h48c73ec18s0` recorded failed status at
  `2026-10-27T04:42:59.931024Z`.
- No application build or hosted rollout was verified. No manual retry, paid
  capacity, cache/plan change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes two privileged failed-open client-reuse paths only. Existing code,
passing synthetic/PostgreSQL/container tests and an attempted deployment are
not live acceptance. All 24 acceptance areas remain OPEN. Production database
role and migrations, independently retained recovery, hosted availability,
Money Factory authority, current grants and revocation, real accounts,
authorized market sources, rights, official templates, independent review, all
five provider adapters, actual economics and reconciliation, owner-phone
operations, monitoring drills, measured capacity, a real end-to-end job and
controlled launch remain unverified. Etsy remained excluded.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication occurred. The checked-in Render definition also keeps
the POD service and production loop false. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r296 — isolate direct pooled transaction opens (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`32cac8875570586a560ccc8ccea4419256f8affa` and Money Factory
`38f2043b6669dc24efa0eacbb880c66d5ecaf93d`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized existing Render service. No open pull
request overlapped this repair. The failed database-administration route had no
credible access-path change and was not retried.

The prior failed-open isolation covered `PodDB.read` and `PodDB.tx`, but four
direct pooled read transactions still attempted `ROLLBACK` and could return a
client as reusable after their initial `BEGIN ISOLATION LEVEL REPEATABLE READ
READ ONLY` request rejected. Operational metrics, capacity reporting, artifact
export and state export now destroy that uncertain client without issuing
cleanup SQL on it. Failures after a confirmed begin retain rollback semantics.
A state-export safety flag change after connection but before any begin attempt
now releases the known-clean client without sending a spurious rollback.

### Content Control verification and merge

- Regression-first verification passed 116 of 122 focused checks and failed
  exactly the six new failed-open assertions against the prior implementation.
  The repaired focused suite passed 122/122.
- The complete local POD Node suite ran 897 tests: 889 passed, eight
  environment-dependent PostgreSQL cases skipped and zero failed. Syntax and
  whitespace checks passed. Review of the exact diff found no material issue.
- Exact [CC PR 726](https://github.com/wecreates/content-control/pull/726) head
  `e2a890405fe3758a29b2bf9fe75e12437271e4ba` passed POD integration run
  `40448341268` and production-container run `40448341392`. The hosted
  PostgreSQL gate, exact Docker build, Python QA/rendering, durable review and
  publication-disabled startup stages passed.
- PR 726 merged under an exact-head lease as
  `b5be3e3d5da7f234b7a027bd1e67527ca71ea040`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `b5be3e3d5da7f234b7a027bd1e67527ca71ea040`, with both publication flags
  explicitly false.
- Local Money Factory verification passed 116 Node tests, skipped one
  environment-dependent PostgreSQL case and failed zero; the Python
  production/review suite passed 81/81. KDP fixtures remained
  `REVIEW_REQUIRED`, `production_ready=false` and `publication_enabled=false`.
- Exact [MF PR 251](https://github.com/wecreates/Money-factory/pull/251) head
  `9238084d7c09f6a724df0893426079f75c015079` passed cross-repository run
  `40449214228`, including review, recovery, rights, template, KDP pairing and
  editorial-bound stages. It merged under an exact-head lease as
  `7167d57674ef524e014688b18a1551f94b9004a2`.

### Authorized Render verification

- Render automatically attempted exact Content Control merge
  `b5be3e3d5da7f234b7a027bd1e67527ca71ea040` as deployment
  `dep-dbg2cb4s728c73er6a4g`.
- Deploy-start event `evt-dbg2cb59ljac7381q69g` bound the merge at
  `2026-10-27T04:18:52.411064Z`; event `evt-dbg2cb7bhrrc73cnmfo0`
  recorded `pipeline_minutes_exhausted` at
  `2026-10-27T04:18:52.614681Z`; and deploy-ended event
  `evt-dbg2cb7b4ihs73b20tlg` recorded failed status at
  `2026-10-27T04:18:52.839203Z`.
- No application build or hosted rollout was verified. No manual retry, paid
  capacity, cache/plan change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes four failed-open client-reuse paths only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. All 24 acceptance areas remain OPEN. Production database role and
migrations, durable retained recovery, hosted availability, Money Factory
authority, current grants and revocation, real accounts, authorized market
sources, rights, official templates, independent review, all five provider
adapters, actual economics and reconciliation, owner-phone operations,
monitoring drills, measured capacity, a real end-to-end job and controlled
launch remain unverified. Etsy remained excluded. `PUBLICATION_ENABLED=false`
and `POD_PUBLICATION_ENABLED=false` remain mandatory; no publication occurred.
This run used only its actually available bounded tools and did not claim a
continuously running self-hosted worker.

## Run receipt r295 — discard uncertain failed-open clients (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`0a96e55628690ebf26dec0a9a9ecb1c89bdc67bb` and Money Factory
`8c92e377220740e668e76e2812bc3ddb9eda8bb3`, after reading the current
completion, implementation and free-deployment records, workflow results,
relevant open pull requests and the authorized Render service. No open pull
request was already implementing this failed-open repair.

When the initial `BEGIN READ ONLY` or `BEGIN` request rejected, the managed
read and transaction helpers correctly avoided a rollback because PostgreSQL had
not confirmed an open transaction. They nevertheless returned the same pooled
client as reusable. An opening error can represent an uncertain transport or
protocol state, and neither rollback nor `DISCARD ALL` is a reliable recovery
when the transaction never opened. Both paths now destroy that client after a
failed begin attempt. Expiry detected after pool acquisition but before any begin
attempt still returns the known-clean client normally.

### Content Control verification and merge

- Regression-first focused tests passed 29/31 and failed exactly the two
  failed-open reuse assertions against the prior helper. After the repair, the
  focused read/transaction suite passed 31/31.
- The complete local serial POD Node suite passed 887 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero. Syntax and whitespace
  checks were clean.
- Exact PR #724 head
  `2fd8eca421851ff2d202aef803ed15d92f1acb5d` passed POD integration run
  `40442783990` and production-container run `40442783994`. The hosted
  PostgreSQL suite and exact production image passed without relaxing
  publication or production startup gates.
- PR #724 merged as
  `3810f7286480f62cc0f8a750442f8a28f6ce99c6`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `3810f7286480f62cc0f8a750442f8a28f6ce99c6`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact PR #250 head
  `c6aa6fb85ebda239eb164034d6a705e913873eb8` passed cross-repository run
  `40443458327`, then merged as
  `38f2043b6669dc24efa0eacbb880c66d5ecaf93d`.

### Authorized Render verification

- Render detected exact Content Control merge
  `3810f7286480f62cc0f8a750442f8a28f6ce99c6` and created deployment
  `dep-dbg1fpgae00c73fl56t0`.
- Deploy-started event `evt-dbg1fpnbhrrc73cn5a5g` recorded the merge at
  `2026-10-27T03:17:58.560737Z`; event
  `evt-dbg1fpl9ljac73818g40` recorded
  `pipeline_minutes_exhausted` at `2026-10-27T03:17:58.498311Z`; and
  deploy-ended event `evt-dbg1fpigu0ic73b49nb0` recorded failed status at
  `2026-10-27T03:17:58.850246Z`.
- No build or hosted rollout of r295 was verified. No manual retry, paid
  capacity, cache/plan change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one pooled-client failure-path gap only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. The prior database-administration route was not retried because no
credible access-path change was observed. All 24 acceptance areas remain OPEN,
including the authorized adapters and controlled launch. Etsy remained excluded.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r294 — scrub pooled PostgreSQL sessions (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`ae7a33d7a05c009e8eaa51a3dc903eb890907914` and Money Factory
`a7255d006f7ea75c89cbf2e74c97178df4c7ab51`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized Render service. No open pull request was
already implementing this pooled-session repair, so this work did not duplicate
concurrent POD work. A concurrent Money Factory monitor-only commit was
preserved as the dependent pin's base.

`PodDB.read` and `PodDB.tx` returned successfully committed or rolled-back
connections to the shared PostgreSQL pool without clearing session-scoped
configuration, advisory locks, listeners or prepared statements. A callback
could therefore use an ordinary `SELECT set_config(..., false)` to contaminate
unrelated later work. Both helpers now execute `DISCARD ALL` after a confirmed
commit or rollback and before release. Cleanup failure destroys the unsafe
client without changing a transaction result that PostgreSQL already committed.
Named callback queries fail closed with `POD_NAMED_QUERY_FORBIDDEN` so clearing
server-side prepared statements cannot desynchronize node-postgres' local
statement cache.

The first hosted implementation also forced `search_path=pg_catalog,public`
after cleanup. Real PostgreSQL integration correctly caught that a later
caller-supplied-pool migration then attempted unqualified DDL in
`pg_catalog`. That head was not merged. The corrected scrub relies on
`DISCARD ALL` to restore each connection's own startup defaults, and the
hosted regression verifies that the baseline `search_path` is preserved.

### Content Control verification and merge

- Regression-first focused tests against the prior helper reproduced both read
  and write session poisoning: 26 tests passed and the two new isolation tests
  failed. After the repair and startup-default correction, the focused
  read/transaction suite passed 31/31.
- The complete local serial POD Node suite passed 887 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero. Syntax and whitespace
  checks were clean. The local Python runner passed 264 runnable tests but lacked
  its existing `cv2` dependency for two modules; no package was downloaded.
  The pinned production container supplied that dependency and is the hosted
  Python evidence below.
- Initial PR #721 head
  `ac1ff5cc5dc3912c406b2ea93bad3b36459fad61` failed integration run
  `40440478285` because its fixed search path caused
  `permission denied to create "pg_catalog.pod_schema_version"`. That
  regression was isolated from job `121979366588`, repaired and not retried
  unchanged.
- Exact corrected PR #721 head
  `d5b6395bb437de4f722cf68daf86365666a36dac` passed POD integration run
  `40441022598` and production-container run `40441022590`. The former
  exercised the complete 895-test Node/PostgreSQL suite and the Python gates.
  The latter built the production image and passed non-root/dependency,
  Python QA/rendering, Node/PostgreSQL, durable-review and
  publication-disabled startup gates.
- PR #721 merged as
  `818df61d3041c3862d227c09e01bb623eedc4dc4`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `818df61d3041c3862d227c09e01bb623eedc4dc4`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact PR #249 head
  `71c6a412195d73822f586af2e698712d30272f73` passed cross-repository run
  `40441752922`, then merged as
  `8c92e377220740e668e76e2812bc3ddb9eda8bb3`.

### Authorized Render verification

- The authorized service remained on its existing free plan, `main` branch
  and commit-triggered deployment path. No manual deploy was requested.
- Render detected exact Content Control merge
  `818df61d3041c3862d227c09e01bb623eedc4dc4` and created deployment
  `dep-dbg177q9lscs738rdqu0`.
- Deploy-started event `evt-dbg177prholc73fa64fg` recorded the merge at
  `2026-10-27T02:59:43.894522Z`; event
  `evt-dbg177tgtmfc73b94j70` recorded
  `pipeline_minutes_exhausted` at `2026-10-27T02:59:43.973225Z`; and
  deploy-ended event `evt-dbg1787b4ihs73b1at9g` recorded failed status at
  `2026-10-27T02:59:44.245292Z`.
- No build or hosted rollout of r294 was verified. No paid capacity, cache/plan
  change, replacement service, secret access or network widening was attempted.

### Acceptance truth

This closes one pooled-session isolation gap only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. The prior database-administration route was not retried because no
credible access-path change was observed. Dedicated database, durable
storage/recovery, hybrid hosting, Money Factory authority, current
grants/revocation, account records, authorized market intelligence, concept
selection, regional-rights evidence, original generation, official templates,
KDP interiors/editorial, independent QA, remediation, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, publishing safeguards,
economics, financial reconciliation, mobile operations, monitoring, security,
measured capacity, end-to-end acceptance and controlled launch readiness all
remain OPEN. Etsy remained excluded. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted. This run used only its actually available bounded tools and did not
claim a continuously running self-hosted worker.

## Run receipt r293 — close transaction query capabilities (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`4e56b7021c2161a93e70193b8c2316c4a07d36de` and Money Factory
`0bba7f06392c439303b7775e2ef3d513b5b907e8`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized Render service. Neither repository had an
open pull request, so this repair did not duplicate concurrent POD work.

The query-only facade passed to `PodDB.tx` remained usable after its callback
returned and the pooled client was released. A callback could also start a
PostgreSQL query without awaiting it, observe the rejection itself, and let the
helper continue toward commit and report false success. The transaction helper
now binds its query capability to the callback lifetime, tracks every query
issued while that capability is open, drains outstanding work before commit
and preserves the first query failure so the transaction rolls back. Retained
query references fail closed with `POD_TRANSACTION_CLIENT_CLOSED` before they
can reach the pooled client.

### Content Control verification and merge

- Regression-first tests against the prior helper reproduced false success for
  an observed-but-unawaited query failure and allowed a retained query function
  to reach the client after commit/release.
- After the repair, the focused transaction-lifetime suite passed 13/13. The
  complete local serial POD Node suite passed 882 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero. Syntax and whitespace
  checks were clean.
- Exact PR #719 head
  `c87fed2b7835319929be6c9d425e25da4594e9c4` passed POD integration run
  `40433632346` and production-container run `40433632449`. The hosted
  PostgreSQL case started an unawaited missing-table query while observing its
  promise rejection, and the transaction still rejected and rolled back. The
  exact production image passed non-root/dependency, Python QA/rendering,
  Node/PostgreSQL, durable-review and publication-disabled startup gates.
- PR #719 merged as
  `1adef99b22048ec04ea825cc7fb49ab1b307804a`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `1adef99b22048ec04ea825cc7fb49ab1b307804a`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact PR #248 head
  `a21a90026ef9c6bb12cc6c0a3ac2f40c4e0a019e` passed cross-repository run
  `40434520957`, then merged as
  `849bc507948e4319b47475f062e2a6bdf6c0d174`.

### Authorized Render verification

- The authorized service remained on its existing free plan, `main` branch
  and commit-triggered deployment path. No manual deploy was requested.
- Render detected exact Content Control merge
  `1adef99b22048ec04ea825cc7fb49ab1b307804a` and created deployment
  `dep-dbg04g4s728c73eou45g`.
- Deploy-started event `evt-dbg04gfbhrrc73cmap3g` recorded the merge at
  `2026-10-27T01:45:37.067919Z`; event
  `evt-dbg04g9lfrss73eh1hdg` recorded
  `pipeline_minutes_exhausted` at `2026-10-27T01:45:37.333648Z`; and
  deploy-ended event `evt-dbg04gnbhrrc73cmap90` recorded failed status at
  `2026-10-27T01:45:38.345205Z`.
- No build or hosted rollout of r293 was verified. No paid capacity, cache/plan
  change, replacement service, secret access or network widening was attempted.

### Acceptance truth

This closes one transaction-query lifecycle gap only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. The prior database-administration route was not retried because no
credible access-path change was observed. Dedicated database, durable
storage/recovery, hybrid hosting, Money Factory authority, current
grants/revocation, account records, authorized market intelligence, concept
selection, regional-rights evidence, original generation, official templates,
KDP interiors/editorial, independent QA, remediation, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, publishing safeguards,
economics, financial reconciliation, mobile operations, monitoring, security,
measured capacity, end-to-end acceptance and controlled launch readiness all
remain OPEN. Etsy remained excluded. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted. This run used only its actually available bounded tools and did not
claim a continuously running self-hosted worker.

## Run receipt r292 — keep guarded reads under helper transaction control (2026-10-27 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`efcde4c5c77acaa8068cc01f0661c01d0f7ff89a` and Money Factory
`3f178780641d280454705d8056015e51f814a302`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized Render service. Neither repository had an
open pull request, so this repair did not duplicate concurrent POD work.

`PodDB.read` already forced PostgreSQL's extended protocol inside a
helper-owned read-only transaction. Extended protocol rejects multi-statement
strings, but it still accepts a standalone `COMMIT` or `ROLLBACK`; a caller
could therefore end the managed transaction before the helper's finalization.
The read path now applies the same comment-aware transaction-command guard as
the write callback path and rolls back without executing caller-supplied
transaction control.

### Content Control verification and merge

- Regression-first unit tests against the prior helper failed both new cases:
  plain `COMMIT` and comment-obscured `ROLLBACK` completed without rejection.
  After the repair, the focused read/transaction suites passed 23/23. The
  complete local serial POD Node suite passed 879 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero; syntax and whitespace
  checks were clean.
- The first hosted integration attempt, run `40430118890`, correctly exposed
  that an older protocol test began with `COMMIT` and now reached the new
  preflight guard before PostgreSQL. The fixture was separated into a
  `SELECT; UPDATE` extended-protocol assertion and an independent standalone
  `COMMIT` ownership assertion; no production behavior was relaxed.
- Exact corrected PR #717 head
  `f710244a2428bcd0d3f1333544605c50fb2bf135` passed POD integration run
  `40430353558` and production-container run `40430353513`. The hosted
  PostgreSQL test preserved the protected social-vault fixture, and the exact
  production image passed non-root/dependency, Python QA/rendering,
  Node/PostgreSQL, durable-review and publication-disabled startup gates.
- PR #717 merged as
  `d054d8da9dd906e43efb3bcc8646c643f5332048`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `d054d8da9dd906e43efb3bcc8646c643f5332048`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact PR #247 head
  `8b39bbe54860fdbec2899c73d5ca3ae816e554e3` passed cross-repository run
  `40431255518`, then merged as
  `0bba7f06392c439303b7775e2ef3d513b5b907e8`.

### Authorized Render verification

- The authorized service remained on its existing free plan, `main` branch
  and commit-triggered deployment path. No manual deploy was requested.
- Render detected exact Content Control merge
  `d054d8da9dd906e43efb3bcc8646c643f5332048` and created deployment
  `dep-dbfvktc9v7es73dsmtsg`.
- Deploy-started event `evt-dbfvktfbhrrc73cm13ug` recorded the merge at
  `2026-10-27T01:12:21.549560Z`; event
  `evt-dbfvktfbhrrc73cm13vg` recorded
  `pipeline_minutes_exhausted` at `2026-10-27T01:12:21.611897Z`; and
  deploy-ended event `evt-dbfvktagu0ic73b35740` recorded failed status at
  `2026-10-27T01:12:21.883638Z`.
- No build or hosted rollout of r292 was verified. No paid capacity, cache/plan
  change, replacement service, secret access or network widening was attempted.

### Acceptance truth

This closes one managed-read transaction-ownership gap only. Existing code,
passing synthetic/PostgreSQL/container tests and an attempted deployment are
not live acceptance. The prior database-administration route was not retried
because no credible access-path change was observed. Dedicated database,
durable storage/recovery, hybrid hosting, Money Factory authority, current
grants/revocation, account records, authorized market intelligence, concept
selection, regional-rights evidence, original generation, official templates,
KDP interiors/editorial, independent QA, remediation, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, publishing safeguards,
economics, financial reconciliation, mobile operations, monitoring, security,
measured capacity, end-to-end acceptance and controlled launch readiness all
remain OPEN. Etsy remained excluded. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted. This run used only its actually available bounded tools and did not
claim a continuously running self-hosted worker.

## Run receipt r291 — isolate managed transactions from pooled clients (2026-10-26 UTC)

### Scope and repair

Fresh reconstruction began from Content Control
`e5602324cdbce58cadd3872ec166c484a6a7a9b6` and Money Factory
`b9bb64ca9294dc69058eb9989472d640aa68acb6`, after reading the current
completion, implementation and free-deployment records, open pull requests,
workflow results and the authorized Render service. Neither repository had an
open pull request, so this repair did not duplicate concurrent POD work.

The previous `PodDB.tx` proxy guarded `query` but exposed every other member
of the underlying pooled PostgreSQL client. A callback could call `release()`
while the helper-owned transaction was open, returning that transaction to the
pool before the helper committed or rolled it back; exposed connection internals
could also bypass the guarded query path. The callback now receives a frozen,
null-prototype capability containing only the guarded `query` function.
Reading or mutating any other client control fails closed with
`POD_TRANSACTION_CLIENT_CONTROL_FORBIDDEN`.

### Content Control verification and merge

- The regression-first focused suite failed 9/10 against the prior helper
  because callback `client.release()` completed without rejection.
- After the repair, the focused transaction suite passed 10/10. The complete
  local serial POD Node suite passed 877 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero. `node --check` and
  `git diff --check` passed.
- Exact PR #715 head
  `d0e3f36f8bec02a6928d78451aa2324320a763e4` passed POD integration run
  `40422778246` and production-container run `40422778267`. The hosted
  PostgreSQL regression wrote to the protected fixture, attempted callback
  `release()`, and preserved the original row through rollback. The exact
  production image also passed non-root, Python QA/rendering, Node/PostgreSQL,
  real review-generation and disabled-startup gates.
- Guarded PR #715 merged as
  `1e952aa2c4d53cc746f4db6b5d9aa458ae2eeccf`.

### Money Factory dependent pin

- The cross-repository workflow now pins immutable Content Control merge
  `1e952aa2c4d53cc746f4db6b5d9aa458ae2eeccf`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Exact PR #246 head
  `271fa90d4ee57e3f8d0100d459656935385debfa` passed cross-repository run
  `40423651693`, then merged as
  `3f178780641d280454705d8056015e51f814a302`.

### Authorized Render verification

- The authorized service remained on its existing free plan, `main` branch
  and commit-triggered deployment path. No manual deploy was requested.
- Render detected exact Content Control merge
  `1e952aa2c4d53cc746f4db6b5d9aa458ae2eeccf` and created deployment
  `dep-dbfuj129lscs738ogldg`.
- Deploy-started event `evt-dbfuj1dgtmfc73b7ehj0` recorded the merge at
  `2026-10-27T00:00:05.296909Z`; event
  `evt-dbfuj1dt17gc738881h0` recorded
  `pipeline_minutes_exhausted` at `2026-10-27T00:00:05.386929Z`; and
  deploy-ended event `evt-dbfuj1fbhrrc73cla1p0` recorded failed status at
  `2026-10-27T00:00:05.863046Z`.
- No build or hosted rollout of r291 was verified. No paid capacity, cache/plan
  change, replacement service, secret access or network widening was attempted.

### Acceptance truth

This closes one transaction-client isolation gap only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. The prior database-administration route was not retried because no
credible access-path change was observed. Dedicated database, durable
storage/recovery, hybrid hosting, Money Factory authority, current
grants/revocation, account records, authorized market intelligence, concept
selection, regional-rights evidence, original generation, official templates,
KDP interiors/editorial, independent QA, remediation, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, publishing safeguards,
economics, financial reconciliation, mobile operations, monitoring, security,
measured capacity, end-to-end acceptance and controlled launch readiness all
remain OPEN. Etsy remained excluded. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted. This run used only its actually available bounded tools and did not
claim a continuously running self-hosted worker.


### 2026-10-22 — r190 verified receipt: review artifact media roles

Fresh reconstruction read Content Control
5ebcc5c2a6c7f04e5c311bb5b3acbac2347690ec and Money Factory
6f48cae0c80a06005e5ed7a2121bb6fc74ff579d, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 472](https://github.com/wecreates/content-control/pull/472) merged exact
tested head 696662360d83ec53621296d895b64e141e7eead4 as
5c9c1511d1e6464345cf45ab5eb80c0a06e5397c after an unchanged-base and clean-
mergeability check. Stored review downloads now derive the required media type
from every held-manifest filename that references the requested digest. PNG
roles require `image/png`, KDP PDF roles require `application/pdf`, and the
KDP receipt requires `application/json`. A digest reused across incompatible
roles fails closed. The existing exact review hold, stored-manifest identity,
manifest membership, object-size, media-allowlist and byte-hash checks remain
in force.

Regression-first verification reproduced the boundary gap: current main passed
23 of 24 release tests and failed the new assertion because an allowlisted PDF
row could satisfy a PNG manifest role. After repair, the combined package/release
suites passed 53/53, the full local POD Node suite passed 679 tests with nine
expected environment-gated skips and zero failures, and the offline review
exporter passed 18/18. Syntax and whitespace checks were clean. [Integration run
39855636927](https://github.com/wecreates/content-control/actions/runs/39855636927),
job 120093000765, and [production-container run
39855636851](https://github.com/wecreates/content-control/actions/runs/39855636851),
job 120093001297, both passed on the exact PR head. The container gate built the
production image and passed dependency/non-root, full Python,
Node/PostgreSQL, real print/durable-review and publication-disabled startup
stages.

Dependent [MF PR 144](https://github.com/wecreates/Money-factory/pull/144)
pinned cross-repository verification to CC
5c9c1511d1e6464345cf45ab5eb80c0a06e5397c while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head bcbcf381ec3cdfa42a083186ab55617ed40b7f0d merged as
70db0078463ef73415fafde990fe696e8cba9994 after a fresh exact-head/base and
mergeability check. [Cross-repository run
39856633454](https://github.com/wecreates/Money-factory/actions/runs/39856633454),
job 120096422590, passed all selected Content Control and Money Factory bridge,
review, recovery, rights, KDP and adapter-contract stages.

Render automatically attempted CC 5c9c1511d1e6464345cf45ab5eb80c0a06e5397c
as deploy dep-dbd7sm0473hc73ags3c0. Deploy-start event
evt-dbd7smnefunc73bghpt0 bound the exact merge at
2026-10-22T21:21:30.023265Z. Event evt-dbd7smhp6eoc73dujr70 reported
`pipeline_minutes_exhausted` at 21:21:30.177182Z, and event
evt-dbd7smkm702s73faudd0 recorded the failed deploy at
21:21:30.653437Z. No application build ran, so the hosted runtime remains
unverified. No manual retry, paid workaround, replacement service, credential
access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one stored-package review
boundary only; merged code and hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, revenue, publication or continuously running
self-hosted worker is claimed. This report-only receipt uses `[skip render]`;
the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r189 verified receipt: job-scoped review artifacts

Fresh reconstruction read Content Control
1e7305f835d5978e7617f557ca08c54cc0b9b49e and Money Factory
0db0ff38f9de77ceac63f4cd2e7c41c06281b18a, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 470](https://github.com/wecreates/content-control/pull/470) merged exact
tested head 0ca103f5362cc4839166eef9662486013eb9b5b0 as
66019bece346097af1dd54e433f2fba5a8ef2339 after an unchanged-base and clean-
mergeability check. Authenticated review artifact reads are now scoped to the
requested held job. One PostgreSQL read requires the exact durable
`qa_failed` / `REVIEW_REQUIRED` state, validates the stored-manifest identity,
requires the requested SHA-256 to be a manifest member, bounds its approved
media type and stored size, and verifies the returned bytes against that digest.
The legacy bearer-key-plus-unscoped-hash route fails closed. The dashboard and
offline review exporter use the scoped route.

Regression-first verification reproduced the boundary gap: the prior dashboard,
database and exporter implementations failed the new job-scoping assertions.
After repair, focused Node checks passed 65/65, exporter checks passed 18/18,
and the full local POD Node suite passed 679 tests with nine expected
environment-gated skips and zero failures. Syntax, Python byte-compilation and
whitespace checks were clean. [Integration run
39848551521](https://github.com/wecreates/content-control/actions/runs/39848551521),
job 120068257323, and [production-container run
39848551457](https://github.com/wecreates/content-control/actions/runs/39848551457),
job 120068258283, both passed on the exact PR head. The container gate built the
production image and passed dependency/non-root, full Python,
Node/PostgreSQL, real print/durable-review and publication-disabled startup
stages.

Dependent [MF PR 143](https://github.com/wecreates/Money-factory/pull/143)
pinned cross-repository verification to CC
66019bece346097af1dd54e433f2fba5a8ef2339 while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head edfa7feb6c75c5b658812bc77222afa0a7567159 merged as
6f48cae0c80a06005e5ed7a2121bb6fc74ff579d after a fresh exact-head/base and
mergeability check. [Cross-repository run
39849485202](https://github.com/wecreates/Money-factory/actions/runs/39849485202),
job 120071494151, passed all selected Content Control and Money Factory bridge,
review, recovery, rights, KDP and adapter-contract stages.

Render automatically attempted CC 66019bece346097af1dd54e433f2fba5a8ef2339
as deploy dep-dbd74obncjis73ehvukg. Deploy-start event
evt-dbd74odjqhnc73crh6p0 bound the exact merge at
2026-10-22T20:30:25.999229Z. Event evt-dbd74oib2m2c73do0f30 reported
`pipeline_minutes_exhausted` at 20:30:26.005393Z, and event
evt-dbd74okm834c73d2q26g recorded the failed deploy at
20:30:26.706696Z. No application build ran, so the hosted runtime remains
unverified. No manual retry, paid workaround, replacement service, credential
access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one authenticated
review-data boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, revenue, publication or continuously running
self-hosted worker is claimed. This report-only receipt uses `[skip render]`;
the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r188 verified receipt: exact review-hold access

Fresh reconstruction read Content Control
2d25daecffc24a268cc9c2c62ebd8129e765dcdd and the then-current Money Factory
main, the current acceptance/status/deployment documents, open PRs, workflow
results and the authorized existing Render service. No open PR overlapped this
POD work. The failed database-administration path had no credible access change,
so it was not retried.

[CC PR 468](https://github.com/wecreates/content-control/pull/468) merged exact
tested head 3e3553fd2214675ccc4348f887db57b4a54f130d as
9a622d9515e79722dbe65a5add051d433d48b69b after an unchanged-base and clean-
mergeability check. Stored package retrieval, authenticated dashboard preview
and offline review export now require the exact durable `qa_failed` /
`REVIEW_REQUIRED` hold before any artifact fetch or filesystem write. Packages
that are already QA-passed, submitted, ordinarily QA-failed or missing the hold
reason fail closed. The production end-to-end test independently verifies the
durable `qa_passed` transition after acceptance and verifies that the review
endpoint has closed.

Regression-first verification reproduced the boundary gap: the prior code
passed 45/47 focused Node checks and 17/18 exporter checks, failing the new
state assertions. The repaired focused suites passed 47/47 and 18/18; the full
local POD Node suite passed 677 tests with nine expected environment-gated skips
and zero failures. The initial hosted head exposed one stale post-acceptance test
expectation and was not merged. After correcting that assertion without weakening
the implementation, [integration run
39840393441](https://github.com/wecreates/content-control/actions/runs/39840393441),
job 120039574892, and [production-container run
39840393626](https://github.com/wecreates/content-control/actions/runs/39840393626),
job 120039561435, both passed on the replacement exact head. The container gate
built the production image and passed dependency/non-root, full Python,
Node/PostgreSQL, real print/durable-review and publication-disabled startup
stages.

Dependent [MF PR 142](https://github.com/wecreates/Money-factory/pull/142)
pinned cross-repository verification to CC
9a622d9515e79722dbe65a5add051d433d48b69b while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. To preserve
concurrent work, its branch was rebuilt on then-current Money Factory main
644d29b8efac5490784e807ad8a5aa5e5e1e60ef before testing. Exact tested head
6fea1fd12b950d1f810f81b95647a2c96adb1598 merged as
0db0ff38f9de77ceac63f4cd2e7c41c06281b18a after a fresh exact-head/base and
mergeability check. [Cross-repository run
39841549611](https://github.com/wecreates/Money-factory/actions/runs/39841549611),
job 120043586601, passed all selected Content Control and Money Factory bridge,
review, recovery, rights, KDP and adapter-contract stages.

Render automatically attempted CC 9a622d9515e79722dbe65a5add051d433d48b69b
as deploy dep-dbd6avmk1f9s738otsag. Deploy-start event
evt-dbd6avtjqhnc73cqnjq0 bound the exact merge at
2026-10-22T19:35:27.606313Z. Event evt-dbd6avsm834c73d1vvfg reported
`pipeline_minutes_exhausted` at 19:35:27.739095Z, and event
evt-dbd6b00mk0ic739uhdr0 recorded the failed deploy at
19:35:28.987797Z. No application build ran, so the hosted runtime remains
unverified. No manual retry, paid workaround, replacement service, credential
access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic review-
hold access boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, revenue, publication or continuously running
self-hosted worker is claimed. This report-only receipt uses `[skip render]`; the
runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r187 verified receipt: immutable stored-manifest identity

Fresh reconstruction read Content Control
f3acc425bf63fe45390edbb9c524a0ebb5814405 and Money Factory
c7b784e315b9b1be28d17e18791dc585155bc4f9, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 466](https://github.com/wecreates/content-control/pull/466) merged exact
tested head 7928de8a4cc4487641c39e19f6f73f6dd1e14f97 as
c75a04f7c7bf93095df198b072d85cbb94ecd7d7 after an unchanged-base and clean-
mergeability check. Production now records a separate canonical SHA-256 of the
complete persisted review manifest in the append-only POD event written with
the queue transition. The database review boundary requires the current queue
manifest to match that identity. The authenticated dashboard and offline review
exporter independently perform the same verification before fetching artifact
bytes. Legacy rows without the evidence fail closed. The producer's original
`package_sha256` remains an opaque delivery identity: PostgreSQL JSONB can
normalize numeric spellings such as `300.0` to `300`, so reconstructing the
producer's byte-level hash from parsed stored JSON is not sound.

Regression-first verification reproduced the missing identity check: the prior
focused implementation passed 43 of 45 Node assertions and failed both new
database/dashboard mutations. An initial repair that recomputed the producer
hash passed local tests but [production-container run
39834836866](https://github.com/wecreates/content-control/actions/runs/39834836866),
job 120020294928, exposed the JSONB numeric-normalization incompatibility in
the real print/durable-review stage; that head was not merged. After replacing
it with the separate stored-manifest identity, focused Node passed 45/45,
review exporter passed 17/17 and the full local POD suite passed 675 tests with
nine expected environment-gated skips and zero failures. Syntax and whitespace
checks were clean. A broader local Python discovery passed 234 tests and had two
environment import errors because the local runner lacked OpenCV; no complete
Python pass was claimed from that runner. [Final integration run
39836116744](https://github.com/wecreates/content-control/actions/runs/39836116744),
job 120024795512, and [production-container run
39836116735](https://github.com/wecreates/content-control/actions/runs/39836116735),
job 120024795936, both passed on the exact merged head. The container gate
built the production image and passed dependency/non-root, full Python,
Node/PostgreSQL, real print/durable-review and publication-disabled startup
stages.

Dependent [MF PR 141](https://github.com/wecreates/Money-factory/pull/141)
pinned cross-repository verification to CC
c75a04f7c7bf93095df198b072d85cbb94ecd7d7 while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Tested head
e59b0e7fbfe8cbdfd697db802f75b9fb29bde809 merged as
943ab97268b472632eadf81649e3d937b8e735c9 after a fresh exact-head/base and
mergeability check. [Cross-repository run
39837245135](https://github.com/wecreates/Money-factory/actions/runs/39837245135),
job 120028665093, passed all selected Content Control and Money Factory bridge,
review, recovery, rights, KDP and adapter-contract stages.

Render automatically attempted CC c75a04f7c7bf93095df198b072d85cbb94ecd7d7
as deploy dep-dbd5t8p42hec73agd8gg. Deploy-start event
evt-dbd5t94e167s73df4igg bound the new commit at
2026-10-22T19:06:12.227200Z. Event evt-dbd5t97i822c73f2j08g reported
`pipeline_minutes_exhausted` at 19:06:12.285822Z, and
evt-dbd5t97i822c73f2j0fg recorded the failed deploy at 19:06:12.882091Z. No
application build ran, so the hosted runtime remains unverified. No manual
retry, paid workaround, replacement service, credential access, widened network
or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic stored-
manifest integrity boundary only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r186 verified receipt: exact stored artifact sets

Fresh reconstruction read Content Control
6a6738d8423cbfb2d88e6be2970f4b21fd00946c and Money Factory
e6be9c8a9d0d92cb249710e6348b4cc6d78550c1, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path and exhausted Render quota had no credible
access change, so neither was manually retried or bypassed.

[CC PR 464](https://github.com/wecreates/content-control/pull/464) merged tested
head 314cc99f2e9f702933bfc32823afc15e0a886064 as
fa050268c4b0a906787c9b66b75e5e180dc86df0 after an unchanged-base and clean-
mergeability check. Stored package review now requires the exact production
artifact set before returning database records, fetching a dashboard preview or
writing an offline review export: apparel/POD packages require `art-mask.png`,
`print.png` and `text-mask.png`; KDP additionally requires `cover.pdf`,
`interior.pdf` and `interior.receipt.json`. An incomplete, extra or cross-product
manifest therefore cannot be presented as a valid review package or cause an
unexpected artifact fetch.

Regression-first verification reproduced the prior defect at all three
consumers. The focused baseline Node run passed 42 of 44 tests and failed the two
new database/dashboard assertions; the exporter baseline passed 14 of 15 and
failed the new restoration assertion. After repair, focused Node passed 44/44,
the exporter passed 16/16, and the full local POD suite passed 674 tests with
nine expected environment-gated skips and zero failures. Syntax and whitespace
checks were clean. [Integration run
39822614500](https://github.com/wecreates/content-control/actions/runs/39822614500),
job 119977539187, and [production-container run
39822614428](https://github.com/wecreates/content-control/actions/runs/39822614428),
job 119977539383, passed on the exact PR head. The container gate built the
production image and passed its non-root dependency probe, Python QA/rendering,
Node/PostgreSQL, real print/durable-review and publication-disabled startup
checks.

Dependent [MF PR 140](https://github.com/wecreates/Money-factory/pull/140)
pinned cross-repository verification to CC
fa050268c4b0a906787c9b66b75e5e180dc86df0 while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Tested head
218b995178cc2675b1b675e31c1d1f19dba95930 merged as
c7b784e315b9b1be28d17e18791dc585155bc4f9 after a fresh exact-head/base and
mergeability check. [Cross-repository run
39824128647](https://github.com/wecreates/Money-factory/actions/runs/39824128647),
job 119982775322, passed every selected Content Control and Money Factory bridge
stage, including the new database, dashboard and exporter regressions.

Render automatically attempted the runtime merge as deploy
dep-dbd4ikh42hec73ae532g. Deploy-start event evt-dbd4ikse167s73ddmshg bound
`newCommit` to fa050268c4b0a906787c9b66b75e5e180dc86df0 at
2026-10-22T17:35:15.960638Z. Event evt-dbd4il62invc73fee3n0 reported
`pipeline_minutes_exhausted` at 17:35:16.211424Z, and
evt-dbd4ilcm834c73d02cug recorded the failed deploy at 17:35:17.598180Z. No
application build ran, so the hosted runtime remains unverified. No manual
retry, paid workaround, replacement service, credential access, widened network
or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic stored-
package identity boundary only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r185 verified receipt: stored manifest review boundary

Fresh reconstruction read Content Control
72e08fd8d23e5c8b16bb845829819e3bf90fc940 and Money Factory
9051897d7ed40f84965412868b6b0ebbf8e9c86c, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 462](https://github.com/wecreates/content-control/pull/462) merged final
tested head 31cc3e6a9b04b5e53e7cbcf64b072a8cacac8e24 as
5512ddc9f6f89c413450a61d07aa43f765a05809 after an unchanged-base and clean-
mergeability check. The authenticated database review boundary now rejects
stored manifests unless they retain schema version 1, a false publication
claim, the queued supported marketplace, bounded artifact names and SHA-256
syntax, finite safe numeric values and bounded JSON depth/node counts. Invalid
stored records return only the existing unavailable result and cannot be
presented to direct or mobile API consumers as review packages.

Regression-first verification reproduced the prior defect: the database bridge
returned schema version 2, `publication_enabled: true`, malformed package/file
identities and marketplace-mismatched records. The initial focused run therefore
failed one of 22 tests. The first PR head additionally attempted to recompute a
canonical byte hash from PostgreSQL JSONB. Hosted durable-review E2E correctly
rejected that approach because JSONB preserves numeric values but not their
lexical spelling, such as `2.0` versus `2`. Initial integration run
39818107826, job 119961822830, and container run 39818107927, job 119961823624,
therefore failed before merge. The branch was amended to preserve the already-
verified stored package hash while enforcing its syntax and all other safe
structural invariants.

The final focused suite passed 22/22 tests; the full local POD suite passed 673
tests with nine expected environment-gated skips and zero failures. The
independent review-export suite passed 14/14, with syntax and whitespace checks
clean. [Final integration run
39819219114](https://github.com/wecreates/content-control/actions/runs/39819219114),
job 119965733921, and [production-container run
39819219106](https://github.com/wecreates/content-control/actions/runs/39819219106),
job 119965733300, both passed on the exact final PR head. The container gate
built the production image and passed its non-root runtime/dependency probe,
Python QA/rendering, Node/PostgreSQL, real print/durable-review and
publication-disabled startup checks.

Dependent [MF PR 139](https://github.com/wecreates/Money-factory/pull/139)
pinned verification to CC 5512ddc9f6f89c413450a61d07aa43f765a05809 and
retained the database review, dashboard and offline review-export coverage plus
explicit `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
Tested head e72e8f6f7131fda090cae2afb2b3f4c7a37b46f6 merged as
e6be9c8a9d0d92cb249710e6348b4cc6d78550c1 after a fresh exact-head/base and
mergeability check. [Cross-repository run
39820277522](https://github.com/wecreates/Money-factory/actions/runs/39820277522),
job 119969427192, passed every selected Content Control and Money Factory bridge
step. The GitHub connector's first-page workflow lookup did not surface this
new run; its exact run and job records were verified directly rather than
treating the missing connector result as success.

Render automatically attempted the runtime merge as deploy
dep-dbd46k3ncjis73ect5kg. Event evt-dbd46kcm834c73cvkjqg bound `newCommit` to
5512ddc9f6f89c413450a61d07aa43f765a05809 and reported
`pipeline_minutes_exhausted` at 2026-10-22T17:09:37.734906Z; deploy-start event
evt-dbd46ke2invc73fe0du0 followed at 17:09:37.739312Z, and
evt-dbd46ksm834c73cvkk70 recorded the failed deploy at 17:09:39.269500Z. No
application build ran, so the hosted runtime remains unverified. No manual
retry, paid workaround, replacement service, credential access, widened network
or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one stored-package API
inspection boundary only; tests and merged code are not proof of live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r184 verified receipt: stored package marketplace binding

Fresh reconstruction read Content Control
1968cc3a740991bc28339abcf0635123cc636390 and Money Factory
201213f8bcd8d0c3b710f90cce557b7193f4d06e, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 460](https://github.com/wecreates/content-control/pull/460) merged tested
head 3bddd7c1c14bcbdf23dfef6465a6161b76a40bf8 as
1fc3605e630af6c2b690a0a98eea2723472cdabb after an unchanged-base and clean-
mergeability check. Stored package review now binds the queue marketplace to
the manifest marketplace and the five supported platforms in the database
bridge, browser dashboard and offline review exporter before artifact access
or filesystem output. This prevents a corrupt or legacy self-consistent
manifest from presenting an excluded marketplace such as Etsy or a marketplace
different from the stored queue record.

Regression-first verification reproduced the defect on the prior code in all
three consumers: the database bridge accepted the mismatch, the dashboard
fetched the artifact, and the offline exporter wrote the package. The initial
focused run therefore failed two of 42 Node tests and one of 14 Python tests.
After the repair, the affected combined suite passed 58/58 Node tests and 14/14
Python tests with syntax and whitespace checks clean. The full POD suite passed
672 tests with nine expected environment-gated skips and zero failures. [PR
integration run 39813406235](https://github.com/wecreates/content-control/actions/runs/39813406235),
job 119945603794, and [production-container run
39813406166](https://github.com/wecreates/content-control/actions/runs/39813406166),
job 119945605596, both passed on the exact final PR head. The container gate
built the production image and passed its non-root runtime/dependency probe,
Python QA/rendering, Node/PostgreSQL, real print/review and
publication-disabled checks.

Dependent [MF PR 138](https://github.com/wecreates/Money-factory/pull/138)
pinned verification to CC 1fc3605e630af6c2b690a0a98eea2723472cdabb and retained
the database freshness, dashboard and offline review-export regressions plus
explicit `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
Tested head a286ba1cab09cff3ed3164298805174ae59cbcde merged as
9051897d7ed40f84965412868b6b0ebbf8e9c86c after a fresh exact-head/base and
mergeability check. [Cross-repository run
39815315096](https://github.com/wecreates/Money-factory/actions/runs/39815315096),
job 119952222064, passed every selected Content Control and Money Factory bridge
step. The GitHub connector's first-page workflow lookup did not surface these
new runs; exact run and job records were therefore verified directly rather
than treating the missing connector result as success.

Render automatically attempted the runtime merge as deploy
dep-dbd3kerncjis73bhfld0. Start event evt-dbd3kf5k3hvs73a2guh0 at
2026-10-22T16:30:52.201239Z bound `newCommit` to
1fc3605e630af6c2b690a0a98eea2723472cdabb; event
evt-dbd3kf6kvk2s73ed7k00 reported `pipeline_minutes_exhausted` at
16:30:52.545359Z, and evt-dbd3kfekvk2s73ed7ka0 recorded the failed deploy at
16:30:53.344799Z. No application build ran, so the hosted runtime remains
unverified. No manual retry, paid workaround, replacement service, credential
access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic stored-
package inspection boundary only; tests and merged code are not proof of live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r183 verified receipt: strict dashboard response JSON

Fresh reconstruction read Content Control
148c270d5481bd291a5573caa45261d4558f8540 and Money Factory
8581b16346e38101ae410f19047471098f6cd3c9, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 458](https://github.com/wecreates/content-control/pull/458) merged tested
head d6442dbcb8e9c0322693a2db7439143271dbeccb as
e45072884f2191676834044eb108a9fb3617290f after an unchanged-base and clean-
mergeability check. Authenticated dashboard package and activity responses now
pass strict UTF-8, leading-BOM, duplicate decoded-key and finite-number
validation before identity or acceptance fields are used. Invalid responses
are redacted and cannot reach artifact fetch or preview rendering. The escaped
duplicate package identity regression fetched the artifact and reached the
render path against the prior implementation.

The focused dashboard suite passed 20/20 locally. The full POD suite passed 670
tests with nine expected environment-gated skips and zero failures, with syntax
and whitespace checks clean. [PR integration run
39803746508](https://github.com/wecreates/content-control/actions/runs/39803746508),
job 119911328260, and [production-container run
39803746600](https://github.com/wecreates/content-control/actions/runs/39803746600),
job 119911327721, both passed on the exact PR head. The container gate built the
production image and passed its non-root runtime/dependency probe as well as the
Python QA/rendering, Node/PostgreSQL, real print/review and
publication-disabled checks.

Dependent [MF PR 137](https://github.com/wecreates/Money-factory/pull/137)
pinned verification to CC e45072884f2191676834044eb108a9fb3617290f and retained
the selected dashboard regression plus explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Tested head
b207f6de31498c4d58e8e4584f0d8a5b065bfa99 merged as
201213f8bcd8d0c3b710f90cce557b7193f4d06e after a fresh exact-head/base and
mergeability check. [Cross-repository run
39805015974](https://github.com/wecreates/Money-factory/actions/runs/39805015974),
job 119915787790, passed every selected Content Control and Money Factory bridge
step.

Render automatically attempted the runtime merge as deploy
dep-dbd2majncjis73bg00fg. Start event evt-dbd2mauj5dgc73a1jm8g at
2026-10-22T15:26:35.183798Z bound `newCommit` to
e45072884f2191676834044eb108a9fb3617290f; event
evt-dbd2mastuius73chl1t0 reported `pipeline_minutes_exhausted` at
15:26:35.276763Z, and evt-dbd2map12hec73b5okp0 recorded the failed deploy at
15:26:35.901022Z. No application build ran, so the hosted runtime remains
unverified. No manual retry, paid workaround, replacement service, credential
access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic
read-only dashboard boundary only; tests and merged code are not proof of live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r182 verified receipt: strict authenticated request JSON

Fresh reconstruction read Content Control
56d0e277702f81930276c3285e5c6f3ec3584da7 and Money Factory
8c08b471f7901f598a7963d9bf1e8623fbd03dd2, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 456](https://github.com/wecreates/content-control/pull/456) merged tested
head d66a2ec08287eaa029a6f7bafdc1f93f31ae98b7 as
1e3f17f216f93615ace5ec33a57e82b34c5ccd6c after an unchanged-base and clean-
mergeability check. Authenticated POD JSON request bytes now pass strict UTF-8,
duplicate decoded-key, finite-number, exact-integer and leading-BOM validation
before route logic or a database method. Verifier failures map to the fixed
`POD_REQUEST_INVALID` response. The escaped duplicate outer `payload` regression
reached the database proxy and returned 409 against the prior implementation.

The focused request, error and envelope suites passed 25/25 locally. The full
POD suite passed 669 tests with nine expected environment-gated skips and zero
failures, with syntax and whitespace checks clean. [PR integration run
39793822958](https://github.com/wecreates/content-control/actions/runs/39793822958),
job 119876183312, and [production-container run
39793822747](https://github.com/wecreates/content-control/actions/runs/39793822747),
job 119876111378, both passed on the exact PR head. The container gate built the
production image and passed its non-root dependency probe as well as the Python
QA/rendering, Node/PostgreSQL, real print/review and publication-disabled checks.

Dependent [MF PR 136](https://github.com/wecreates/Money-factory/pull/136)
pinned verification to CC 1e3f17f216f93615ace5ec33a57e82b34c5ccd6c,
added the request operations and sanitized error regressions to the selected
contract set, and retained explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Tested head
13de7366ac78f2b21787a6bbb853012379834633 merged as
8581b16346e38101ae410f19047471098f6cd3c9 after a fresh exact-head/base and
mergeability check.
[Cross-repository run
39796093765](https://github.com/wecreates/Money-factory/actions/runs/39796093765),
job 119883602210, passed every selected Content Control and Money Factory bridge
step. The job and all of its steps were complete/success before merge; GitHub's
run-level aggregate still showed `in_progress` during the known status backlog.

Render automatically attempted the runtime merge as deploy
dep-dbd1r03bc2fs7391ff70. Start event evt-dbd1r04tuius73cgodqg at
2026-10-22T14:28:16.999412Z bound `newCommit` to
1e3f17f216f93615ace5ec33a57e82b34c5ccd6c; event
evt-dbd1r0ctuius73cgods0 reported `pipeline_minutes_exhausted` at
14:28:17.036943Z, and evt-dbd1r0ctuius73cgoe1g recorded the failed deploy at
14:28:17.578792Z. No manual retry, paid workaround, replacement service,
credential access, widened network or unchanged database-administration retry
occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic request
boundary only; tests and merged code are not proof of live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r181 verified receipt: unambiguous QA failure payload

Fresh reconstruction read Content Control
1a6df07cddc4377293fc53e390636241e9ab2743 and Money Factory
90db8a19b2c5524866f6cc843a594af18c088d9d, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped this POD work. The
failed database-administration path had no credible access change, so it was
not retried.

[CC PR 454](https://github.com/wecreates/content-control/pull/454) merged tested
head 70e3d116e3c5bb0d2bd11d0b82a30cfa92842339 as
bb499b914b74dc017c1976eb2f7ac366f47cfc16 after an unchanged-base and clean-
mergeability check. A nonzero QA process may preserve a signed `FAIL` receipt
for diagnosis, but the worker previously re-read the inner signed payload with
ordinary JSON parsing before the database authenticated it. The worker now
uses the existing strict duplicate-key parser and maps an ambiguous inner
verdict to `QA_PROCESS_RESULT_CONFLICT` before the completion transaction. The
exact escaped duplicate `verdict` regression selected the later `FAIL` and
reached the completion callback against the prior implementation.

The affected envelope, QA process/expiry, failure-reason, lease, release and
production suites passed 118/118 locally, with syntax and whitespace checks
clean. [PR integration run
39784227085](https://github.com/wecreates/content-control/actions/runs/39784227085),
job 119843013539, and [production-container run
39784226865](https://github.com/wecreates/content-control/actions/runs/39784226865),
job 119843012842, both passed on the exact PR head. The container gate built the
production image and passed its non-root runtime/dependency probe as well as
the Python QA/rendering, Node/PostgreSQL, recovery and publication-disabled
checks.

Dependent [MF PR 135](https://github.com/wecreates/Money-factory/pull/135)
pinned verification to CC bb499b914b74dc017c1976eb2f7ac366f47cfc16,
added the real-subprocess `pod-qa-process` regression to the selected contract
set, and retained explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Tested head
40bd910eb65487e2e9242ba88a96e5e8d3464aef merged as
8c08b471f7901f598a7963d9bf1e8623fbd03dd2 after a fresh exact-head/base and
mergeability check. [Cross-repository run
39785346074](https://github.com/wecreates/Money-factory/actions/runs/39785346074),
job 119846943854, passed every selected Content Control and Money Factory bridge
step.

Render automatically attempted the runtime merge as deploy
dep-dbd0ohvavr4c73d5jmhg. Start event evt-dbd0ohv42ijs73bjj5c0 at
2026-10-22T13:14:47.724620Z bound `newCommit` to
bb499b914b74dc017c1976eb2f7ac366f47cfc16; event
evt-dbd0ohp12hec73b3pi1g reported `pipeline_minutes_exhausted` at
13:14:47.720564Z, and evt-dbd0oi4dthfc73do8fug recorded the failed deploy at
13:14:48.029404Z. No manual retry, paid workaround, replacement service,
credential access, widened network or unchanged database-administration retry
occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic
QA-failure routing gap only; tests and merged code are not proof of live QA or
remediation. Production restricted database/schema/migrations, retained
recovery evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real accounts/sources/rights/templates/
reviewers, authorized five-platform adapters, actual economics/reconciliation,
owner-phone acceptance, monitoring/recovery drills, measured capacity and a
real authorized end-to-end launch remain unverified. Both publication flags
remain false; Etsy remains excluded. No approval, clearance, revenue,
publication or continuously running self-hosted worker is claimed. This report-
only receipt uses `[skip render]`; the runtime repair itself did not skip CI or
deployment.


### 2026-10-22 — r180 verified receipt: unambiguous stage failure routing

Fresh reconstruction read Content Control 75d3368a52adb9eae885f481a9d878d9597213f0
and Money Factory dffa26497de14d24744d57c2e619bc44f8f9adf4, the current
acceptance/status/deployment documents, open PRs, workflow results and the
authorized existing Render service. No open PR overlapped POD work. The failed
database-administration path had no credible access change, so it was not
retried.

[CC PR 452](https://github.com/wecreates/content-control/pull/452) merged tested
head 0418cdbba58dd891410d8ed5aa46019a175b467c as
bc14163bb0e858cfbc248f6184c543596b23b09c after an unchanged-base and clean-
mergeability check. Failed Python-stage stdout now uses the existing strict JSON
parser before choosing a fixed remediation reason. Duplicate decoded `status`
or `reason_code` keys, including escaped spellings, fall back to
`PRODUCTION_BLOCKED` instead of selecting an attacker-controlled allowed repair
route. Stderr and arbitrary child text remain redacted. The exact duplicate-
status regression returned `TEXT_CLIPPED` against the prior implementation.

The affected remediation, stage-supervision, lease and production suites passed
91/91 locally, with syntax and whitespace checks clean. [PR integration run
39778084831](https://github.com/wecreates/content-control/actions/runs/39778084831),
job 119822040920, and [production-container run
39778084911](https://github.com/wecreates/content-control/actions/runs/39778084911),
job 119822041098, both passed on the exact PR head. The container gate built the
production image and passed offline dependencies, Python QA/rendering,
Node/PostgreSQL, durable review and publication-disabled startup checks.

Dependent [MF PR 134](https://github.com/wecreates/Money-factory/pull/134)
pinned verification to CC bc14163bb0e858cfbc248f6184c543596b23b09c while
retaining the selected Python-stage regression and explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Tested head
8934b4b035fcf2ea0f3bac55dd52f169b847efb1 merged as
90db8a19b2c5524866f6cc843a594af18c088d9d after a fresh exact-head/base and
mergeability check. [Cross-repository run
39779268065](https://github.com/wecreates/Money-factory/actions/runs/39779268065),
job 119826017220, passed every selected Content Control and Money Factory bridge
step.

Render automatically attempted the runtime merge as deploy
dep-dbd04gc9v7es73c1ot70. Start event evt-dbd04gdk3hvs739uve20 at
2026-10-22T12:32:01.655156Z bound `newCommit` to
bc14163bb0e858cfbc248f6184c543596b23b09c; event
evt-dbd04gctuius73cf1ipg reported `pipeline_minutes_exhausted` at
12:32:01.690914Z, and evt-dbd04gkdthfc73dnln90 recorded the failed deploy at
12:32:02.082117Z. No manual retry, paid workaround, replacement service,
credential access, widened network or unchanged database-administration retry
occurred.

All 24 live acceptance areas remain OPEN. This closes one deterministic
remediation-routing gap only; tests and merged code are not proof of a live
repair. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false; Etsy
remains excluded. No approval, clearance, revenue, publication or continuously
running self-hosted worker is claimed. This report-only receipt uses
`[skip render]`; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r179 verified receipt: unambiguous persisted package JSON

Fresh reconstruction read Content Control 1381c8f51a47da49f92128270bf4367087933063 and Money Factory eb880cb69c43a01027b113e21f72e6fc68a5cf60, the current acceptance/status/deployment documents, open PRs, workflow results and the authorized existing Render service. The Money Factory delta after r178 was an unrelated free-monitor cadence tick; no open PR overlapped POD work. The failed database-administration path had no credible access change, so it was not retried.

[CC PR 450](https://github.com/wecreates/content-control/pull/450) merged tested head fcd82c73e03cb3e37f85a9e8daa445489ad62757 as 48b31154e040c8e1ad0aa4d25996739f32c78f52 after an unchanged-base and clean-mergeability check. Hash-matching JSON package members, currently the KDP interior technical receipt, now require strict UTF-8 and reject a leading BOM, duplicate decoded keys at any depth, nonfinite numbers and integers outside JavaScript's exact range before persistence. The KDP manifest reader applies the same boundary before comparing the stored and authenticated embedded receipts. The exact duplicate-key artifact regression failed against the prior implementation.

All 122 affected artifact, production, template, lease, container-smoke and KDP package tests passed locally, with syntax and whitespace checks clean. [PR integration run 39767424379](https://github.com/wecreates/content-control/actions/runs/39767424379), job 119786225620, passed the complete disposable PostgreSQL/Python gate with zero failed steps. [Production-container run 39767424434](https://github.com/wecreates/content-control/actions/runs/39767424434), job 119786225555, passed the exact PR head, including the image build, offline dependency check, Python QA/rendering, Node/PostgreSQL suite, real print/recovery workflow and publication-disabled startup.

Dependent [MF PR 133](https://github.com/wecreates/Money-factory/pull/133) preserved the concurrent monitor tick, pinned verification to CC 48b31154e040c8e1ad0aa4d25996739f32c78f52 and added the complete package-artifact suite. Tested head 2f6d7f0f288dab6999d274c27d7d3b46908444a5 merged as dffa26497de14d24744d57c2e619bc44f8f9adf4 after an exact-head/base and mergeability check. [Cross-repository run 39768422339](https://github.com/wecreates/Money-factory/actions/runs/39768422339), job 119789579198, passed with both publication flags explicitly false.

Render automatically attempted the runtime merge as deploy dep-dbcutcuk1f9s73b3m4c0. Start event evt-dbcutctk3hvs739tru9g at 2026-10-22T11:08:35.477688Z bound newCommit to 48b31154e040c8e1ad0aa4d25996739f32c78f52; evt-dbcutcstuius73cdtmug reported pipeline_minutes_exhausted at 11:08:35.502451Z, and evt-dbcutcuj5dgc739tsnd0 reported the failed deploy at 11:08:35.85831Z. No manual retry, paid workaround, replacement service, credential access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. Production restricted database/schema/migrations, retained recovery evidence, deployed hybrid dependencies, mounted Money Factory authority/current grants and revocation, real accounts/sources/rights/templates/reviewers, authorized five-platform adapters, actual economics/reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and a real authorized end-to-end launch remain unverified. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy remains excluded. No approval, clearance, revenue, publication or continuously running self-hosted worker is claimed. This report-only receipt uses [skip render]; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r178 verified receipt: unambiguous bounded HTTP JSON

Fresh reconstruction read Content Control 5f7f77c3d517231dd15ff6217fdd306864b6f13d and Money Factory 8f5df2d54c19232f9a9cf30489afa10f691d4dc2, current acceptance/status/deployment documents, open PRs, workflow results and the authorized existing Render service. No open PR overlapped POD work. The failed database-administration path had no credible access change, so it was not retried.

[CC PR 448](https://github.com/wecreates/content-control/pull/448) merged tested head cbb540321546a97c9dbc489c1b05c31f8531453d as f5f3c2f2b153418f50eaaf7b27642cb57f321e43 after a fresh unchanged-base and clean-mergeability check. Bounded grant, outbox, startup-status and independent review-export JSON responses now require strict UTF-8, reject a leading BOM, reject recursively duplicated decoded keys and reject numeric overflow before protocol/state/file decisions. Three exact regressions failed against the prior implementation: duplicate escaped acknowledgement keys marked an event delivered, duplicate outer grant keys selected a later valid signed payload, and a duplicate review-record ID selected the requested job and created output.

All 85 affected Node transport/grant/outbox/smoke tests and all 13 Python review-export tests passed locally, with syntax and whitespace checks clean. A broader local Node run reached 649 passes; six PostgreSQL files failed only at module loading because the scratch checkout lacked the pg package, so it was not represented as a full local pass. [PR integration run 39759385247](https://github.com/wecreates/content-control/actions/runs/39759385247), job 119759460849, then installed dependencies and passed the complete disposable PostgreSQL/Python gate. [Production-container run 39759385177](https://github.com/wecreates/content-control/actions/runs/39759385177), job 119759460694, also passed the exact PR head with zero failed steps, including image QA/rendering, Node/PostgreSQL, real print/recovery and publication-disabled startup checks.

Dependent [MF PR 132](https://github.com/wecreates/Money-factory/pull/132) pinned verification to CC f5f3c2f2b153418f50eaaf7b27642cb57f321e43 and added the review-export test file beside its existing HTTP-response suite. Tested head 842d9d244b627cf34dfa9c6a069c1228cca3724c merged as 8db6fb3d88b30e81e417be0e1f700cfb1c433288 after an exact-head/base and mergeability check. [Cross-repository run 39760321299](https://github.com/wecreates/Money-factory/actions/runs/39760321299), job 119762587589, passed. Its PR/manual trigger means no redundant main dispatch was created or claimed.

Render automatically attempted the runtime merge as deploy dep-dbctv2bbc2fs738rpho0. Start event evt-dbctv2n40dgc7397hphg at 2026-10-22T10:03:54.410065Z bound newCommit to f5f3c2f2b153418f50eaaf7b27642cb57f321e43; evt-dbctv2nj6onc73c33bog reported pipeline_minutes_exhausted at 10:03:54.436216Z, and evt-dbctv2n42ijs73bh32mg reported the failed deploy at 10:03:54.899882Z. No manual retry, paid workaround, replacement service, credential access, widened network or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. Production restricted database/schema/migrations, retained recovery evidence, deployed hybrid dependencies, mounted Money Factory authority/current grants and revocation, real accounts/sources/rights/templates/reviewers, authorized five-platform adapters, actual economics/reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and a real authorized end-to-end launch remain unverified. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy remains excluded. No approval, clearance, revenue, publication or continuously running self-hosted worker is claimed. This report-only receipt uses [skip render]; the runtime repair itself did not skip CI or deployment.


### 2026-10-22 — r177 verified receipt: unambiguous encrypted recovery JSON

Fresh inspection read Content Control 1c9994a620dc670cc48ea9cd908e9ce7b5b45c4a and Money Factory 56a26249e0fc7e606eae8d63979daf7a834754e3, the three current POD acceptance/deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR was overwritten. The previously failed database administration path had no credible access change, so it was not retried.

[CC PR 446](https://github.com/wecreates/content-control/pull/446) merged tested head 3d62a5222e6c0e849be10ceb8db68732eb099f9f as 0cbe68097cc5e81fe09c058c0cdb1010fd2d4375 after a fresh unchanged-base and clean-mergeability check. Authenticated artifact catalogs, state catalogs and state-row JSON now require strict UTF-8 and reject recursively duplicated decoded keys before catalog, schema or database decisions. The three exact regressions failed against the prior implementation; the complete artifact/state suites passed 64/64 and the broader recovery/strict-JSON selection passed 85/85 locally.

[PR integration run 39754963561](https://github.com/wecreates/content-control/actions/runs/39754963561), job 119744539058, and [production-container run 39754963506](https://github.com/wecreates/content-control/actions/runs/39754963506), job 119744538951, both passed on the exact PR head with zero failed steps. The container built successfully, verified offline runtime dependencies, ran POD Python QA/rendering plus Node/PostgreSQL tests, exercised real print generation and durable review recovery, and verified hosted startup with production/publication disabled. These are disposable CI fixtures, not a retained production backup or live restoration drill.

Dependent [MF PR 131](https://github.com/wecreates/Money-factory/pull/131) pinned its workflow to CC 0cbe68097cc5e81fe09c058c0cdb1010fd2d4375 and added the artifact archive suite beside the existing state archive suite. Tested head 71d27e8f8489be38b5031f0ee7cfbca73ec67ee9 merged as 8f5df2d54c19232f9a9cf30489afa10f691d4dc2 after a fresh exact-head/base and mergeability check. [Cross-repository run 39755863008](https://github.com/wecreates/Money-factory/actions/runs/39755863008), job 119747582094, passed. Its PR/manual trigger means no redundant main dispatch was created or claimed.

Render automatically attempted the runtime merge as deploy dep-dbctese1egvs73f499a0. Start event evt-dbctesktuius73cco9lg at 2026-10-22T09:29:22.037587Z bound newCommit to 0cbe68097cc5e81fe09c058c0cdb1010fd2d4375; evt-dbctesj657ic73aneakg reported pipeline_minutes_exhausted at 09:29:22.135358Z, and deploy-ended event evt-dbctesmj5dgc739sn45g reported failure at 09:29:22.431887Z. No manual retry, paid workaround, replacement service, secret access, network widening or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. Production restricted database/schema/migrations, retained recovery evidence, deployed hybrid dependencies, mounted Money Factory authority/current grants and revocation, real accounts/sources/rights/templates/reviewers, authorized five-platform adapters, actual economics/reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and a real authorized end-to-end launch remain unverified. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy remains excluded. No approval, clearance, revenue, publication or continuously running self-hosted worker is claimed. This report-only receipt uses [skip render]; the runtime repair itself did not skip CI or deployment.

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


### 2026-10-16 — r44 checkpoint: bounded artifact recovery reads

Inspected CC 6f04c1135bd6c1d05a538dd9e161c76f226573a3 and MF ce42f709e4867905ce49550fffd530169a405965, all three acceptance/deployment documents, open PRs, workflows and the authorized existing Render service. Heads remain unchanged; no competing POD PR or AGENTS.md was found. Render's previous runtime attempt still reports build_failed, with no changed database access path. No database administration retry or duplicate dispatch was made.

Artifact-only recovery now bounds export body transfer inside PostgreSQL and compares existing restore identity using length/type/hash metadata rather than downloading existing bodies. Oversized/empty legacy rows remain errors instead of being silently skipped. The current migrated table already enforces a 16 MiB maximum; this protects export of legacy or drifted storage without weakening that constraint. Added disposable PostgreSQL coverage creates a separate deliberately legacy table, without modifying migrated constraints/triggers, and checks that a 16 MiB + 1 row never transfers through either recovery path, cannot produce a catalog and cannot be overwritten. Hosted verification pending. All 27 local archive tests pass, including new equal-length and unequal-length corruption checks; local pools do not prove PostgreSQL behavior.

Live smoke 38981633385 (job 117243595166) still fails expected/actual media hashes and watch/range/caption acceptance while health and publication-disabled checks pass. No unrelated media gate was bypassed. All 24 live POD areas remain OPEN and both publication flags false.


### 2026-10-16 — r44 verified receipt: bounded artifact recovery reads

[PR 183](https://github.com/wecreates/content-control/pull/183) merged tested da5c31d19bfe19d9fbabae4f4b7ac162da87eb92 as 114d70950bf7813f2ad7fb99ce514e961ba61c1e. Merged tree 6389bee3cd7269e02abf9162f006185e93361264 exactly matches the tested tree. Fresh head/base, clean mergeability and passing checks were verified before merge.

[PR CI 38984503100](https://github.com/wecreates/content-control/actions/runs/38984503100), job 117252693005, and [main CI 38984642135](https://github.com/wecreates/content-control/actions/runs/38984642135), job 117253140137, each passed 357 Node tests, 148 Python tests, one durable PostgreSQL/Python E2E and three guards, zero failures/skips. [Main wiring 38984642124](https://github.com/wecreates/content-control/actions/runs/38984642124), job 117253139928, passed. The actual disposable PostgreSQL fixture verified that oversized legacy export returns a null body rather than transferring bytes, restore receives metadata only, export writes no catalog, and failed restore leaves the corrupt row unchanged. Migrated restricted-role export/restore and reconnect durability still passed. This is synthetic CI evidence, not a production recovery drill.

The automatic Render attempt dep-db9bn2e7bikc73djs2dg failed at 2026-10-17T00:04:27.06427Z (October 16 locally). Its 00:04:26.871421403Z build log confirms the unchanged exhausted pipeline-minute quota. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual retry, duplicate workflow dispatch, paid workaround, replacement service or unchanged database administration retry occurred. MF remains ce42f709e4867905ce49550fffd530169a405965; this repair required no MF change.

All 24 live acceptance areas remain OPEN: restricted production database/migrations, retained storage/recovery and expiry, deployed dependencies, live MF grants/revocation, actual accounts/sources/rights/templates/reviewers, permitted marketplace adapters, real economics/reconciliation, owner-phone acceptance, monitoring drills, measured capacity and actual end-to-end evidence still need verification. Both publication flags remain false. No credentials, social-vault data, network access, spending, clearance, approvals, publication or revenue was changed or invented. Merged code and disposable CI do not establish live acceptance or a continuously running worker. This report-only receipt uses [skip render]; the runtime repair did not skip CI or deployment.


### 2026-10-16 — r45 verified receipt: bounded Money Factory authority lookup

Inspected CC 876cb6217ef41bd6690070b8090d261b0de390fd and MF 7c8e34ea7fe7faaf5d1018e5784847887186f94b, current completion/status/deployment documents, open PRs, workflow results and the authorized existing Render service. MF's intervening changes were only FREE_MONITOR_EVENTS.json and FREE_MONITOR_STATE.json. No competing POD PR was overwritten; no AGENTS.md was found in the inspected MF tree.

[MF PR 23](https://github.com/wecreates/Money-factory/pull/23) merged tested 29390e4e1e0827950aa6449c207aae3cd89cf15a as 74af2af36dbbc75a377abfa2595c7ee378925a2e. The merged tree e4fc434e31c2c961e8f36a0165507e552267e43b exactly matches the tested tree. Fresh head/base, clean mergeability and passing checks were rechecked before the guarded merge. The authority handler now bounds its server-owned snapshot lookup, propagates cancellation on timeout/disconnect, discards late results even when the event loop delays timers, and refuses invalid authority clocks. It keeps the existing redacted error response and never falls back to cached approval.

Four new regressions failed against the old handler; an additional delayed-timer regression failed before adding the monotonic deadline check. All 22 focused local tests passed afterward. [Cross-repository CI 38989886466](https://github.com/wecreates/Money-factory/actions/runs/38989886466), job 117269694308, passed 35 Node tests and two Python production-agent tests, zero failures/skips, including actual disposable PostgreSQL delivery/rollback/retry checks. The workflow now pins CC 876cb6217ef41bd6690070b8090d261b0de390fd. Its trigger is PR/manual rather than push; no redundant main dispatch was created or claimed.

The loader contract now accepts loadSnapshot(jobId, {signal}), with a default five-second lookup deadline and validated 1–10,000 ms override. The host must honor cancellation and bound its own connections/queries; this handler cannot preempt synchronous JavaScript or forcibly stop an uncooperative backend. The live MF authority host/current snapshot source is still not mounted by this change. Synthetic signatures and successful tests are not real grants or deployment acceptance.

Render remains the existing free Docker service. Its latest attempt is still dep-db9bn2e7bikc73djs2dg, build_failed at 2026-10-17T00:04:27.06427Z; the previously verified build-minute blocker has no changed access path. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. This MF change does not deploy through CC's Render service. No manual deploy, database administration retry, network expansion, credential creation, paid workaround or replacement service was attempted.

All 24 live acceptance areas remain OPEN: production database/migrations, durable retention/recovery/expiry, deployed dependencies, current MF authority/grants/revocation, real account/source/rights/template/reviewer evidence, permitted adapters, actual economics/reconciliation, owner-phone acceptance, monitoring drills, measured capacity and real end-to-end evidence remain unresolved. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No live clearance, approval, publication, revenue or continuously running worker is claimed. This CC receipt changes documentation only and uses [skip render]; MF's runtime PR ran its normal cross-repository CI.


### 2026-10-17 — r46 verified receipt: configured credential isolation and current bridge compatibility

Read CC bda7919ab03928cd6d7b8409795debacebcb2f6f and MF 74af2af36dbbc75a377abfa2595c7ee378925a2e, the current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. Both heads were unchanged from the previous receipt; unrelated open work was preserved and no competing POD PR was duplicated. No AGENTS.md was present in the inspected CC tree.

[CC PR 186](https://github.com/wecreates/content-control/pull/186) merged tested 812430d81a8308c444d271ef2cdcb2da9242ba72 as ec034eae057206120a8b2d0b14c0e62412dc032a. The merged tree fa57dd6454f71970e10ed755d3fac76107a0c521 exactly matches the tested tree. Preflight previously accepted reused credentials, and startup compared only upstream/QA/operations keys. A shared policy now rejects weak or reused configured intake, finance, market, provider, registry, rights, template, competitive-review, source, editorial, grant-transport and outbox credentials as well. It compares the actual UTF-8 HMAC bytes, reports only POD_KEY_ISOLATION PASS/BLOCKED and requires explicit passing isolation evidence at startup. Optional absent/empty keys leave those lanes unavailable; they do not enable features. Archive encryption custody and standalone Python-tool deployment remain separate. See [KEY_ISOLATION.md](integrations/pod/KEY_ISOLATION.md).

Three regression tests failed against the prior implementation; all 24 focused local tests passed after repair. [PR integration run 38992101973](https://github.com/wecreates/content-control/actions/runs/38992101973), job 117276514731, and [merged-main integration run 38992213122](https://github.com/wecreates/content-control/actions/runs/38992213122), job 117276848733, each passed 361 Node tests, 148 POD Python tests, one durable PostgreSQL/Python end-to-end test and three workflow guards, with no failures or skips. [Merged-main System Wiring Audit 38992213117](https://github.com/wecreates/content-control/actions/runs/38992213117), job 117276848828, passed. These are disposable fixtures, not independent reviewer credentials or live security acceptance.

Dependent [MF PR 24](https://github.com/wecreates/Money-factory/pull/24) pins cross-repository verification to CC ec034eae057206120a8b2d0b14c0e62412dc032a and records the credential contract and the prior MF authority lookup evidence. Tested 4130b015e4b039e072f1d43e43bd96486170a55c merged as 123e67a7c3796ae87a85d176535fab98bd4090f9, with identical tested/merged tree 085e013d5e869b7f2e60b1235f89afe8bace7a7b. [Cross-repository run 38992242395](https://github.com/wecreates/Money-factory/actions/runs/38992242395), job 117276938722, passed 35 Node and two Python tests, zero failures/skips, including disposable PostgreSQL grant/event/rollback/retry and review-production checks. Fresh exact head/base, passing checks and clean mergeability were verified before both guarded merges. The MF workflow runs on PR/manual, so no redundant main dispatch was created or claimed. This does not mount the authoritative host or provide real current approvals.

Render automatically attempted CC ec034eae057206120a8b2d0b14c0e62412dc032a as dep-db9d6h9srm7s739f8e70 and reported build_failed at 2026-10-17T01:45:41.788995Z. Its build log at 01:45:41.639101938Z explicitly says the workspace has exhausted build pipeline minutes for the billing period. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. [Live smoke 38991340059](https://github.com/wecreates/content-control/actions/runs/38991340059), job 117274187267, observed publication disabled and green health, but failed expected/actual candidate hashes plus watch/range/captions checks. Those failures were retained; neither new repair nor all-POD readiness is verified deployed. No manual redeploy, paid workaround, replacement service or repeated database administration attempt was made; no credible changed database access path was available.

All 24 acceptance areas remain OPEN. Next live dependencies still include restricted database/schema/checksums, durable retention and recovery before storage expiry, deployed runtime dependencies, mounted MF authority/inbox and actual current grants/revocation, real account/source/rights/template/reviewer evidence, permitted five-platform adapters, actual economics and reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and real authorized end-to-end evidence. Local key separation cannot establish secret entropy, independent custody or rotation. No credentials, clearances, approvals, revenue, publication or continuous self-hosted worker were invented. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy stays outside this lane. This documentation-only receipt uses [skip render]; runtime and cross-repository changes ran normal CI. The build quota limitation remains unresolved and does not constitute verified completion.


### 2026-10-17 — r47 verified receipt: cooperative cancellation of task restoration

Fresh inspection found CC ab23d95ce08bd381adfba379926d7e2e3b9bc8bf and MF 123e67a7c3796ae87a85d176535fab98bd4090f9 unchanged from the prior receipt. Read the current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR was present; unrelated work was preserved. The previously inspected database administration path had no credible change, so it was not retried.

[CC PR 188](https://github.com/wecreates/content-control/pull/188) merged tested 00ec25cc9fe7384bd51f376a34d631e805f2d9cf as 5ee9dec4889d1c8c6b2151bafea46f11442e9947. Exact tested and merged tree: d033a841f734b1f031cae5069dc97fdbcfb4b7ee. The production coordinator now passes its stop signal to resolveTask(job, {signal}) and checks shutdown after a delayed claim, initial grant and task resolution. The stored resolver checks cancellation around descriptor/input reads, workspace creation and file writes, removes partial workspaces, and returns the fixed PRODUCTION_STOPPED reason instead of continuing to restore remaining inputs. Arbitrary abort details are not persisted. Existing grant, rights, lease and fencing requirements remain enforced. See [TASK_CANCELLATION.md](integrations/pod/TASK_CANCELLATION.md).

Four regressions failed against the previous implementation. All 32 focused local task/lease/worker/current-authority tests passed after repair; an additional test verified cleanup after cancellation during the final real filesystem write. [PR integration run 38998098329](https://github.com/wecreates/content-control/actions/runs/38998098329), job 117295000041, and [merged-main integration run 38998193329](https://github.com/wecreates/content-control/actions/runs/38998193329), job 117295300463, each passed 366 Node tests, 148 POD Python tests, one durable PostgreSQL/Python end-to-end fixture and three workflow guards, with zero failures/skips. [Merged-main System Wiring Audit 38998193202](https://github.com/wecreates/content-control/actions/runs/38998193202), job 117295300070, passed. Fresh exact head/base, clean mergeability and successful checks were verified before the guarded merge.

Cancellation is cooperative: an already-running database read or filesystem write settles before workspace cleanup. This repair does not preempt PostgreSQL, impose a new pool deadline or promise instantaneous shutdown. Host-provided one-argument resolvers remain compatible but must honor the optional signal to stop their own work. Expired claims still cannot be updated by late workers; cancellation is not a new grant or automatic retry approval. Real capacity, recovery drills and independent QA acceptance are not established by synthetic tests.

Render automatically attempted 5ee9dec4889d1c8c6b2151bafea46f11442e9947 as dep-db9ehdbrjlhs73bl1uh0, build_failed at 2026-10-17T03:17:10.214396Z. The 03:17:10.050557645Z build log explicitly confirms exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. The existing free Docker service, workspace, account configuration and publication switches were not changed. No duplicate deploy, replacement service, paid workaround, network widening or repeated database administration attempt was made. MF remains at 123e67a7c3796ae87a85d176535fab98bd4090f9; its latest cross-repository run 38992242395 is still successful against the earlier pinned CC commit, and no new MF execution or deployment is claimed.

All 24 live acceptance areas remain OPEN. Outstanding evidence still includes restricted production database/schema access and checksums, durable storage/expiry/restore, deployed hybrid dependencies, mounted current MF authority/inbox and actual grants/revocation, owner-authorized accounts and market sources, current regional rights and official templates, substantive KDP editorial/preview approval, independent QA and repair outcomes, permitted adapters for all five platforms, actual economics/financial reconciliation, owner-phone operations, monitoring/recovery drills, measured capacity and real end-to-end acceptance. No credentials, rights clearances, approvals, tests, revenue or completion were invented. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy remains excluded. This execution is not a continuously running self-hosted worker. The report-only receipt uses [skip render]; the runtime repair ran normal CI and its automatic deployment result is recorded above.


### 2026-10-17 — r48 verified receipt: technical QA inspects captured package bytes

Fresh inspection found CC ea02618814047faa17c8ceacfe0084d56c4fd4c7 and MF 123e67a7c3796ae87a85d176535fab98bd4090f9 unchanged from the previous receipt. Read the current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR or changed database access path was found. Unrelated open work was preserved, and database administration was not retried.

[CC PR 190](https://github.com/wecreates/content-control/pull/190) merged tested 5f9a5c76c812825f79f24d8230bf5a5d70e16799 as 05b6d0c804ae23a6546b5791e1851e8b5529df70. Exact tested/merged tree: d52acd5ac77b4964988416d0c3a43e5edea1de64. QA previously hashed package paths and reopened them later for raster, OCR, PDF and optional model checks. A pixel-mutation regression demonstrated inspection of changed pixels under the earlier hash. QA now captures hash-verified package bytes and the reference into a private temporary workspace, then performs all those inspections on the copies. The manifest is captured by the existing bounded JSON reader. Hashes and the actual inspected bytes stay together even if original paths are changed or removed. Current signed rights, competitive/editorial review and expiry checks remain mandatory; no review is fabricated. See [QA_SNAPSHOT.md](integrations/pod/QA_SNAPSHOT.md).

The snapshot contract accepts 1–32 flat generated filenames, 16 MiB per artifact, 64 MiB per package, and a separate 16 MiB reference cap. It validates names/hash types before reads, rejects non-regular descriptors and final symlink substitution, bounds reads even after file growth, verifies each captured digest, and cleans up on success or failure. Nested package filenames are unsupported. This adds bounded temporary disk usage, not durable storage or independent reviewer acceptance.

Local verification passed all 20 evidence/snapshot tests plus one mutation regression with both general POD and KDP subcases. OpenCV is unavailable locally: that focused regression used an import-only OpenCV stub and mocked OCR/geometry to isolate byte identity; it was not claimed as a local full-vision run. The hosted suite used its normal installed OpenCV/OCR/PDF dependencies. [PR integration run 38999919314](https://github.com/wecreates/content-control/actions/runs/38999919314), job 117300475098, and [merged-main integration run 39000028691](https://github.com/wecreates/content-control/actions/runs/39000028691), job 117300799141, each passed 366 Node tests, 157 POD Python tests, one durable PostgreSQL/Python end-to-end fixture and three workflow guards, with zero failures/skips. [Merged-main System Wiring Audit 39000028704](https://github.com/wecreates/content-control/actions/runs/39000028704), job 117300799108, passed. Fresh exact head/base, successful checks and clean mergeability were rechecked before the guarded merge.

Render automatically attempted 05b6d0c804ae23a6546b5791e1851e8b5529df70 as dep-db9eushsrm7s739gd6l0 and reported build_failed at 2026-10-17T03:45:55.623039Z. Its 03:45:55.353142811Z build log explicitly reports exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, paid workaround, replacement service, secret access, network expansion or repeated database administration was attempted. MF remains at 123e67a7c3796ae87a85d176535fab98bd4090f9; its latest successful cross-repository run remains 38992242395 against its earlier pinned CC revision, with no new MF execution or deployment claimed.

All 24 live acceptance areas remain OPEN: actual production database role/schema/checksums, durable retention/expiry/recovery, deployed hybrid dependencies, mounted current MF authority/inbox and real grant/revocation behavior, account/source/rights/template evidence, substantive KDP editorial/preview acceptance, calibrated independent QA and remediation, permitted five-platform adapters, actual economics and provider reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and real end-to-end evidence remain unresolved. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy stays excluded. Synthetic test signatures are not clearances, approvals, revenue or live completion. This execution is not a continuously running self-hosted worker. The report-only receipt uses [skip render]; the actual runtime repair ran normal CI and its deployment outcome is recorded above.


### 2026-10-17 — r49 verified receipt: outbox storage cutoff and cross-repository recovery

Fresh inspection found CC 60cd1022ab9f9c08007920eae182f85d5b87e174 and MF 1ff9d7561f31745586ac9afac7fa64a69b58bf47. Read the current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. MF's only intervening change was FREE_MONITOR_EVENTS.json and FREE_MONITOR_STATE.json; it was preserved. No competing POD PR or AGENTS.md was found. There was no credible changed database administration path, so the failed connector/browser path was not retried.

[CC PR 192](https://github.com/wecreates/content-control/pull/192) merged tested 15c8a06e572c65dfeb127472629294a64724acd9 as c11f17968fea7d8e41d2d58d31c5762f917639ae, with identical tested/merged tree 5b95a994ef0942b4f81c85f4b31a8d6b2635158d. The outbox previously checked storage only before selecting a page. If selection or an earlier response crossed the existing 24-hour storage safety cutoff, continueOnError could keep sending later events even though acknowledgement transactions rejected storage access. The sender now checks the real storage gate before every HTTP send and before batch completion, including empty pages and final response/commit waits. The storage error stops the batch rather than becoming a skippable event failure. See [OUTBOX_STORAGE_CUTOFF.md](integrations/pod/OUTBOX_STORAGE_CUTOFF.md) for in-flight ambiguity, stable-ID retry, retained acknowledgements, cursor and partial-counter limits.

Four regression tests failed against baseline. All 24 focused local outbox/HTTP tests pass after repair, including six controlled-clock cases using the real PodDB.active/tx methods with injected database/HTTP operations. [PR integration 39005696540](https://github.com/wecreates/content-control/actions/runs/39005696540), job 117317604517, and [merged-main integration 39005815406](https://github.com/wecreates/content-control/actions/runs/39005815406), job 117317956898, each passed 372 Node tests, 157 POD Python tests, one durable PostgreSQL/Python E2E and three workflow guards, with zero failures/skips. [Merged-main System Wiring Audit 39005815407](https://github.com/wecreates/content-control/actions/runs/39005815407), job 117317957038, passed. Exact current head/base, passing checks and clean mergeability were verified before the guarded merge.

Dependent [MF PR 25](https://github.com/wecreates/Money-factory/pull/25) merged tested 05b71a50e340df3288d5dfaf44a5632514e372ed as eef041dca8ec84233663aa69ffb3a2a22bced30c, with identical tested/merged tree d42d6e7cb76db49d8f266b30eed6d711be49eee7. It pins CC c11f17968fea7d8e41d2d58d31c5762f917639ae and extends the actual PostgreSQL/local-HTTP bridge test. After the receiver commits the first event, the disposable sender crosses its safety cutoff: the second event is not sent, both sender rows remain pending and only the first inbox row exists. After restoring only the disposable fixture's expiry, unchanged-ID retries acknowledge both sender rows with exactly two inbox rows. No production expiry or real approval was extended. [Cross-repository run 39005835396](https://github.com/wecreates/Money-factory/actions/runs/39005835396), job 117318016268, passed all 35 Node and two Python tests with zero failures/skips, including this scenario and existing lost-response, concurrent duplicate, replay conflict, lock/statement timeout and rollback/retry checks. Local MF verification was syntax-only; actual database evidence comes from that hosted run. Its exact head/base, clean mergeability and successful checks were rechecked before merge. The workflow is PR/manual, so no duplicate main dispatch was created or claimed.

Render automatically attempted CC c11f17968fea7d8e41d2d58d31c5762f917639ae as dep-db9gaiflk1mc73bu1ut0 and reported build_failed at 2026-10-17T05:19:05.928385Z. The 05:19:05.748047326Z build log explicitly confirms exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. [Live smoke 39001736425](https://github.com/wecreates/content-control/actions/runs/39001736425), job 117305917082, observed green health and publication disabled but failed expected/actual candidate hashes and watch/range/caption checks. No unrelated media gate was bypassed. No manual build retry, paid workaround, replacement service, secret disclosure, network expansion or repeated database administration was attempted.

All 24 live acceptance areas remain OPEN. Restricted production database/schema/checksums, durable storage retention/expiry/restore, deployed hybrid dependencies, mounted current MF authority/inbox and real grant/revocation behavior, actual accounts/sources/rights/templates/reviewers, substantive KDP editorial/preview acceptance, real remediation, permitted five-platform adapters, actual economics/provider reconciliation, owner-phone acceptance, monitoring/recovery drills, measured capacity and real end-to-end evidence remain unresolved. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy is excluded. Synthetic fixtures are not credentials, clearances, approvals, revenue or live completion. This execution is not a continuously running self-hosted worker. This report-only receipt uses [skip render]; the runtime repair ran normal CI and its automatic deployment outcome is recorded above.


### 2026-10-17 — r50 verified receipt: production-image coverage

Fresh inspection found CC 4b6beb4ddd2674034665c86c86666fe433a53618 and MF eef041dca8ec84233663aa69ffb3a2a22bced30c unchanged after r49. Read the current completion/status/free-deployment documents, open PRs, workflow results and authorized Render service. No competing POD PR or changed database administration path was found. The previous outbox and bridge tests remained successful; the deployment quota blocker remained unresolved. No database administration retry was made.

The outcome review identified a concrete gap in acceptance area 3: the container gate only triggered for image configuration changes, while POD application changes were tested on the host runner. The bounded corrective action was to extend the existing image gate and execute its full POD tests in the production image. No new worker, service or scheduled job was created.

[CC PR 194](https://github.com/wecreates/content-control/pull/194) merged tested e8ea1d036ada1d13f6072c7e3ce5fde55884daea as fafe0497ecbf4ab80bcc5dbf82c08cc48553804c. Tested and merged tree are identical: 732b7f9d623eef103c21e9e744b8dac4eb51c466. The gate now covers POD runtime/tests/migrations, Node manifests and the web entry point as well as Docker configuration. POD Markdown-only edits are excluded, and superseded runs on one PR are cancelled. It verifies the configured non-root UID, installed Python/OCR dependencies, all POD Python tests without networking, Node/PostgreSQL tests, the durable review E2E and disabled-state startup inside the image. POD_FREE_DEPLOYMENT.md documents this scope and its limits.

[Container run 39006783121](https://github.com/wecreates/content-control/actions/runs/39006783121), job 117320761543, passed. Docker built local image ID sha256:4fecdca06375e2e8744653b88f2d03cdf7e13ed12a2a26e7bd8a2d143a80c1c5. The UID 10001/dependency probe passed; all 157 POD Python tests passed with networking disabled; 372 Node tests and the separate one-test durable PostgreSQL/Python E2E passed with zero failures/skips. The app startup check passed with publication false and production DISABLED. PostgreSQL was the workflow's disposable local service, not production. The image was not pushed to a registry or deployed by this gate. Local validation only parsed YAML because Docker is unavailable in the execution environment; no local image execution was claimed.

Fresh current head/base, successful checks and clean mergeability were rechecked before the guarded merge. [Merged-main System Wiring Audit 39006944583](https://github.com/wecreates/content-control/actions/runs/39006944583), job 117321229028, passed. The container gate remains PR/manual; the tested tree equals the merged tree, and no redundant main image dispatch was created. MF stayed at eef041dca8ec84233663aa69ffb3a2a22bced30c. Its prior successful cross-repository run remains 39005835396; this workflow-only CC change did not alter its bridge contract or require another MF pin.

| Activity | Prior outcome | Current outcome | Valid progress class |
|---|---|---|---|
| Current POD production image | Recent POD changes passed host-installed integration suites; container trigger omitted those paths | Exact current source tree built and passed full POD suites under the production image's non-root user | Verified build/runtime test evidence |
| Live Render deployment | Older revision live; workspace build quota exhausted | Unchanged; new automatic attempt failed for the same quota | No live completion confirmed |
| All 24 acceptance areas | OPEN | OPEN | No acceptance row promoted by CI |

Render automatically attempted fafe0497ecbf4ab80bcc5dbf82c08cc48553804c as dep-db9gj7m7bikc73dnhbag and reported build_failed at 2026-10-17T05:37:34.695113Z. Its 05:37:34.430675556Z build log explicitly reports exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, spend increase, replacement service, secret disclosure, network widening or repeated database administration attempt occurred. The image gate does not reset Render quota or establish a continuously running self-hosted worker.

All 24 live acceptance areas remain OPEN. The restricted production database/schema/checksums, durable retention/expiry/restore, actual deployment and availability, live MF authority/inbox and current grants/revocation, real account/source/rights/template/reviewer evidence, substantive KDP/editorial/preview acceptance, remediation and authorized five-platform adapters, actual economics/provider reconciliation, owner-phone operations, monitoring/recovery drills, measured capacity and real end-to-end evidence still need verification. Both publication flags remain false; Etsy remains excluded. No credentials, approvals, clearances, revenue or completion were invented. The next live step requires a materially changed deployment/access prerequisite; repeated unchanged database attempts and synthetic acceptance claims remain prohibited. This report-only receipt uses [skip render]; the gate repair used normal CI and its automatic deployment outcome is recorded above.


### 2026-10-17 — r51 verified receipt: bounded POD image startup

Fresh inspection found CC 6b63e1089ac5c4428afa351a50be9e6ed303a5d0 and MF eef041dca8ec84233663aa69ffb3a2a22bced30c. Read current completion/status/free-deployment documents, MF bridge documentation, open PRs, workflow results and the authorized Render service. No competing POD PR or AGENTS.md was found. Database access prerequisites had not materially changed, so database administration was not retried.

[CC PR 196](https://github.com/wecreates/content-control/pull/196) merged tested b1dce912088b5c973bdb3b85039ca29bd1f69b48 as 987fdcc788078d114788e80251383ae0e57d537a. Exact tested/merged tree: 27aac5a85cd95301d7c748ac305243ea3548c358. The image gate previously polled the video acceptance /health route, continued after all unsuccessful polls and asserted only two POD fields. An isolated reproduction confirmed those two assertions accepted publication_requested=true and a RUNNING outbox. The replacement probes /api/print/status directly with a 60-second monotonic deadline, bounded requests and 64-KiB strict UTF-8/JSON body. It rejects redirects, non-200/malformed/oversized responses and requires disabled service, production and outbox, publication neither enabled nor requested, and unverified adapters. Unsafe responses fail immediately. The test port now binds only to loopback. Render's configured health route and separate live smoke were not changed.

All 18 local real-HTTP tests pass, covering delayed/refused startup, stalled headers/body, unsafe/missing/incorrectly typed flags and invalid responses. [PR integration 39012405782](https://github.com/wecreates/content-control/actions/runs/39012405782), job 117337530999, passed 390 Node tests, 157 POD Python tests, one durable PostgreSQL/Python E2E and three workflow guards, with zero failures/skips. [Production-image gate 39012405645](https://github.com/wecreates/content-control/actions/runs/39012405645), job 117337530499, built local image sha256:0c0198a8866200bb731b083d32fce6cce29827a343bf381f7b8b3fa1e531314d and passed UID/dependency checks, 157 Python tests without networking, 390 Node tests, one durable E2E and the new actual-app startup probe. No image was pushed or deployed by CI. Docker is unavailable locally; image evidence comes from the hosted gate. Fresh exact head/base, successful checks and clean mergeability were verified before merge.

[Merged-main integration 39012535077](https://github.com/wecreates/content-control/actions/runs/39012535077), job 117337915424, also passed 390 Node tests, 157 POD Python tests, one durable E2E and three workflow guards with zero failures/skips. [Main System Wiring Audit 39012535078](https://github.com/wecreates/content-control/actions/runs/39012535078), job 117337915538, passed. The image gate remains PR/manual; the merged tree matches the tested image source, so no duplicate main image dispatch was made.

The automatic Render attempt dep-db9htv3m8hqs73agvarg for 987fdcc788078d114788e80251383ae0e57d537a reported build_failed at 2026-10-17T07:08:45.321217Z. Its 07:08:45.130654434Z log explicitly confirms exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, spend/plan change, replacement service, secret access or network expansion occurred. The existing [live smoke 39009017984](https://github.com/wecreates/content-control/actions/runs/39009017984), job 117327316307, observed green health/publication disabled but failed candidate identity and watch/range/caption checks; those unrelated video gates were preserved.

MF remains at eef041dca8ec84233663aa69ffb3a2a22bced30c; prior cross-repository run 39005835396 remains its latest POD verification. This CC image-test change alters no bridge contract, so no duplicate MF pin/PR/job was created. Image startup verification improved; live deployment and all 24 acceptance areas remain OPEN. Restricted database/schema, durable retention/expiry/recovery, current live MF authority/grants, actual account/source/rights/template/editorial/reviewer evidence, permitted five-platform adapters, financial reconciliation, owner-phone operations, recovery drills, measured capacity and actual end-to-end acceptance remain outstanding. Both publication flags remain false; Etsy is excluded. Synthetic tests do not establish approvals, clearances, revenue or a continuously running self-hosted worker. The receipt is report-only and uses [skip render]; implementation used normal CI.


### 2026-10-17 — r52 verified receipt: cooperative independent-review cancellation

Fresh inspection found CC 5b62bc423b457a57068caa02b8c01f15d64bea8c and MF eef041dca8ec84233663aa69ffb3a2a22bced30c, unchanged since r51. Read the current completion/status/free-deployment documents, open PRs, workflow results and authorized existing Render service. No competing POD PR or AGENTS.md was found. The database access path had not materially changed; no repeated administration attempt was made.

[CC PR 198](https://github.com/wecreates/content-control/pull/198) merged tested 0c80dbec859f64441bc1e5c195e214361c9fe434 as 5b468542db80497084e418628d43513aa7db7db7. Exact tested/merged tree: 68f6ceccb8cc17fbf953b680c2ef2afd71316263. The optional independent-review callback previously received no cancellation signal. It now receives reviewPackage(manifest, {signal}) with the same worker signal used for task/grant resolution. After resolution or rejection, the coordinator rechecks the production switch and cancellation, records the existing fixed PRODUCTION_STOPPED reason when stopped, and discards late attestations before accessing their paths or launching QA. Callback settlement is still awaited before workspace cleanup. One-argument host reviewers remain callable.

Three regression tests failed on baseline. All 35 focused local worker/template tests pass after repair, including six new review cases covering signal propagation, abort/disable rejection, late-result discard and ordinary-error redaction. Their child stages and signed records are synthetic coordinator fixtures, not independent QA or marketplace evidence. [PR integration 39016445526](https://github.com/wecreates/content-control/actions/runs/39016445526), job 117349434547, passed 396 Node tests, 157 POD Python tests, one durable PostgreSQL/Python E2E and three workflow guards, with zero failures/skips. [Production-image gate 39016445541](https://github.com/wecreates/content-control/actions/runs/39016445541), job 117349434578, built local image sha256:26ac85b6924a198685a891f776831e1483003701d547d214f9f12ecc6127b479 and passed UID/dependencies, 157 Python tests without networking, 396 Node tests, the durable E2E and disabled-state startup. No image was pushed or deployed by CI; Docker is unavailable locally.

Fresh exact head/base, clean mergeability and passing PR checks were verified before the guarded merge. [Merged-main integration 39016573975](https://github.com/wecreates/content-control/actions/runs/39016573975), job 117349808593, also passed 396 Node tests, 157 POD Python tests, one durable E2E and three workflow guards with zero failures/skips. [Main System Wiring Audit 39016573858](https://github.com/wecreates/content-control/actions/runs/39016573858), job 117349808471, passed. The image gate remains PR/manual and its tested source tree matches the merge; no redundant image dispatch was made.

The automatic Render attempt dep-db9iseoae00c738so7ag for 5b468542db80497084e418628d43513aa7db7db7 reported build_failed at 2026-10-17T08:13:49.390568Z. Its 08:13:49.211629732Z log explicitly confirms exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, spend/plan increase, replacement service, secret disclosure, network widening or database retry occurred. MF remains unchanged; no bridge grant/event contract changed and no duplicate MF pin or job was created.

The cancellation contract and limits are documented in integrations/pod/TASK_CANCELLATION.md. A reviewer that ignores its signal can still delay shutdown, and host review I/O, database work and cleanup require their own bounds. No forced callback deadline, live reviewer, approval, production configuration or automatic review pass was created. The default stored resolver still holds packages for independent review.

All 24 live acceptance areas remain OPEN. Production role/schema/preflight, durable storage retention/expiry/restore, deployed hosting, mounted current MF authority/grants, actual account/source/rights/template/editorial/reviewer evidence, failure-specific remediation, permitted marketplace adapters, actual economics/financial reconciliation, owner-phone operations, recovery drills, measured capacity and real end-to-end evidence remain outstanding. Both publication flags remain false and Etsy is excluded. This execution is not a continuously running self-hosted worker. This report-only receipt uses [skip render]; implementation ran normal CI.


### 2026-10-17 — r53 verified receipt: idle database connection recovery

Fresh inspection found CC 27e7c49367a4d27795fc4f12761b5e5c569fdcfe and MF 625b43967ff75b0f96631a77e19fdf307a267ad9. Read current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. MF's change since r52 was confined to FREE_MONITOR_EVENTS.json and FREE_MONITOR_STATE.json; both were preserved. No competing POD PR or CC AGENTS.md was found. No materially changed database administration path was observed, so that failed path was not retried.

[CC PR 200](https://github.com/wecreates/content-control/pull/200) merged tested 90c3a421390391fc39b8dab3dbdf703309baa5f6 as b2b6799833eea5d2498458106e1069da6c34a97a. Exact tested/merged tree: de83eacc56d032d3532b46d016e6bc3832bd8f39. createPodPool previously had no idle pool error listener. The [official node-postgres pool contract](https://node-postgres.com/apis/pool#error) states that background idle-client failures emit pool errors and the driver removes the failed client; an unhandled error may crash the process. This was diagnosed from source and driver contract, not a claimed production crash.

Runtime pools now install an idempotent monitor before connecting. Status exposes only a saturating incident count, last timestamp and fixed POD_DATABASE_IDLE_CONNECTION_FAILED code; raw error text, client details and connection URLs are neither retained nor logged. Returned snapshots cannot mutate monitor state. TLS verification, pool size and timeouts are unchanged. The driver can replace failed idle clients on subsequent acquisition. These cumulative process-local diagnostics are not an availability probe or automatic retry of an in-flight transaction. Host-provided MF pools still need their own idle-error handling.

All three local EventEmitter tests pass with zero skips; the PostgreSQL test passed syntax validation locally. Local pg/PostgreSQL/Docker were unavailable. Hosted tests verify the actual production pool factory configuration and terminate only an owned disposable idle backend, observe its removal, then require a successful query on a different backend while retaining the incident. [PR integration 39020204979](https://github.com/wecreates/content-control/actions/runs/39020204979), job 117360332892, passed 401 Node tests, 157 POD Python tests, one durable PostgreSQL/Python E2E and three workflow guards with zero failures/skips. [Production-image gate 39020204915](https://github.com/wecreates/content-control/actions/runs/39020204915), job 117360332759, built local image sha256:cb12c00fa611491a9aa90a95f2d8cd7c99cf7240e7eaa4df0f9152f841205ff4 and passed UID/dependency checks, 157 Python tests without networking, 401 Node tests including actual PostgreSQL reconnection, one durable E2E and disabled-state startup. CI did not push or deploy the image.

Fresh exact head/base, passing checks and clean mergeability were verified before guarded merge. [Merged-main integration 39020352682](https://github.com/wecreates/content-control/actions/runs/39020352682), job 117360751947, also passed 401 Node, 157 Python, one durable E2E and three workflow guards with zero failures/skips; its logs explicitly confirm the idle backend reconnection test. [Main wiring audit 39020352677](https://github.com/wecreates/content-control/actions/runs/39020352677), job 117360751985, passed. No redundant main image job was dispatched.


[MF PR 26](https://github.com/wecreates/Money-factory/pull/26) merged tested fb9f208716cf03dcaeb98084859f5784ec43323a as 9cb4b7493543ba658d3b705881c861fb78633b60. Exact tested/merged tree: 8b25b3f4c690879d572290c36a4165b28949e96a. The existing cross-repository gate now pins CC b2b6799833eea5d2498458106e1069da6c34a97a. Its real PostgreSQL/HTTP roundtrip attaches the production pool monitor, commits a sender event, terminates only its own idle backend, requires removal and reconnection, then exercises lost acknowledgement and unchanged-ID retry with exactly one inbox row. Existing cutoff, duplicate, expiry, lock/statement timeout and rollback cases remain. [MF gate 39020529452](https://github.com/wecreates/Money-factory/actions/runs/39020529452), job 117361252137, passed 35 Node and two Python tests, zero failures/skips. Local syntax and workflow YAML parsing passed. Fresh head/base, passing checks and clean mergeability were verified before guarded merge. The gate is PR/manual; no duplicate main run was manufactured. Concurrent monitor files were preserved.

Render automatically attempted CC b2b6799833eea5d2498458106e1069da6c34a97a as dep-db9jopu1egvs73crhii0 and reported build_failed at 2026-10-17T09:14:16.418781Z. Its 09:14:16.23581949Z log explicitly reports exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, spending/plan change, replacement service, secret disclosure, network expansion or repeated database administration attempt occurred. CI recovery does not prove deployment or a production recovery drill.

All 24 live acceptance areas remain OPEN: restricted production database/schema/preflight; durable retention, expiry and restore; deployed hosting; mounted current MF authority/inbox/grants and revocation; actual account, authorized source, concept, regional rights, original generation, template, KDP/editorial and independent reviewer evidence; remediation and permitted five-platform adapters; actual economics and financial reconciliation; owner-phone operations; monitoring/security/recovery drills; measured capacity and real end-to-end acceptance. Both publication flags remain false and Etsy is excluded. No approval, clearance, credentials, revenue or completion were fabricated. The next live steps still require materially changed deployment/access prerequisites and authentic domain evidence. This run is not a continuously running self-hosted worker. This report-only receipt uses [skip render]; implementation used normal CI.


### 2026-10-17 — r54 verified receipt: outbox disable and shutdown health

Fresh inspection found CC 9be81fd46285b4b31380a0e5c0fc2889563768cb and MF 9cb4b7493543ba658d3b705881c861fb78633b60, unchanged since r53. Read current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR or CC AGENTS.md was found. The existing free Docker service, health path and deployment configuration were preserved. No credible changed database administration path was observed, so that failed path was not retried.

The internal outbox lifecycle previously checked POD_OUTBOX_ENABLED only at startup. A flag change during polling could allow subsequent batches; a delivery resolving after stop could also refresh last_success_at. Three new regression tests failed on baseline. The loop now checks its enable flag before each batch and after delivery settles, drains the current batch and ends STOPPED. Returned acknowledgement/failure counts are retained, but a stopped cycle does not refresh success time or reset retry health. Rejection after disable stops without inventing a new transport failure. Re-enabling a flag does not restart the stopped lifecycle.

All 18 focused local outbox tests passed, zero failures/skips, including four new cases for disable during polling, resolution, rejection and abort health, plus no implicit restart. Existing retry/backoff, stable pagination, shutdown draining, acknowledgement and storage-cutoff regressions remain passing. These are local runtime fixtures, not a live authority or provider drill.

The change is intentionally at batch boundaries. An environment-only disable does not interrupt a batch in flight and is observed after the built-in polling wait (up to five minutes); the lifecycle stop method aborts requests cooperatively and waits for draining. Environment changes are in-process checks, not remote control-plane polling. No event-signature, acknowledgement, cursor or Money Factory handler contract changed. MF's r53 cross-repository verification remains current for that protocol; no duplicate MF pin, PR or job was created.

[CC PR 202](https://github.com/wecreates/content-control/pull/202) merged tested 0b71aed487e3d5b1cc50d5e79e6ce31660f6a839 as 5def9c008fa0467b50e0365a1bf78c887895bc68. The exact tested/merged tree is a6e573c3fa504adf374c410bb1311c39a7022be9. Fresh head/base, passing checks and clean mergeability were verified before guarded merge. [PR integration 39021665566](https://github.com/wecreates/content-control/actions/runs/39021665566), job 117364541426, passed 405 Node tests, 157 POD Python tests, one durable PostgreSQL/Python E2E and three workflow guards, zero failures/skips. [Production-image gate 39021665555](https://github.com/wecreates/content-control/actions/runs/39021665555), job 117364541561, built local image sha256:565df0de28bb2707db8e17c86a266e643cd9ab8f4ea9634f943a1809962ab1c5 and passed UID/dependency checks, 157 Python tests without networking, 405 Node tests, one durable E2E and disabled-state startup. No image was pushed or deployed by CI. Docker/PostgreSQL execution was hosted; local verification used the focused Node fixtures.

Render automatically attempted 5def9c008fa0467b50e0365a1bf78c887895bc68 as dep-db9k3c5g1s2s73agp470 and reported build_failed at 2026-10-17T09:36:48.494811Z. Its 09:36:48.338916246Z log explicitly reports exhausted workspace build pipeline minutes. Re-read dep-db7r0lh42hec739jiusg still reports live at 5180c243198afb6dfb05ee8d2e14995d4e7b0750. No manual duplicate build, spend/plan change, replacement service, secret disclosure, network expansion or database administration retry occurred. The existing [live smoke 39020242120](https://github.com/wecreates/content-control/actions/runs/39020242120), job 117360434802, saw green health and publication disabled but failed candidate identity, watch page, range streaming and captions. Those separate video checks were preserved; they do not establish POD live acceptance.

[Merged-main integration 39021794203](https://github.com/wecreates/content-control/actions/runs/39021794203), job 117364913060, passed 405 Node tests, 157 Python tests, one durable E2E and three workflow guards, zero failures/skips. [Main wiring audit 39021794199](https://github.com/wecreates/content-control/actions/runs/39021794199), job 117364913044, passed. The image gate remains PR/manual and the merge has the exact tested tree; no duplicate image dispatch was made. MF was re-read unchanged at 9cb4b7493543ba658d3b705881c861fb78633b60.

All 24 live acceptance areas remain OPEN. Production role/schema/preflight, durable retention/expiry/restore, deployment, mounted current MF authority/grants/revocation, actual account/source/concept/rights/generation/template/KDP/editorial/reviewer evidence, bounded remediation, permitted five-platform adapters, real economics/reconciliation, owner-phone operations, security/monitoring/recovery drills, measured capacity and actual end-to-end/controlled-launch evidence still need verification. Both publication flags remain false and Etsy is excluded. No credentials, clearance, approval, revenue or completion were fabricated. No continuously running self-hosted worker is claimed. The next live step requires materially changed deployment/access prerequisites and authentic acceptance inputs. This report-only receipt uses [skip render]; implementation used normal CI.


### 2026-10-17 — r55 verified receipt: production disable and recovery boundaries

Fresh inspection found CC a83965cd8c9a0dfd0f041cc9680abe01048d47dc and MF 9cb4b7493543ba658d3b705881c861fb78633b60, unchanged since r54. Read current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR or CC AGENTS.md was found. Free Docker service configuration and unrelated concurrent work were preserved. No credible changed database administration path was observed, so that failed path was not retried.

The production flag was checked by produceOnce, but its outer worker continued running db.recover() and could record a late disabled/idle result as a healthy RUNNING cycle. Five new regressions failed on baseline. The generic loop now accepts a synchronous continuation predicate (default true for existing callers), checks it before recovery and after awaited stages, and stops without later stage calls or completion notifications when disabled. The production lifecycle supplies its existing flag and transitions to STOPPED when the loop drains. Disabled recovery rejection does not invent a retry failure; prior diagnostics are retained.

All 23 focused local worker, QA-process and failure-reason tests passed with zero failures/skips, including seven new cases covering initial disable, recovery resolve/reject, in-flight claims, polling and final-stage boundaries. Existing tests still require graceful draining, sanitized errors and rejection of a nonzero QA process with PASS output. These fixtures are not real QA or production shutdown acceptance.

An already-started query or callback is not undone. An environment-only disable during the built-…117138 tokens truncated…est/manifest failure or Python interrupt, preventing a corrected same-destination retry. Against the actual entry generator, the expanded 14-test recovery suite recorded 13 failing subcases across four new methods: six late-stage cleanup/retry cases, five platform font cases, interrupt cleanup and cleanup-denial diagnostics. All original seven review-recovery methods passed; three new existing-output/replacement-preservation methods also passed on old code and guard the repair from deleting concurrent work. A local orchestration ReferenceError while constructing the initial test patch was corrected before the actual baseline invocation; it was not a product failure or a passing test.

The existing review producer's descriptor-held device/inode output-attempt guard is now a shared helper used by direct asset generation too. Only a newly created still-owned attempt is a cleanup target. Existing outputs/symlinks fail without removal; checked replacements and moved attempts are preserved for manual recovery. Denied cleanup retains the original stage exception and adds ASSET_OUTPUT_CLEANUP_FAILED; the review path keeps REVIEW_OUTPUT_CLEANUP_FAILED. Successful outputs/manifests and their hashes remain unchanged; no rights, template, QA, editorial or publication approval is manufactured. This is not atomic package installation, durable recovery, adversarial same-user filesystem isolation or cleanup after SIGKILL/crash/default SIGTERM/filesystem failure. Created parent directories are not removed.

Seven new methods exercise actual PNG/PDF production and six partial-output stages followed by exact deterministic/hash-bound retries, corrected fonts across all five platforms, KeyboardInterrupt, existing outputs/symlinks, replacement directories/symlinks and denied cleanup. Local 14 recovery, 28 binary-IO, 28 source/raster/text and 7 stage-expiry tests and Python syntax checks passed. Fixtures supply no real template/license/reviewer/provider approval. Available bounded local/hosted tools are used, not a continuously running self-hosted worker.

Final CC head 53d67f0318b37dae58f07c103de561927285f56d passed [integration 39479851044](https://github.com/wecreates/content-control/actions/runs/39479851044), job 118825244655: 620 Node, Python groups 12/14/41/34/28/7/80/28/58, four workflow guards, syntax/workflow control and durable E2E1, zero failures/skips. [Container 39479850931](https://github.com/wecreates/content-control/actions/runs/39479850931), job 118825244123, passed 302 Python and 620 Node, nonroot/dependency checks and durable E2E1; startup at 2026-10-20T19:04:24.0511047Z reported publication=false and production/outbox DISABLED. All five patches and exact remote file readbacks were reviewed. Fresh unchanged main/head, clean mergeability and both successful exact-head checks preceded guarded merge 6d9435258a43a1e0e720d60b66b8d6ee031dced1. Merged tree f9bbf1c69d8a3fd0c281ee047bd2a54f7e67c1d5 equals the tested tree.

The first MF head aa80fae64f6c87f6ffbea49c6eddae83919534ac passed consumer workflow 39480464671, job 118827358065: 322 consumer Node, Python groups 34 evidence/14 recovery/28 binary-IO/28 source-text/80 real-PDF-book, 109 MF Node/PostgreSQL and 81 MF Python, zero failures/skips. It was not merged because the fresh-head guard detected concurrent main 17fc08383821ecf5f994aa1590f57476b9fbe7f6 (free monitor cadence tick). Comparison from the entry MF base showed only FREE_MONITOR_EVENTS.json (+8 lines) and FREE_MONITOR_STATE.json (+4/-4); neither POD workflow nor POD README changed. The POD branch was updated with a normal additional-parent merge commit, without force/rewrite, on the concurrent tree. Both monitor files were independently read back and matched the new main byte-for-byte; the PR still changes only the intended POD workflow/README. The normal automatic consumer gate was rerun on the combined head, not duplicated by manual dispatch.

Dependent [MF #87](https://github.com/wecreates/Money-factory/pull/87) pins the merged repair and adds review/direct-asset recovery to consumer verification. Final combined head 87f969a50a4e3148c8817702afb1dff81632e3fc passed [workflow 39480832372](https://github.com/wecreates/Money-factory/actions/runs/39480832372), job 118828630651: 322 consumer Node, Python groups 34 evidence/14 recovery/28 binary-IO/28 source-text/80 real-PDF-book, 109 MF Node/PostgreSQL and 81 MF Python, zero failures/skips. Final Python completed at 2026-10-20T19:09:45.5614986Z. Both intended patches and exact file readbacks were reviewed; monitor files were preserved exactly. Fresh unchanged main/head, clean mergeability and the successful exact-head check preceded guarded merge 38b4237bc74d8cbca996ba89daf3125decbcb10e. Merged tree 7ff4843fa98cd8d4e038022c525af504b5aaae6d equals the tested tree. Existing Node 22/Python 3.12/disposable PostgreSQL 18, dependencies, other consumer suites and false publication flags remain unchanged. CC merged-main integration 39480397414, job 118827130322, and System Wiring Audit 39480397427 also passed; no duplicate manual workflow was dispatched.

Render remains the authorized existing free Docker/main automatic service with ./Dockerfile and /health; configuration/network unchanged. Entry latest dep-dbbqcj2jnfac73d1e850 remained build_failed, with fresh 2026-10-20T17:35:09.160390543Z logs confirming exhausted current-period build minutes. This repair's automatic deployment dep-dbbrmom7bikc73e95qs0, commit 6d9435258a43a1e0e720d60b66b8d6ee031dced1, failed at 2026-10-20T19:05:07.130901Z; fresh 19:05:06.879851413Z logs confirm the same quota. Individually re-read last-live dep-db7r0lh42hec739jiusg remains commit 5180c243198afb6dfb05ee8d2e14995d4e7b0750, finished October 14 at 16:41:11.656201Z. Its October 20 13:52:47.558644Z metadata update is not deployment of newer code. No deployment of this repair was verified; quota reset remains unknown. No manual rebuild, cache/spend/paid/configuration/network/key change, replacement resource, secret disclosure or social-vault access occurred.

All 24 live acceptance areas remain OPEN under POD_COMPLETION_CHECKLIST.md. Failure-specific local generation recovery and corrected deterministic retries are now implemented and exercised, not actual retained recovery or authorized marketplace acceptance. Production DB role/access/migrations, October 26 expiry and retained backup/restoration, deployed hybrid hosting/MF authority/current grants, authentic accounts/intelligence/concepts/rights/generation, official interior-source retention and current template approvals, substantive manuscripts/editorial/calibrated independent QA, real remediation/preview/print acceptance, five authorized adapters and publication safeguards, actual economics/reconciliation, mobile/monitoring/security/measured capacity and controlled end-to-end/launch evidence remain unfinished. No credible changed database-admin path was observed and the unchanged failed connector/browser path was not retried. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy is excluded. Actual bounded local/hosted results were used, not a continuously running self-hosted worker. Useful authorized work remains while deployment quota is transient. Append-only evidence receipt: [skip render].


## 2026-10-20 r135 — Original manuscript identity in independent KDP QA

Entry heads were CC 940773782522316d680b7c4ebd07aca3ef040e45 and MF 38b4237bc74d8cbca996ba89daf3125decbcb10e. Current completion/status/free-deployment documents, both recursive trees (no AGENTS.md), open PRs, workflows and the authorized existing Render service/deployments were read. CC #345 and all other unrelated PRs were preserved; MF #80/#81 remain excluded from this POD lane. Entry CC POD integration 39480397414 and consumer 39480832372 passed. Ordered Capability Completion 39484703163/job 118841985060 failed at queue_not_ready_or_empty (zero ready tasks, 2500 blocked capabilities), not a POD failure repaired here. No duplicate POD PR or manual workflow/deploy was dispatched.

[CC #359](https://github.com/wecreates/content-control/pull/359) closes a confirmed QA/release boundary gap. The original focused policy accepted a KDP PASS without original-manuscript provenance: seven existing methods passed and the new method failed with Missing expected exception. The original QA inspected delivered PDF geometry/fonts but did not consume the original manuscript. Its new bounded original-pages capture now requires strict regular-file UTF-8 JSON under the shared 4 MiB limit, valid page/line shape and the signed template's page count. Each actual delivered PDF page must extract to exactly that original line sequence; substitutions, reordering, added or missing text fail. Hashing uses the same captured original pages and pod_common.canonical, not a producer receipt or text reconstructed from its PDF.

The host-owned KDP review callback receives options.manuscript from the original immutable-task pages, alongside the existing cancellation signal; QA receives the same task path via --manuscript. The current separate editorial attestation must bind manuscript_sha256 as well as package/interior identities, approved evaluator and every existing editorial check. Current signature and final expiry rechecks remain. The shared production completion, review acceptance and release policy requires manuscript_provenance to be boolean true for KDP only. Old attestations/receipts need actual fresh review; no bit, signature, text or manuscript is backfilled. The four non-book platforms retain their existing contract. Editorial/QA contract documentation records the expanded requirement.

Seven new real-PDF methods cover exact canonical identity, substitutions/reordering/missing-extra text, malformed/missing/count-invalid originals, actual PDF count mismatch, strict duplicate/nonfinite/oversize/symlink rejection and later original-path replacement after capture. Two full QA methods reject missing/incorrect editorial manuscript identity and a substituted, newly receipted/rehashed interior despite valid technical geometry. Node coverage adds exact-boolean KDP enforcement, unchanged other-platform behavior, original-path delivery to reviewer/QA and disposable PostgreSQL completion/review rejection paths. Local focused Node62, real-PDF/book87, binary IO28, recovery14, stage-expiry7 and Python syntax checks passed. OpenCV was unavailable locally, so no local full-QA result is asserted. Initial scratch preparation/import/patch-placement errors were corrected before the recorded passing runs, not counted as product defects or passes.

Initial hosted integration 39492375457/job 118868714291 on 763114205e6d34054822200310e16e7dc94dfdd2 failed LEASE_LOST in the new repeated database-rejection fixture: the prior completion correctly cleared its lease, but the fixture reset only its state. The fixture now resets its own disposable lease between cases. Production lease/fencing checks were not weakened. Superseded branch checks are not final evidence; ordinary automatic gates reran on the corrected final head, with no manual duplicate dispatch.

Final CC head c3be0d9c20e52941ddd6cba8f0a57711e869d934 passed [integration 39492708038](https://github.com/wecreates/content-control/actions/runs/39492708038), job 118869733595: 622 Node; Python groups 12/14/41/34/28/7/87/28/60 (311 total); four workflow guards, syntax/workflow control and durable E2E1, zero failures/skips. [Exact-image 39492708015](https://github.com/wecreates/content-control/actions/runs/39492708015), job 118869737024, passed 311 Python, 622 Node, nonroot/dependency checks and durable E2E1. Startup at 2026-10-20T20:34:30.9343937Z reported publication=false and production/outbox DISABLED. All 19 final patches/exact remote readbacks were reviewed, including correction of a misplaced documentation row. Fresh unchanged main/head, clean mergeability and both successful exact-head checks preceded guarded merge 006445e0e4229acf15bd8269004842a3959b1cd1. Merged tree a33ca4ab92397a06c446c0ef21894894d3174634 equals the tested tree.

Dependent [MF #88](https://github.com/wecreates/Money-factory/pull/88) pins that merged revision, adds pinned OpenCV beside existing NumPy/Pillow/PDF dependencies and executes the two focused actual KDP QA methods in the existing consumer workflow. Final head 638abae62ecc2607954eac1eb8d6a6e2aafed850 passed [consumer 39493258045](https://github.com/wecreates/Money-factory/actions/runs/39493258045), job 118871620854: 324 consumer Node; Python groups 34 evidence/14 recovery/28 binary/28 original-source-text/87 real-PDF-book/2 focused KDP QA; 109 MF Node/PostgreSQL and 81 MF Python, zero failures/skips. Final Python completed at 2026-10-20T20:36:59.2904089Z. Both patches/exact readbacks were reviewed; fresh unchanged refs, clean mergeability and successful exact-head check preceded guarded merge 85de93c4e0477fb322ab68298a80b1299b52ae63. Merged tree 39c0ebbc3e400cca8ef6031eaaea6a0976025e51 equals the tested tree. Existing Node22/Python3.12/disposable PostgreSQL18 and false publication flags remain. No concurrent main changes were overwritten.

CC merged-main integration 39493243481/job 118871573623 also passed 622 Node, all 311 Python, workflow guards and durable E2E1. System Wiring Audit 39493243497 passed when read. Autonomous CCO Control Loop 39493241503 passed, not POD live acceptance.

Render remains the authorized existing free Docker/main automatic service with ./Dockerfile and /health; configuration/network unchanged. Entry latest dep-dbbrmom7bikc73e95qs0 remained build_failed, with fresh 2026-10-20T19:05:06.879851413Z logs confirming exhausted current-period build minutes. This repair's automatic deployment dep-dbbt10ou01pc7387ufq0, commit 006445e0e4229acf15bd8269004842a3959b1cd1, failed at 2026-10-20T20:35:16.595995Z; fresh 20:35:16.324162172Z logs confirm the same quota. Individually re-read last-live dep-db7r0lh42hec739jiusg remains commit 5180c243198afb6dfb05ee8d2e14995d4e7b0750, finished October14 at16:41:11.656201Z. Its October20 13:52:47.558644Z metadata update is not deployment of newer code. No deployment of this repair was verified; quota reset remains unknown. No manual rebuild, cache/spend/paid/configuration/network/key change, replacement resource, secret disclosure or social-vault access occurred.

All 24 live acceptance areas remain OPEN under POD_COMPLETION_CHECKLIST.md. Manuscript text equality and synthetic signing fixtures are not original authorship, legal clearance, source-font identity, substantive editorial quality, calibrated independent review or actual KDP preview/print acceptance. A valid embedded font subset is still not independently proven to be its licensed original source font. The production DB role/access/migrations and October26 expiry/recovery, deployed hybrid hosting/MF authority/current grants, authentic accounts/intelligence/concepts/rights/generation, original official interior source retention and current template approvals, real remediation and five authorized marketplace adapters, actual economics/reconciliation, mobile/monitoring/security/measured capacity and controlled end-to-end/launch evidence remain unfinished. No credible changed database-admin path was observed, and the unchanged failed connector/browser path was not retried. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy is excluded. Evidence comes from actually available bounded local and hosted CI execution, not a continuously running self-hosted worker. Useful authorized work remains while deployment quota is transient. Append-only evidence receipt: [skip render].


## 2026-10-20 r136 — Recoverable KDP book package assembly

Entry heads were Content Control `eed5c327999444d4d3a41a4f6f530a75721a510e` and Money Factory `85de93c4e0477fb322ab68298a80b1299b52ae63`. The current completion/status/free-deployment documents, open pull requests, workflow state and authorized existing Render service `srv-darsdb8u01pc73dn4i2g` were read. No competing POD implementation PR was open; unrelated Content Control #345 and non-POD/Etsy PRs were preserved. The failed database connector/browser path had no credible changed access prerequisite and was not retried.

A direct failure reproduction showed that `pod_book_package.assemble` exposed `interior.pdf` and `interior.receipt.json` before committing their manifest. An injected exception after the receipt write left both files beside the unchanged original manifest; the corrected retry then failed `OUTPUT_EXISTS`. [Content Control #361](https://github.com/wecreates/content-control/pull/361) stages the PDF, receipt and next manifest in an owned same-filesystem directory; installs both outputs with no-replace hard links; and replaces the manifest only after both installs. Failures before manifest commit remove only the exact installed inodes. Concurrent file replacements are retained, and an identity/byte change to the original manifest is rejected as `MANIFEST_CHANGED` rather than overwritten. Cleanup denial retains the original exception with fixed manual-recovery notes. No publication behavior changed.

Local evidence at final head `804868db948d3c91aedf3ca001a9b3bfb67eae0b`: 17 recovery tests and seven stage-expiry tests passed, Python compiled, and whitespace validation passed. The old failure was reproduced before the repair. OpenCV was absent locally, so no local full-QA pass is claimed. [Exact-head integration run 39495244913](https://github.com/wecreates/content-control/actions/runs/39495244913), job 118878533624, passed 622 Node tests, Python groups 12/17/41/34/28/7/87/28/60 (314 total), workflow controls and durable E2E, with zero failures. [Exact production-image run 39495244920](https://github.com/wecreates/content-control/actions/runs/39495244920), job 118878596425, passed the 314 Python and 622 Node tests, non-root/dependency checks and durable E2E; startup reported publication false and production/outbox `DISABLED`. Fresh unchanged base/head, clean mergeability and both successful exact-head checks preceded guarded merge `f05712ebbf05aa6683a98cb950343e31cce788d2`. Comparing the tested head to the merge returned no changed files, so the merged tree equals the tested tree.

Dependent [Money Factory #89](https://github.com/wecreates/Money-factory/pull/89) pins the Content Control merge and runs the expanded recovery suite in the existing Node 22/Python 3.12/disposable PostgreSQL 18 consumer. Final head `073331996121f8a98b3c1d890edc7244b420c44a` passed [consumer run 39495906927](https://github.com/wecreates/Money-factory/actions/runs/39495906927), job 118880762791: 324 Content Control Node tests; Python groups 34/17/28/28/87/2; 109 Money Factory Node/PostgreSQL tests and 81 Money Factory Python tests, zero failures. Fresh unchanged base/head and clean mergeability preceded guarded merge `0a1ff1c84cde8dd965cc023efce91a8d2ea29208`; tested and merged trees are identical.

Render automatically attempted Content Control merge `f05712ebbf05aa6683a98cb950343e31cce788d2` as deployment `dep-dbbt9hc9v7es73b0maqg` and reported `build_failed` at 2026-10-20T20:53:25.754065Z. Fresh build log timestamp 2026-10-20T20:53:25.585305841Z states that the workspace has exhausted current-period build pipeline minutes. The existing free Docker/main service configuration remains unchanged. No manual rebuild, paid limit, cache/configuration/network/key change, replacement resource or database administration was attempted; live deployment of this repair is not verified.

All 24 live acceptance areas remain OPEN under `POD_COMPLETION_CHECKLIST.md`. This run adds verified failure-specific book-assembly recovery evidence only; it does not prove live recovery, database/storage/deployment readiness, authorized accounts/sources/rights/templates/reviewers/adapters, substantive KDP preview acceptance, economics/reconciliation, mobile/monitoring/security/capacity, end-to-end submission or launch. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false; Etsy remains excluded. No credentials, approvals, clearances, revenue or completion were invented. Evidence comes from bounded local and hosted CI execution, not a continuously running self-hosted worker. Useful authorized work remains while deployment quota is transient. Append-only evidence receipt: [skip render].


## 2026-10-20 r137 — Authenticated KDP source-font identity

Entry heads were Content Control `6d58fcba38c14e62d8918fb727e5b00da4783eaf` and Money Factory `6515112d59488e8538865dd4cb2b1a30ffe0282f`. The current checklist/status/free-deployment documents, open pull requests, workflow state and authorized existing Render service `srv-darsdb8u01pc73dn4i2g` were read. The Money Factory entry was a concurrent free-monitor cadence tick and was preserved. No competing POD implementation PR was open. The previously failed database connector/browser path had no credible changed access prerequisite and was not retried.

A valid embedded PDF subset previously proved embedding and geometry but did not independently prove that visible glyph programs came from the original font bytes authenticated by the signed interior template. [Content Control #363](https://github.com/wecreates/content-control/pull/363) adds a fail-closed KDP QA gate which reads one regular non-symlink TTF into a bounded 16 MiB snapshot, checks its SHA-256 against the signed template, requires the supported one-resource TrueType PDF contract, and compares units-per-em, horizontal header metrics, per-glyph advance/side bearing and decomposed outlines for every distinct delivered text-trace character/glyph pair. A matching unused font resource cannot mask another active resource. QA records and requires `checks.source_font`; the production worker passes the task-owned original font. FontTools 4.61.1 is pinned in development, runtime and CI. This establishes technical identity to supplied bytes only, not licensing, commercial permission, shaping, typography, editorial quality or KDP acceptance.

Local evidence at final head `b78f7e37512b95d70c834edaf78269d4f3288f31`: 90 real-PDF/book tests and 54 production-template/worker tests passed. Three focused full-QA methods passed with a local OpenCV stub because OpenCV was unavailable in that runner; Python compile and Node syntax checks passed. The real-PDF regression demonstrates the prior geometry/embedding preflight accepts a valid DejaVu Serif interior while the new comparison rejects it against authenticated DejaVu Sans. No complete local OpenCV-backed QA pass is claimed.

[Exact-head integration run 39508895586](https://github.com/wecreates/content-control/actions/runs/39508895586), job 118925009126, passed 622 Node tests; Python groups 12/17/41/34/28/7/90/28/61 (318 total); one durable E2E test; four workflow guards; syntax/workflow controls, with zero job failures. [Exact production-image run 39508895536](https://github.com/wecreates/content-control/actions/runs/39508895536), job 118925150779, passed 318 Python and 622 Node tests, non-root/dependency checks, durable E2E, real print/recovery and disabled-publication startup. The database error messages in logs are expected negative-path assertions; both jobs concluded success. Fresh unchanged base/head, clean mergeability and both exact-head successes preceded guarded squash merge `9b0771234399f253423e758a7c376e9ce6f12a7b`. All ten changed blobs at the merge are byte-identical to the tested head.

Dependent [Money Factory #90](https://github.com/wecreates/Money-factory/pull/90) pins that Content Control merge, installs FontTools 4.61.1 and runs the new source-font method alongside original-manuscript and substitution checks in the existing Node 22/Python 3.12/disposable PostgreSQL 18 consumer. Exact head `1a6e21f85120aa08e652de8801413ce57e9877af` passed [consumer run 39509748019](https://github.com/wecreates/Money-factory/actions/runs/39509748019), job 118927538222: 324 Content Control Node; Python groups 34/17/28/28/90/3; 109 Money Factory Node/PostgreSQL and 81 Money Factory Python tests, zero job failures. Fresh unchanged base/head, one-file diff and clean mergeability preceded guarded squash merge `624fe4cea70c613c5752fdd2e8fb5afc718534fa`; the merged workflow blob equals the tested blob. Both publication flags remain false and the concurrent monitor commit was not overwritten.

Render automatically attempted Content Control merge `9b0771234399f253423e758a7c376e9ce6f12a7b` as deployment `dep-dbbuqr6k1f9s73f108c0`. It ended `build_failed` at 2026-10-20T22:38:36.882014Z; fresh log timestamp 2026-10-20T22:38:36.665659018Z states the workspace has exhausted current-period build-pipeline minutes. The existing free Docker/main automatic service configuration remains unchanged. No manual rebuild, purchase, paid limit, cache/configuration/network/key change, replacement resource or database administration was attempted. Live deployment of this repair is not verified.

All 24 live acceptance areas remain OPEN under `POD_COMPLETION_CHECKLIST.md`. This run closes only the identified technical source-font identity gap. It does not supply current regional font license evidence, substantive editorial/official-template/KDP preview acceptance, production database/storage/deployment, live Money Factory authority/grants/accounts, authorized market inputs/concepts/generation, calibrated independent QA, five live provider adapters, actual economics/reconciliation, mobile/monitoring/security/capacity, end-to-end submission or controlled launch evidence. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false; Etsy remains excluded. No credential, approval, clearance, test, revenue or completion was invented. Evidence comes from bounded local and hosted CI execution, not a continuously running self-hosted worker. Useful authorized work remains while the deployment quota condition is transient. Append-only evidence receipt: [skip render].



### 2026-10-20 — r138 verified receipt: current scoped KDP font-rights evidence

Fresh inspection found CC d5f1adf49b14a515a02d74f72eba2cea2e52a3a7 and MF 624fe4cea70c613c5752fdd2e8fb5afc718534fa, read the current completion/status/free-deployment documents, open PRs, workflow results and the authorized existing Render service. No competing POD PR existed. The prior database-administration access path had not materially changed, so it was not retried.

[CC PR 365](https://github.com/wecreates/content-control/pull/365) merged exact tested head f6209085791fe64f017a8ea317d18f4ea887081c as d35a31b7e7dc101529e1dd473e21c1ddb2444d6d. All 13 changed file blobs at the merge equal the tested-head blobs. KDP tasks now require immutable source-font, signed font-rights and retained license-evidence artifacts. Independent QA hashes the source font and license bytes, authenticates a current at-most-15-minute `pod:font-rights` envelope, binds it to exact country/product and both hashes, and requires unrevoked commercial-use, print-on-demand and font-embedding permissions plus bounded license and licensor identifiers. The evidence is reverified after QA and caps the QA receipt's expiry. Non-KDP task contracts are unchanged. This is technical provenance and current signed scope, not proof that the signer has legal authority, that the license is authentic, or that Amazon accepts the content.

Local checks passed 62 aggregate QA tests, 90 actual PDF/book tests, five dedicated font-rights tests, 13 task-resolver tests and 54 worker/template tests; Python compilation and Node syntax passed. The local aggregate QA used a dilation stub because OpenCV was unavailable there; hosted runs supplied the pinned real dependency. [PR integration 39515247519](https://github.com/wecreates/content-control/actions/runs/39515247519), job 118945728483, passed 622 Node tests, 324 Python tests, one durable PostgreSQL/Python E2E and four workflow guards. [Production-image run 39515247557](https://github.com/wecreates/content-control/actions/runs/39515247557), job 118946060562, passed the same 622 Node, 324 Python and durable E2E suites under the image's non-root user, then returned the disabled startup state: publication false, production DISABLED and outbox DISABLED. The image was not pushed or made live by CI.

Dependent [MF PR 91](https://github.com/wecreates/Money-factory/pull/91) merged exact tested head be04b7d462446ca70b16749fc985bff9d07e2392 as 61b0cba4ffd04ffa6e6f347746f9281aeb77d5d5. Its merged workflow blob b37ab9c056a50accee8d4481307e8e9ae8616a5d equals the tested blob. It pins CC d35a31b7e7dc101529e1dd473e21c1ddb2444d6d and explicitly runs the dedicated font-rights suite plus the focused current-scope check with both publication flags false. [Cross-repository run 39516028314](https://github.com/wecreates/Money-factory/actions/runs/39516028314), job 118948259427, passed 433 Node and 287 Python tests with zero failures, including the dedicated five-test and focused four-test KDP groups. Its PostgreSQL 18 service was disposable CI, not the production database.

Render automatically attempted d35a31b7e7dc101529e1dd473e21c1ddb2444d6d as dep-dbbvkjtbedkc73f78aqg and reported build_failed at 2026-10-20T23:33:36.513285Z. The 2026-10-20T23:33:35.98693721Z log explicitly reports that the workspace exhausted build pipeline minutes for the current billing period. No manual duplicate deployment, spend/plan change, replacement service, secret access, network widening or unchanged database-administration retry occurred.

All 24 live acceptance areas remain OPEN. This repair advances only fail-closed, signed technical evidence for a font and retained license document scoped to the KDP task; it does not supply or validate a real license, licensor authority, regional clearance, official template, editorial/independent review, account/platform preview, authorized publishing adapter, economics/reconciliation, production database/recovery, owner-phone operation, measured capacity or actual end-to-end acceptance. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false; Etsy remains excluded. Synthetic fixtures and hosted CI are not credentials, approvals, clearances, publication, revenue, live deployment or a continuously running self-hosted worker. This report-only receipt uses [skip render]; the runtime merge used normal CI and its automatic deployment outcome is recorded above.


### 2026-10-20 — r139 verified receipt: retained official KDP interior-template source

Fresh inspection found CC 1c32ed39a6e4a5e740a9be42e508b794ce488b25 and MF 61b0cba4ffd04ffa6e6f347746f9281aeb77d5d5, read the current completion/status/free-deployment documents, open POD PRs, workflow results and the authorized existing Render service. No competing POD PR existed. The prior database-administration access path had not materially changed, so it was not retried.

The official KDP blank-manuscript-template page and its public archive were inspected on 2026-10-20 without credentials. The complete public archive was 45,534,725 bytes with SHA-256 7daec7e44c717547db022ded5e01fdb84daae7afdea2dedc50275ffbddaf58d2. Its scoped English archive was 364,713 bytes with SHA-256 8812d6f196d8ed1802e25cabad124ea5dcbfd9b768badf698b60cfacb69d37f4. Exact member `English/English/6 x 9 inch (15.24 x 22.86 cm).docx` was 25,115 bytes with SHA-256 e7ef49a70c4c8d9f9ba4eda52605c8e532b4292807c3d54eb750cf88e111c304; bounded OOXML inspection reported a 6 x 9-inch page, mirrored margins, 0.75-inch inside/left margin, 0.5-inch top/right/bottom margins and zero separate gutter. This is an observation of public bytes and selected layout facts, not proof of download origin at task execution, current regional authority, legal clearance, manuscript quality, KDP preview/print acceptance or permission to publish.

[CC PR 367](https://github.com/wecreates/content-control/pull/367) merged exact tested head e61aaf1e25725eedd124ed7bd290c84f44785e0f as fe61c4405730ad8b8f9776d1102fc790478404c4; all 15 changed file blobs at the merge equal the tested-head blobs. KDP stored tasks now require a sixth immutable interior role for the retained language-scoped manuscript-template archive. The authenticated interior envelope binds its exact archive SHA-256 and safe DOCX member. Before artwork, the worker verifies the retained bytes, renews current Money Factory authority/lease between the cover-guide and interior-template inspections, and runs a bounded two-layer ZIP/OOXML parser that rejects symlinks and other nonregular entries, traversal, duplicate/encrypted/unsupported/oversized entries, wrong content type, wrong trim, multiple sections, absent mirrored margins, undersized margins and nonzero gutter. Independent QA repeats the source inspection and records the archive hash. Fixed diagnostics redact arbitrary child output. Publication flags remain false.

Local checks passed six dedicated archive-inspector tests, 90 actual PDF/book tests, 13 stored-task resolver tests and 56 production/template coordinator tests; Python compilation and Node syntax passed. The exact public English archive and 6 x 9 member also passed the offline inspector with the hashes and dimensions above. The aggregate QA suite was not run locally because OpenCV was unavailable; hosted runs supplied the pinned real dependency. [PR integration run 39518018939](https://github.com/wecreates/content-control/actions/runs/39518018939), job 118954871323, passed 624 main Node tests, 330 primary Python tests, one durable PostgreSQL/Python E2E and four workflow guards with zero failures. [Production-image run 39518018930](https://github.com/wecreates/content-control/actions/runs/39518018930), job 118954860308, passed the same 624 Node, 330 Python and one durable E2E suite under the image's non-root user, then returned publication false, production DISABLED and outbox DISABLED. The image was not pushed or made live by CI.

Dependent [MF PR 92](https://github.com/wecreates/Money-factory/pull/92) merged exact tested head a9d8d7e6d93aefc347eec6b0a24d0eb1a65a1ba2 as f93b018e914b3be2b97150914e77179061d8e9ec. Its merged workflow blob 2e7f00a4c56ad3f49e73011bd1cb20cb5e41b3cd equals the tested blob. It pins CC fe61c4405730ad8b8f9776d1102fc790478404c4 and explicitly runs the dedicated interior-template archive suite with both publication flags false. [Cross-repository run 39518684470](https://github.com/wecreates/Money-factory/actions/runs/39518684470), job 118956942302, passed 435 Node and 293 Python tests with zero failures. Its PostgreSQL 18 service was disposable CI, not the production database.

Render automatically attempted fe61c4405730ad8b8f9776d1102fc790478404c4 as deployment dep-dbc00ouk1f9s73bk5afg and reported build_failed at 2026-10-20T23:59:32.284481Z. The 2026-10-20T23:59:32.064831543Z log explicitly reports that the workspace exhausted build-pipeline minutes for the current billing period. No manual duplicate deployment, spend/plan change, replacement service, secret access, network widening or unchanged database-administration retry occurred. Live deployment of this repair remains unverified.

All 24 live acceptance areas remain OPEN. This closes only the identified technical gap for hash-bound retention and bounded inspection of an interior-template source archive. It does not establish a live dedicated database or recovery exercise, live Money Factory authority/grants/accounts, authorized market intelligence/concept/generation evidence, current regional rights, substantive editorial and calibrated independent review, actual KDP preview/print acceptance, five live marketplace adapter acceptances, economics/reconciliation, owner-phone operations, monitoring/security/capacity, end-to-end submission or controlled launch. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false; Etsy remains excluded. Synthetic fixtures, public-byte inspection and CI are not credentials, approvals, clearance, publication, revenue, live deployment or a continuously running self-hosted worker. This report-only receipt uses [skip render].

## Run r140 receipt — profile-free DeviceCMYK cover contract (2026-10-21)

Outcome: **technical implementation merged; live acceptance remains open**. This receipt records only observed code, CI, and deployment evidence. It does not claim KDP acceptance, subjective editorial/color approval, a physical proof, revenue, launch readiness, or completion of any of the 24 acceptance areas.

- Official source rechecked on 2026-10-21: Amazon KDP [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020). The current guidance says cover images should be CMYK, embedded color profiles are not recommended and are removed, spot colors are incompatible, and color spaces should not be mixed.
- Content Control PR [#369](https://github.com/wecreates/content-control/pull/369) merged as `5b24261c820cd048d9acdd83875bd4e2ff7ad070` from tested head `142c264527efa7a6a466579e9fe7f02c8bc9584d`. The merge contains the exact tested blobs: generator `44dd7315403eef4c1a75e1e3830448cb5a950b8e`, cover preflight `0e55fe46a81425af9f5423b9991e2466a34a2676`, vision QA `19f60e97ea083f024bd244951493ea9fd15ae3e4`, book-bound tests `e51b3bc56cb008bbcc983b440f0a905578b61530`, POD tests `30f30de2a22c6e28124de7010515de6a697baf03`, and editorial review `77001beade9e36dbc9a6ff09d702fd513c0d3b78`.
- The generator retains the exact RGB review PNG but embeds exactly one deterministic, profile-free, eight-bit `DeviceCMYK` raster in the delivered KDP cover PDF. The manifest and independent receipt declare `cover_color_space: DeviceCMYK`.
- Independent preflight now rejects RGB/grayscale/ICC/spot or mixed-space cover images; masks, profiles, alternate images and color modifiers; unsupported page groups or metadata; clipping, extra paint, text/drawings/contents; non-full-page transforms; and any decoded CMYK byte difference from the deterministic conversion of the exact reviewed RGB raster.
- Before merge, PR inspection caught that the first documentation update had been based on a stale local copy and would have deleted newer manuscript, source-font, retained-license and font-rights sections. The branch was rebuilt from the current main document and re-inspected; no concurrent evidence was lost.
- Local evidence: 184 targeted Python tests passed; four focused end-to-end KDP tests passed with the documented local no-op `cv2.dilate` compatibility stub because OpenCV was unavailable in that executor; changed Python files compiled successfully. Hosted CI used the real pinned OpenCV package.
- Hosted Content Control integration run [39520689623](https://github.com/wecreates/content-control/actions/runs/39520689623), job `118963690449`, passed all steps and 963 reported tests/checks with zero failures. Production-container run [39520689607](https://github.com/wecreates/content-control/actions/runs/39520689607), job `118963525563`, passed all steps and 959 reported tests/checks with zero failures, including the in-image Python, Node/PostgreSQL, real print/review workflow, and publication-disabled startup gates.
- Money Factory PR [#93](https://github.com/wecreates/Money-factory/pull/93) pinned the exact Content Control merge and added explicit CMYK-manifest plus passing original-title/font/full-pixel QA cases. Its cross-repository run [39521283701](https://github.com/wecreates/Money-factory/actions/runs/39521283701), job `118965449401`, passed all steps and 733 reported tests/checks with zero failures. PR #93 merged as `bf64fe50e73b2d2e7f87d96e9b9fd3d058974a9a`; the merged workflow blob is `8a07cd2c1f34413f3dd8ebfd29f39fedcf11991b`.
- Render automatically observed Content Control merge `5b24261c820cd048d9acdd83875bd4e2ff7ad070` as deploy `dep-dbc0cj68bjmc73d290t0`. At `2026-10-21T00:24:44.307635Z`, event `evt-dbc0cj1ocimc73aq8udg` reported `pipeline_minutes_exhausted`; the deploy ended `build_failed` at `2026-10-21T00:24:44.590903Z` before a build ran. No retry, paid resource, billing/configuration change, or live-deployment claim was made.

Safety state remains unchanged: `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. All 24 acceptance areas remain **OPEN** pending their required live/external evidence, including a successful deployment on the tested merge, current real production inputs and grants, independent human/legal/editorial approvals where required, platform preview/physical proof and account-side verification, measured live capacity/operations, financial reconciliation, end-to-end acceptance, and explicit controlled-launch approval.


## Run r141 receipt — hash-bound KDP book-details consistency (2026-10-21)

Outcome: **technical implementation merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim KDP account entry, preview or print acceptance, editorial/legal approval, publication, revenue, launch readiness, or completion of any of the 24 acceptance areas.

- Amazon KDP primary guidance was rechecked on 2026-10-20: [Book Details](https://kdp.amazon.com/en_US/help/topic/G201834260), [Title Setup](https://kdp.amazon.com/en_US/help/topic/G201097560), [ISBN](https://kdp.amazon.com/en_US/help/topic/G201834230), and [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020). The implemented contract supports English `en_US`, left-to-right interiors and title page 1 or 3; this is a bounded implementation choice, not a claim that every KDP format or locale is covered.
- Content Control PR [#371](https://github.com/wecreates/content-control/pull/371) merged exact tested head `636e9e228d3d79a1f8bafb05f786b1781ca2c433` as `40d76daec278270bdad9761c6b5d7b47da1a57b8`. Stored KDP tasks now require a seventh immutable interior role, `bookDetails`, and the production worker forwards it to independent review and QA.
- Independent QA reads the exact JSON fields `schema_version`, `title`, `subtitle`, `author_name`, `language`, `isbn`, `imprint` and `title_page`; rejects known KDP template placeholders; verifies title, optional subtitle and author as distinct front-cover layers within the front trim; verifies the selected title-page line sequence; and verifies optional ISBN/imprint occurrence in the first eight pages. The receipt records canonical `book_details_sha256` and strict `checks.book_details=true`.
- KDP release enforcement now requires exact boolean `true` for editorial, template provenance, manuscript provenance, source-font identity, current font-rights evidence and book-details consistency. Fixed reasons include `KDP_BOOK_DETAILS_REQUIRED`, `KDP_BOOK_DETAILS_INVALID`, `KDP_BOOK_DETAILS_MISMATCH` and `KDP_TEMPLATE_PLACEHOLDER`. The other four included POD platforms retain their existing contracts; Etsy remains outside this lane.
- Local focused evidence passed: three new Python book-details cases, 66 production/policy Node tests, 13 stored-task resolver tests, 10 focused release-policy tests and Python compilation. A broad local Python run initially reported 247/249 because two older passing fixtures lacked the new fail-closed evidence; those fixtures were upgraded and their focused reruns passed. An initial hosted run likewise exposed incomplete synthetic KDP PASS receipts; all valid fixtures were moved to the complete modern check set, and the release gate was strengthened for source-font and font-rights booleans. No weakened production check or fabricated receipt was used.
- Final Content Control integration run [39525077172](https://github.com/wecreates/content-control/actions/runs/39525077172) and production-container run [39525077264](https://github.com/wecreates/content-control/actions/runs/39525077264) both completed successfully on exact head `636e9e228d3d79a1f8bafb05f786b1781ca2c433`, including real pinned OpenCV in hosted execution, Node/Python suites, disposable PostgreSQL checks, non-root container checks and publication-disabled startup gates.
- Money Factory PR [#94](https://github.com/wecreates/Money-factory/pull/94) started from concurrent current main `bca54fe7fba16bd4390a704eb6714928525ade33`, preserving its unrelated free-monitor cadence change, and pinned the exact Content Control merge. Its exact head `ecfb56119c15b542f8d1a832c6593ee447be2e33` passed [cross-repository run 39525619492](https://github.com/wecreates/Money-factory/actions/runs/39525619492), job `118979440629`: every focused book-details/provenance/CMYK/editorial step, the full Content Control Node and Python suites, and the Money Factory consumer suites passed. Guarded merge produced `e7ae9b80da1789d7c7f1dd75c88e9136c9f7fbc3`.
- Render service `content-control-render-worker` remains the existing free, automatic, main-branch Docker service with `./Dockerfile`, `/health`, one instance and no configuration/network/plan change. It automatically attempted Content Control merge `40d76daec278270bdad9761c6b5d7b47da1a57b8` as deploy `dep-dbc111u8bjmc73d2tum0`. Event `evt-dbc11255rp0s73ed60cg` reported `pipeline_minutes_exhausted` at 2026-10-21T01:08:24.340426Z; deploy event `evt-dbc11261cdec73e5gl7g` ended failed at 2026-10-21T01:08:24.707847Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. This run closes a technical metadata-consistency gap and verifies it in both repositories, but code and CI are not live acceptance. Remaining evidence includes the production database role/access/migrations and retained recovery exercise; deployed hybrid hosting, Money Factory authority and current grants; authentic account, intelligence, concept, rights and original-generation inputs; official-template and substantive editorial/independent review approval; real remediation and KDP preview/physical proof; authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapter acceptance and safeguards; actual economics/reconciliation; mobile operations, monitoring, security and measured capacity; and controlled end-to-end launch evidence. No credible changed database-administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r142 receipt — fail-closed KDP title metadata policy (2026-10-20)

Outcome: **technical implementation merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim trademark or rights clearance, KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any of the 24 acceptance areas.

- Amazon KDP primary guidance was rechecked on 2026-10-20: [Books Titles & Editions](https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC), [Authors & Contributors](https://kdp.amazon.com/en_US/help/topic/G2BWJN2BY98T5PV2), [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740), and [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560). The current guidance limits title plus subtitle to 200 characters, rejects HTML in title/subtitle/author fields, and disallows sentinel-only or punctuation-only titles.
- A direct regression against the prior implementation reproduced five fail-open accepts: title `n/a`, punctuation-only title `!!!`, an HTML-bearing title, an HTML-bearing author, and a 100-character title plus 101-character subtitle. The previous per-field 200-character bounds allowed the combined 201-character value.
- Content Control PR [#373](https://github.com/wecreates/content-control/pull/373) changed only the independent metadata preflight, its real regression suite and the book-details contract. It rejects HTML tags, punctuation-only values and KDP's exact prohibited sentinel-only values across title/subtitle/author, and applies the shared 200-character limit to title plus subtitle before exact cover/manuscript comparison. It deliberately does not infer promotional intent, trademark permission, contributor truthfulness or substantive metadata quality.
- Local evidence passed all five new rejection cases, the three existing focused book-details tests, Python compilation, and all 67 tests in `tests/test_pod.py`. The full local file used the documented no-op `cv2.dilate` compatibility stub because OpenCV was unavailable; hosted CI used the real pinned OpenCV package.
- Exact tested Content Control head `9eee0403d303f55b1a771c3818361908ee7cde95` passed [integration run 39531652674](https://github.com/wecreates/content-control/actions/runs/39531652674), job `118998695968`, and [production-container run 39531652690](https://github.com/wecreates/content-control/actions/runs/39531652690), job `118998696677`. Both jobs completed every step successfully, including the full Python/Node/PostgreSQL gates; the production image also passed its non-root/runtime and publication-disabled startup checks. Guarded merge produced `f32b9c7556fefc5f80fa7b6e18f57492dab4553f`.
- Money Factory PR [#95](https://github.com/wecreates/Money-factory/pull/95) pinned that exact Content Control merge and added the new metadata regression to the existing focused KDP step. Exact head `e08054db215017496ec83f0907cbfa2b46fa37bc` passed [cross-repository run 39532139170](https://github.com/wecreates/Money-factory/actions/runs/39532139170), job `119000277203`: the focused KDP metadata/provenance/editorial/CMYK checks, full Content Control suites and Money Factory consumer suites all completed successfully. Guarded merge produced `cd7cd60fcea689f5977c20b0e924ca191abfde7f`.
- Render service `content-control-render-worker` remains the existing free, automatic main-branch Docker service with `./Dockerfile`, `/health`, one instance and no configuration/network/plan change. It automatically attempted Content Control merge `f32b9c7556fefc5f80fa7b6e18f57492dab4553f` as deploy `dep-dbc20urncjis73ejnagg`. Event `evt-dbc20v1kqasc73ftlnrg` reported `pipeline_minutes_exhausted` at 2026-10-21T02:16:28.217353Z, and event `evt-dbc20v36v2tc739ihsu0` ended the deploy failed at 2026-10-21T02:16:28.525610Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. This run closes a bounded lexical KDP metadata defect; code and CI are not live acceptance. Remaining evidence includes the production database role/access/migrations and retained recovery exercise; deployed hybrid hosting, Money Factory authority and current grants; authentic account, intelligence, concept, rights and original-generation inputs; official-template and substantive editorial/independent review approval; real remediation and KDP preview/physical proof; authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapter acceptance and safeguards; actual economics/reconciliation; mobile operations, monitoring, security and measured capacity; and controlled end-to-end launch evidence. No credible changed database-administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r143 receipt — immutable KDP edition, series and contributor binding (2026-10-20)

Outcome: **technical implementation merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim contributor truthfulness, rights clearance, KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any of the 24 acceptance areas.

- Amazon KDP primary guidance was rechecked on 2026-10-20: [Books Titles & Editions](https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC), [Authors & Contributors](https://kdp.amazon.com/en_US/help/topic/G2BWJN2BY98T5PV2), [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740), and [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560). The current guidance treats edition, series and contributor values as customer-facing setup metadata, requires manuscript metadata consistency, and allows at most ten contributors in total.
- Content Control PR [#375](https://github.com/wecreates/content-control/pull/375) upgraded the exact-key book-details contract to schema version 2. Optional edition number/display and series title/display, plus at most nine additional ordered role/name records (ten contributors including the primary author), are now canonical-hash inputs. Supplied display values and contributor names must each appear exactly once in the first eight manuscript pages. Malformed nested records, booleans masquerading as edition integers, duplicate contributor names, extra keys and contributor overflow fail closed. Version 1 tasks do not silently migrate; they require regenerated immutable descriptors and fresh Money Factory grants.
- Local evidence passed Python compilation, five focused KDP book-details tests, and all 68 tests in `tests/test_pod.py`. The full local file used the documented no-op `cv2.dilate` compatibility stub because OpenCV was unavailable; hosted CI used the real pinned OpenCV package.
- Exact tested Content Control head `689844c771c431a396401063b7435875dedc231b` passed [integration run 39533695090](https://github.com/wecreates/content-control/actions/runs/39533695090), job `119005312691`, and [production-container run 39533695125](https://github.com/wecreates/content-control/actions/runs/39533695125), job `119005681522`. Both jobs completed every step successfully, including the full Python/Node/PostgreSQL gates; the production image also passed non-root/runtime and publication-disabled startup checks. Guarded merge produced `0da7fd1a7c83cabbcc999b3d8adf7cbb2a89176d`.
- Money Factory PR [#96](https://github.com/wecreates/Money-factory/pull/96) pinned that exact Content Control merge and explicitly added the schema-v2 regression to the focused KDP step. Exact head `a31b3699110d153d687254a300eb8fb46f71d47f` passed [cross-repository run 39534334811](https://github.com/wecreates/Money-factory/actions/runs/39534334811), job `119007358391`; every pinned Content Control and Money Factory consumer step succeeded. Guarded merge produced `df86e6dec5be9b1ffab0161b87a281f79ec92e21`.
- Render service `content-control-render-worker` remains the existing free, automatic main-branch Docker service with `./Dockerfile`, `/health`, one instance and no configuration/network/plan change. It automatically attempted Content Control merge `0da7fd1a7c83cabbcc999b3d8adf7cbb2a89176d` as deploy `dep-dbc2c03m8hqs73bch0q0`. Event `evt-dbc2c09kqasc73fttrv0` reported `pipeline_minutes_exhausted` at 2026-10-21T02:40:01.249585Z, and event `evt-dbc2c0b6v2tc739iq02g` ended the deploy failed at 2026-10-21T02:40:01.649959Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. This run closes a bounded technical metadata-consistency gap; code and CI are not live acceptance. Remaining evidence includes the production database role/access/migrations and retained recovery exercise; deployed hybrid hosting, Money Factory authority and current grants; authentic account, intelligence, concept, rights and original-generation inputs; official-template and substantive editorial/independent review approval; real remediation and KDP preview/physical proof; authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapter acceptance and safeguards; actual economics/reconciliation; mobile operations, monitoring, security and measured capacity; and controlled end-to-end launch evidence. No credible changed database-administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r144 correction receipt — bind KDP metadata values to displayed manuscript text (2026-10-20)

Outcome: **technical correction merged; live acceptance remains open**. This receipt supersedes the r143 schema-shape claim with schema version 3 while retaining r143's historical test/deployment evidence. It records observed source, code, tests, CI and deployment state only; it does not claim contributor truthfulness, rights clearance, KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Post-merge adversarial review of schema version 2 found that an edition number or series title could be canonical-hash inputs while unrelated display text still appeared in the manuscript. Content Control PR [#377](https://github.com/wecreates/content-control/pull/377) corrected that second-order mismatch as schema version 3. Edition display text must contain the exact bounded decimal edition number. Series records now include an optional bounded integer number, and display text must contain the exact series title plus that decimal number when supplied. Numeric tokens use digit boundaries, so edition `2` cannot be satisfied by `12`. Schema versions 1 and 2 fail closed and require regenerated descriptors and fresh grants.
- The regression now rejects edition `2` displayed as `1st Edition`, a series display missing its bound title, and a series display containing the wrong bound number, in addition to malformed, boolean, duplicate and over-limit cases. Local Python compilation, all five focused book-details tests, and all 68 tests in `tests/test_pod.py` passed. The full local file used the documented no-op `cv2.dilate` compatibility stub because OpenCV was unavailable; hosted CI used the real pinned OpenCV package.
- Exact tested Content Control head `6903cb556a38b1a6d174384f471447067c2ff38f` passed [integration run 39535033470](https://github.com/wecreates/content-control/actions/runs/39535033470), job `119009606634`, and [production-container run 39535033332](https://github.com/wecreates/content-control/actions/runs/39535033332), job `119009606086`. Every step succeeded, including full Python/Node/PostgreSQL gates and the non-root publication-disabled production image. Guarded merge produced `396d4b41a9f881262345b93c880a829c97c193ae`.
- Money Factory PR [#97](https://github.com/wecreates/Money-factory/pull/97) pinned that exact merge. Exact head `d8ea0cfff205b141035fb0c595d3ce08938d14a2` passed [cross-repository run 39535484194](https://github.com/wecreates/Money-factory/actions/runs/39535484194), job `119011038050`; the schema-v3 regression and every other pinned consumer step succeeded. Guarded merge produced `becf9280e2618fa042620a7ea06f24bf06667f9b`.
- Render automatically attempted Content Control merge `396d4b41a9f881262345b93c880a829c97c193ae` as deploy `dep-dbc2i0ek1f9s73bmks90`. Event `evt-dbc2i09kqasc73fu2150` reported `pipeline_minutes_exhausted` at 2026-10-21T02:52:49.597295Z; event `evt-dbc2i0ek7voc739qr9u0` ended the deploy failed at 2026-10-21T02:52:49.830302Z. No build or live deployment was verified, and no manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. The unchanged production-database administration path was not retried because no credible access change appeared. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r145 receipt — fail closed on malformed KDP ISBN and imprint metadata (2026-10-20)

Outcome: **technical correction merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim ISBN ownership or agency registration, imprint rights, live KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Adversarial preflight reproduced that schema-version-3 book details accepted an arbitrary `not-an-isbn`, a checksum-invalid `ISBN-13: 978-0-306-40615-8`, the prohibited imprint sentinel `unknown`, and an HTML-bearing imprint. Content Control PR [#380](https://github.com/wecreates/content-control/pull/380) closes that fail-open path: a supplied ISBN must normalize to 13 digits, begin with 978 or 979, and pass the ISBN-13 weighted checksum; a supplied imprint now uses the existing normalized metadata-text guard and KDP's 100-character limit. The exact display strings remain bound to the manuscript. The validator explicitly does not infer ownership or compare against an ISBN-agency record.
- Local Python compilation, all five focused KDP book-details tests, and all 69 tests in `tests/test_pod.py` passed. The full local file used the documented no-op `cv2.dilate` compatibility stub because OpenCV was unavailable; hosted CI used the real pinned OpenCV package. Exact tested Content Control head `839f72e6073e75f9e6b8dedb1fb2d3b551da7231` passed [integration run 39536667619](https://github.com/wecreates/content-control/actions/runs/39536667619), job `119014777109`, and [production-container run 39536667634](https://github.com/wecreates/content-control/actions/runs/39536667634), job `119014776698`. Every reported step succeeded, including the full Python/Node/PostgreSQL gates and non-root publication-disabled production image. Guarded merge produced `dc10447fc342f4bc7cee082dd69459267fb51f81`.
- Money Factory PR [#98](https://github.com/wecreates/Money-factory/pull/98) pinned that exact Content Control merge and explicitly exercised the new ISBN/imprint regression. Exact head `57656e7cd9c14adf9f4173d067d931b6b9fb0f0d` passed [cross-repository run 39537139987](https://github.com/wecreates/Money-factory/actions/runs/39537139987), job `119016279768`; every reported step succeeded. Guarded merge produced `df813fc62b2772faf50bf79548e08d2f3b943a73`.
- Render automatically attempted Content Control merge `dc10447fc342f4bc7cee082dd69459267fb51f81` as deploy `dep-dbc2q6gu01pc73cqdqs0`. Event `evt-dbc2q6m1cdec73e6oui0` reported `pipeline_minutes_exhausted` at 2026-10-21T03:10:18.727834Z, and event `evt-dbc2q6r6v2tc739j3nv0` ended the deploy failed at 2026-10-21T03:10:19.211894Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r146 receipt — bind required KDP AI-generated content disclosure (2026-10-20)

Outcome: **technical correction merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim disclosure truthfulness, AI provenance, rights clearance, live KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Amazon's current [KDP Content Guidelines](https://kdp.amazon.com/en_US/help/topic/G200672390) require publishers to disclose AI-generated text, images or translations, including AI-generated cover and interior artwork. The prior immutable book-details contract had no field capable of carrying those required answers. Content Control PR [#382](https://github.com/wecreates/content-control/pull/382) closes that omission as schema version 4: `ai_generated` must contain exactly three strict booleans named `text`, `images` and `translations`. The declaration becomes part of the canonical task-owned book-details hash. Schema versions 1 through 3 fail closed and require regeneration plus a fresh Money Factory grant. The validator deliberately does not classify content, infer truthful answers or claim the same values were entered into KDP; generation provenance, independent review and account readback remain separate live evidence.
- Local Python compilation, all six focused KDP book-details tests, and all 70 tests in `tests/test_pod.py` passed against the exact branch content. The full local file used the documented no-op `cv2.dilate` compatibility stub because OpenCV was unavailable; hosted CI used the real pinned OpenCV package. Exact tested Content Control head `451dba0c648931920d1e1ed81daed543305f10a5` passed [integration run 39538677524](https://github.com/wecreates/content-control/actions/runs/39538677524), job `119021160117`, and [production-container run 39538677502](https://github.com/wecreates/content-control/actions/runs/39538677502), job `119021159674`. Every reported step succeeded, including full Python/Node/PostgreSQL gates and the non-root publication-disabled production image. Guarded merge produced `c0e8070c0bb968955c07305b00acdb5118495c50`.
- Money Factory PR [#99](https://github.com/wecreates/Money-factory/pull/99) pinned that exact Content Control merge and explicitly exercised the schema-v4 disclosure regression. Exact head `f2785b8322d01c92ad1b99477ca2a7b46b915117` passed [cross-repository run 39539053028](https://github.com/wecreates/Money-factory/actions/runs/39539053028), job `119022335411`; every reported step succeeded. Guarded merge produced `7b20ae86a1edc8deb2fb365905c156a819f16f58`.
- Render automatically attempted Content Control merge `c0e8070c0bb968955c07305b00acdb5118495c50` as deploy `dep-dbc3416q1p3s73bi4gp0`. Event `evt-dbc341d1p73c738eiugg` reported `pipeline_minutes_exhausted` at 2026-10-21T03:31:17.003860Z, and event `evt-dbc341e1cdec73e6vo5g` ended the deploy failed at 2026-10-21T03:31:17.288726Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r147 receipt — enforce KDP weekly paperback submission limit (2026-10-21)

Outcome: **technical safeguard merged; live acceptance remains open**. This receipt records observed source, code, tests, CI and deployment state only. It does not claim live KDP account headroom, external-account activity, platform acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Amazon's current [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740) guidance says KDP permits up to two title creations and up to two new-title submissions per book format per week, with limits kept separately by format and reset every Sunday at 00:00 UTC; updates to previously submitted books do not count against the submission limit. Content Control PR [#384](https://github.com/wecreates/content-control/pull/384) adds a durable KDP-only paperback submission guard before publish state transition or quota reservation. It counts distinct local KDP job reservations since the Sunday UTC boundary, admits the first two, holds a third distinct job, and allows a retry of the same durable job or an update backed by an existing provider receipt. Other marketplace adapters retain the existing rolling-24-hour attempt cap. The safeguard is intentionally conservative for older unreceipted attempts and does not observe titles created or submitted outside this system.
- Local verification passed `node --check pod-db-bridge.js` and all four deterministic cases in `tests/pod-kdp-weekly-submission.test.mjs`: first/second distinct jobs admitted, third held, same durable job admitted, and non-KDP paths excluded. A PostgreSQL integration helper also exercises the first claim, same-week retry, second distinct claim, third-job hold, and Sunday-boundary reset without provider calls or publication.
- The first hosted integration attempt at exact head `3d58170a18a903eb3192f90445db33ab3967effa` failed [run 39539908735](https://github.com/wecreates/content-control/actions/runs/39539908735), job `119025037813`, because the new PostgreSQL fixture used one parameter as both integer and interval text and PostgreSQL could not infer one type. The fixture was repaired with an explicit `$4::integer` cast; production behavior was unchanged. Exact corrected head `097a55101dd20543b634bce8c037c38ae1d266d0` then passed [integration run 39540012190](https://github.com/wecreates/content-control/actions/runs/39540012190), job `119025363170`, and [production-container run 39540012142](https://github.com/wecreates/content-control/actions/runs/39540012142), job `119025448940`. Every reported step succeeded, including the full Node/PostgreSQL and Python gates and the non-root publication-disabled production image. Guarded merge produced `7fd641fe6af8c4d528943beabca3978fb7a52b5c`.
- Money Factory PR [#100](https://github.com/wecreates/Money-factory/pull/100) pinned that exact Content Control merge and explicitly added the KDP weekly-submission regression to its cross-repository contract. Exact head `c3a910adcc586c2039b71e9cb93f2ee998dfc6ac` passed [cross-repository run 39540507999](https://github.com/wecreates/Money-factory/actions/runs/39540507999), job `119026907107`; every reported step succeeded. Guarded merge produced `66952cbffd6bb123e962ea6255f7565fb43e9de3`.
- Render automatically attempted Content Control merge `7fd641fe6af8c4d528943beabca3978fb7a52b5c` as deploy `dep-dbc3bd3ncjis73eksvog`. Event `evt-dbc3bd1kqasc73fuikm0` reported `pipeline_minutes_exhausted` at 2026-10-21T03:47:00.793357Z, and event `evt-dbc3bd9kqasc73fuikng` ended the deploy failed at 2026-10-21T03:47:01.225890Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.
- The local reservation ledger cannot observe KDP titles created or submitted outside this system, so it cannot prove live weekly headroom. The separate KDP creation limit remains dependent on authorized account evidence, and no live KDP adapter/account readback or production deployment acceptance was obtained.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r148 receipt — bind publish claims to the configured account marketplace (2026-10-20)

Outcome: **technical safeguard merged; live acceptance remains open**. This receipt records observed code, tests, CI and deployment state only. It does not claim real marketplace account configuration, adapter authorization, provider acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Reinspection found that `PodDB.claimPublish` locked an account and selected a ready row by `account_id`, but did not require the queued row's `platform` to equal the locked account's configured `platform` until `assertPublishable` later in the release path. A malformed cross-platform row could therefore consume a quota reservation and enter `publishing` before the later check blocked release. Content Control PR [#386](https://github.com/wecreates/content-control/pull/386) adds the marketplace predicate to the locking claim query before any state transition or reservation. The focused regression proves a mismatched row remains untouched and consumes no quota.
- Exact tested Content Control head `6944e300a8b99ca41004e5fdb6233efa091176f3` passed [integration run 39542484251](https://github.com/wecreates/content-control/actions/runs/39542484251), job `119033139192`, and [production-container run 39542484210](https://github.com/wecreates/content-control/actions/runs/39542484210), job `119033138767`. Every reported step succeeded, including the full Node/PostgreSQL and Python gates, the production image, non-root runtime, durable review workflow, and hosted startup with publication and production disabled. Guarded merge produced `7fd58b47c635e54fd10cd8742e68944f93349013`.
- Money Factory PR [#101](https://github.com/wecreates/Money-factory/pull/101) pinned that exact Content Control merge and explicitly exercised the new cross-platform claim regression. Exact head `1bea39ced90e86ea555e1ce7b44d1fa097bc050e` passed [cross-repository run 39542958362](https://github.com/wecreates/Money-factory/actions/runs/39542958362), job `119034643263`; every reported step succeeded. Guarded merge produced `7f4ceb0f2c5b856a2c45ba7c5ce00c7e0868970b`.
- Render automatically attempted Content Control merge `7fd58b47c635e54fd10cd8742e68944f93349013` as deploy `dep-dbc3o7m8bjmc73d5gha0`. Event `evt-dbc3o7hkqasc73fur5d0` reported `pipeline_minutes_exhausted` at 2026-10-21T04:14:22.772186Z, and event `evt-dbc3o7pkqasc73fur5gg` ended the deploy failed at 2026-10-21T04:14:23.086452Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.
- Amazon's separate weekly title-creation limit was not converted into another local counter: local state cannot observe titles created outside this worker, so live account-side evidence remains required. The existing weekly first-submission safeguard remains a necessary local control, not proof of live KDP headroom.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r149 receipt — bind KDP discovery metadata to the reviewed package (2026-10-21)

Outcome: **technical metadata contract merged; live acceptance remains open**. This receipt records observed official guidance, code, tests, CI and deployment state only. It does not claim metadata relevance or effectiveness, publishing-rights ownership, category availability, live KDP account readback, platform acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Amazon's current [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201953870), [Keywords](https://kdp.amazon.com/en_US/help/topic/G201298500), [Categories](https://kdp.amazon.com/en_US/help/topic/G200652170), and [Book Description](https://kdp.amazon.com/en_US/help/topic/G201189630) guidance requires or constrains the customer-facing description, keywords, primary marketplace and categories. Content Control PR [#388](https://github.com/wecreates/content-control/pull/388) upgrades the immutable KDP book-details contract to schema version 5 and binds those values plus an explicit publishing-rights declaration to the canonical task-owned hash. The current en_US lane requires primary marketplace `amazon.com`, one to three unique category paths, no more than seven unique keyword phrases, a bounded plain-text description of at most 4,000 characters, and `copyright_owner` publishing rights. The plain-text description is an intentionally narrower supported subset than KDP's allowed formatting. Public-domain publication is unsupported until separate evidence and workflow requirements exist.
- The validator rejects legacy schema version 4, missing or oversized descriptions, URL/email or HTML-bearing descriptions, duplicate/over-limit/HTML-bearing keywords, wrong primary marketplace, empty/over-limit/duplicate categories, and the unsupported public-domain rights path. Valid empty keyword lists remain allowed. Exact tested Content Control head `4ee262e9366e1cbbbc8205cb4d74c1483de8edfe` passed [integration run 39547986421](https://github.com/wecreates/content-control/actions/runs/39547986421), job `119050413301`, and [production-container run 39547986484](https://github.com/wecreates/content-control/actions/runs/39547986484), job `119050413717`. Every reported step succeeded, including the full Node/Python/PostgreSQL gates and the non-root publication-disabled production image. Guarded merge produced `433a8e3193abae62778a59a966f1195b51b7bb16`.
- Money Factory PR [#102](https://github.com/wecreates/Money-factory/pull/102) pinned that exact Content Control merge and explicitly added the discovery-metadata regression to its cross-repository contract. Exact head `0f795f44e9bd16f9871405a359398635a7446be0` passed [cross-repository run 39548473522](https://github.com/wecreates/Money-factory/actions/runs/39548473522), job `119051965927`; every reported step succeeded. While it ran, Money Factory main advanced only through unrelated free-monitor state/event files to `f90599bfb9ed72a6d6a1acf076f25321b371c52b`; that concurrent work was preserved. The guarded merge then produced `af2ec1c788c5acc9afc489e23ff48cb6a1452c5f`.
- Render automatically attempted Content Control merge `433a8e3193abae62778a59a966f1195b51b7bb16` as deploy `dep-dbc4kfmk1f9s73boi8o0`. Event `evt-dbc4kfj6v2tc739k8g30` reported `pipeline_minutes_exhausted` at 2026-10-21T05:14:38.968538Z, and event `evt-dbc4kft5rp0s73efj9i0` ended the deploy failed at 2026-10-21T05:14:39.280155Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.
- Metadata shape and hash binding do not establish that the chosen description, keywords or categories are relevant or effective, and a declaration does not prove publishing-rights ownership. Independent editorial/rights review, current marketplace category evidence, authorized account entry and live KDP readback remain required.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].


## Run r150 receipt — bind signed KDP cover and interior print options (2026-10-21)

Outcome: **technical package-boundary safeguard merged; live acceptance remains open**. This receipt records observed official guidance, code, tests, CI and deployment state only. It does not claim current official-template coverage beyond the retained fixture, live KDP option readback, physical-proof acceptance, publication, revenue, launch readiness, or completion of any acceptance area.

- Amazon's current [Print Options](https://kdp.amazon.com/en_US/help/topic/G201834180), [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020), and [title setup guidance](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6) make binding/product format, ink and paper type, trim, bleed and cover finish part of print-book setup. Reinspection found that Content Control authenticated cover and interior templates separately but only compared page count and trim geometry when assembling them. A signed interior for another binding, ink type or paper stock could therefore be paired with a signed cover for a different print product before later review.
- Content Control PR [#390](https://github.com/wecreates/content-control/pull/390) now rejects mismatched `binding`, `ink_type`, or `paper_type` before rendering the interior, while preserving the existing page-count and trim-geometry checks. The three focused regressions exercise a hardcover interior against a paperback cover, premium-color against black ink, and cream against white paper. The package does not infer or rewrite a selection.
- Exact tested Content Control head `cc0fffe1c09540323c93caafe0f4eee1af7e4a7e` passed [integration run 39550418991](https://github.com/wecreates/content-control/actions/runs/39550418991), job `119058096375`, and [production-container run 39550418934](https://github.com/wecreates/content-control/actions/runs/39550418934), job `119058096133`. Every reported step succeeded, including the full Node/Python/PostgreSQL gates, production image, non-root runtime and hosted startup with publication and production disabled. Fresh main/head, clean mergeability and the exact tested head were rechecked before guarded merge `281cd605f187a94db4337da470bcf171116bf0b3`.
- Money Factory PR [#103](https://github.com/wecreates/Money-factory/pull/103) pinned that exact Content Control merge and explicitly exercised the new print-option mismatch regression. Exact head `4e91315541a2faa1f092fbb85a74ee848286e00b` passed [cross-repository run 39550896631](https://github.com/wecreates/Money-factory/actions/runs/39550896631), job `119059601070`; every reported step succeeded. Main/head and clean mergeability were rechecked before guarded merge `38d6d01e3aa05c1e3bfd43db9dea4017718777eb`.
- Render automatically attempted Content Control merge `281cd605f187a94db4337da470bcf171116bf0b3` as deploy `dep-dbc50f3ncjis73emfppg`. Event `evt-dbc50f295das73d4l14g` reported `pipeline_minutes_exhausted` at 2026-10-21T05:40:12.956892Z, and event `evt-dbc50fe1cdec73e862ig` ended the deploy failed at 2026-10-21T05:40:13.271534Z. No build or live deployment of this revision was verified. No manual retry, cache clear, spend/plan change, replacement service, secret access or network widening occurred.
- Exact template agreement is necessary but does not establish that the selected options are available or correctly entered in the authorized KDP account, that cover finish is read back, or that the resulting physical book is acceptable. Those remain live account, current-template and proof-review evidence.

All 24 live acceptance areas remain **OPEN** under `POD_COMPLETION_CHECKLIST.md`. Code and CI do not satisfy live acceptance. No credible changed production-database administration path was observed, so the unchanged failed connector/browser route was not retried. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; Etsy remains excluded. Evidence is from bounded available local and hosted execution, not a continuously running self-hosted worker. This report-only receipt uses [skip render].

## Run receipt r151 — KDP cover-finish task binding (2026-10-21 UTC)

### Scope and decision

The highest-priority unblocked package-integrity gap was KDP cover finish. Official
KDP print setup requires a matte or glossy selection, but the immutable task package
did not previously own that choice. This run added a fail-closed schema v6 contract
for the selection. It did not claim that the same value was entered in a live KDP
account. Etsy remained excluded. No database administration was retried because no
credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #392 exact tested head: `e36734ce2f2795bd0539f35145150bd68a2d1e70`.
- The book-details schema now requires exact lowercase `cover_finish` value
  `matte` or `glossy`; non-string, unsupported, omitted/extra, and legacy
  schema-v5 records fail closed.
- The canonical book-details hash now distinguishes matte from glossy, so a change
  requires a new task descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_bind_cover_finish` proves both supported
  selections pass, their canonical hashes differ, and invalid/unhashable values
  are rejected.
- POD integration gates run `39556085942`, job `119076059162`: success.
- POD container runtime gates run `39556085914`, job `119076059165`: success,
  including production-image Python/Node/PostgreSQL tests and startup with
  publication disabled.
- Guarded merge commit: `56a3859a62c423408d08a1700191c7efc8179bb0`.

### Money Factory dependent pin and hosted verification

- PR #104 exact tested head: `f5be9adce0ff9eb32b7b74a81f6a5b635e5df132`.
- Cross-repository workflow pins Content Control merge
  `56a3859a62c423408d08a1700191c7efc8179bb0` and explicitly runs the new
  cover-finish regression.
- POD cross-repository review verification run `39556684285`, job
  `119077973921`: success.
- Guarded Money Factory merge commit:
  `11d3adc5aa05f26d90883804264840cf562db9cc`.

### Authorized Render verification

- Authorized service `content-control-render-worker`
  (`srv-darsdb8u01pc73dn4i2g`) remains an unsuspended one-instance free Docker
  service on `main` with commit-triggered auto-deploy.
- Render detected Content Control merge `56a3859a...` and created deploy
  `dep-dbc5rk3m8hqs73bfq0eg`.
- Event `evt-dbc5rke1cdec73e8nifg` recorded `pipeline_minutes_exhausted` at
  `2026-10-21T06:38:09.264557Z`; event
  `evt-dbc5rk8bfp9s73b2e34g` recorded the deploy ended failed at
  `2026-10-21T06:38:09.566720Z`.
- Therefore hosted rollout of this merge is not verified. No paid capacity,
  manual retry, or infrastructure widening was attempted.

### Acceptance truth

This closes a code-and-hosted-CI consistency gap only. It is not live KDP readback,
physical-proof acceptance, live database durability/recovery, live reconciliation,
live adapter publication, or controlled-launch evidence. All 24 acceptance areas
remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted.

## Run receipt r152 — KDP primary-audience task binding (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)
- [Primary Audience and Reading Age](https://kdp.amazon.com/en_US/help/topic/G201506310)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)

KDP requires a Yes/No answer for sexually explicit images or title, while reading
age is optional and KDP publishes five age bands. The task package previously did
not own either answer, leaving an operator-visible submission choice outside the
authorized descriptor. This run bound the answers without claiming that code can
classify content or prove what was entered in a live KDP account. Etsy remained
excluded. The failed production-database administration route was not retried
because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #394 exact tested head: `f89605aa22622505e82188e13c48241f4d9a1aac`.
- Schema v7 requires exact `primary_audience` keys:
  `sexually_explicit` as a boolean and `reading_age` as null or one of
  0–2, 3–5, 6–8, 9–12, or 13–17. Legacy schema v6, missing/extra keys,
  type-confused booleans, empty age objects and cross-band ranges fail closed.
- Both values are included in the canonical book-details hash; changing them
  requires a new task descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_bind_primary_audience` proves all five
  supported age bands, canonical hash separation and invalid-value rejection.
- POD integration gates run `39567809056`, job `119114245104`: success.
- POD container runtime gates run `39567808873`, job `119114244331`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `cb4ac8c98140c80bfddda3616b3ce87a0824c08e`.

### Money Factory dependent pin and hosted verification

- PR #105 exact tested head: `678374ea68c10a17dd2fbc261079d8611f793359`.
- The cross-repository workflow pins Content Control merge
  `cb4ac8c98140c80bfddda3616b3ce87a0824c08e` and explicitly runs the
  primary-audience regression.
- POD cross-repository review verification run `39568504775`, job
  `119116562937`: success.
- Guarded Money Factory merge:
  `b360cf4c743519756b1af018af818a6a8f8a084a`.

### Authorized Render verification

- Render detected Content Control merge `cb4ac8c...` and created deployment
  `dep-dbc7bbm8bjmc73d91rcg`.
- Event `evt-dbc7bbgbfp9s73b3f6qg` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T08:19:58.711208Z`.
- Event `evt-dbc7bbhocimc73av02a0` recorded the deployment ended failed at
  `2026-10-21T08:19:58.962051Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-consistency gap only. It does not establish substantive
audience/category correctness, independent editorial or rights approval, live KDP
readback, physical-proof acceptance, production database/recovery, live adapter
acceptance, economics/reconciliation, end-to-end publication, or launch readiness.
All 24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted.


## Run receipt r153 — KDP substantive-book classification binding (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Low-Content Books](https://kdp.amazon.com/en_US/help/topic/GGE5T76TWKA85DJM)
- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)
- [ISBN and Imprint](https://kdp.amazon.com/en_US/help/topic/G200736410)

KDP exposes a Low-content checkbox during print-book setup. Its selection affects
ISBN eligibility and other book capabilities, and an incorrect selection can cause
rejection. The supported CYZOR lane produces a substantive text interior, but the
task package previously did not bind the corresponding answer. This run makes that
operator-visible answer explicit without claiming that code can classify arbitrary
content or prove what was entered in a live KDP account. Etsy remained excluded.
The failed production-database administration route was not retried because no
credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #396 exact tested head: `4122af52d94e551d1f92f5acb0b1bc59629d6ef3`.
- Schema v8 requires exact boolean `low_content: false`; `true`, missing/null,
  numeric, string, object and array values fail closed.
- The value is included in the canonical book-details hash, so changing it
  requires a new task descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_require_substantive_book_lane` proves the
  accepted value and type-confused/unsupported-value rejection.
- POD integration gates run `39575022623`, job `119138294899`: success.
- POD container runtime gates run `39575022709`, job `119138295242`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `adbcd0966e17a9fdc8efb9a8fbd832dbfa167869`.

### Money Factory dependent pin and hosted verification

- PR #106 exact tested head: `2e5507d666153c4375d6e651cf55a36cd48f6479`.
- The cross-repository workflow pins Content Control merge
  `adbcd0966e17a9fdc8efb9a8fbd832dbfa167869` and explicitly runs the
  substantive-book classification regression.
- POD cross-repository review verification run `39575830107`, job
  `119140993137`: success.
- Guarded Money Factory merge:
  `d4fa54f6b16416b5c2404cf8fb4aeadb12728869`.

### Authorized Render verification

- Render detected Content Control merge `adbcd096...` and created deployment
  `dep-dbc8650473hc73a4jcvg`.
- Event `evt-dbc865295das73d6rpp0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T09:17:08.615142Z`.
- Event `evt-dbc865ek7voc739ulafg` recorded the deployment ended failed at
  `2026-10-21T09:17:09.641360Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-consistency gap only. It does not establish live KDP
readback, physical-proof acceptance, production database/recovery, live adapter
acceptance, economics/reconciliation, end-to-end publication, or controlled
launch readiness. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.


## Run receipt r154 — KDP ISBN-source binding (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [What is an ISBN and Imprint?](https://kdp.amazon.com/en_US/help/topic/G201834170)
- [Get an ISBN](https://kdp.amazon.com/en_US/help/topic/GTJ8LBXL6Z4WV5QX)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)
- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)

Substantive KDP paperbacks require an ISBN. KDP offers either a free KDP-only
ISBN, whose imprint is assigned as “Independently published,” or an owner-supplied
ISBN whose title, author and imprint must match the ISBN agency record. The task
package previously allowed null ISBN/imprint without owning that choice and also
allowed incomplete owner-supplied pairings. This run bound the choice without
claiming ISBN ownership, agency registration or live KDP readback. Etsy remained
excluded. The failed production-database administration route was not retried
because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #398 exact tested head: `5fb9287892227536f68429988f2b50544c97aea5`.
- Schema v9 requires exact `isbn_source` value `kdp_free` or `owned`.
- `kdp_free` requires null ISBN and imprint; `owned` requires both a
  checksum-valid 978/979 ISBN and nonempty imprint. Missing, mixed and
  unsupported pairings fail closed.
- The choice and paired values are included in the canonical book-details hash;
  changing them requires a new descriptor and fresh Money Factory authority.
- The strengthened
  `PODTests.test_kdp_book_details_validate_isbn_and_imprint` regression proves
  both valid paths and invalid pairings, while existing front-matter matching
  retains exact owner-supplied ISBN/imprint checks.
- POD integration gates run `39582328399`, job `119162676750`: success.
- POD container runtime gates run `39582328524`, job `119162676556`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `b683b560a66ad81e902e5b99f0ad98ab3db66898`.

### Money Factory dependent pin and hosted verification

- PR #107 exact tested head: `9c139b668fa5e2edb70e84585048ebbb6c1c3e81`.
- The cross-repository workflow pins Content Control merge
  `b683b560a66ad81e902e5b99f0ad98ab3db66898` and runs the strengthened
  ISBN/imprint regression.
- POD cross-repository review verification run `39583049335`, job
  `119165089580`: success.
- Concurrent main commit `605dfc0b4a53c2d59e8a4f4b68f68ebcfc6ca3c5`
  changed only free-monitor event/state data; it was inspected and preserved.
- Guarded Money Factory merge:
  `b7eae39bdd4841c7438914cb4753fc33b948d700`.

### Authorized Render verification

- Render detected Content Control merge `b683b560...` and created deployment
  `dep-dbc90ih5efls73bh15jg`.
- Event `evt-dbc90il5rp0s73eil2v0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T10:13:30.864471Z`.
- Event `evt-dbc90iuk7voc739vad1g` recorded the deployment ended failed at
  `2026-10-21T10:13:31.418974Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-consistency gap only. It does not establish ISBN ownership,
live KDP readback, physical-proof acceptance, production database/recovery, live
adapter acceptance, economics/reconciliation, end-to-end publication, or
controlled launch readiness. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.


## Run receipt r155 — KDP new-publication release binding (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)
- [Release Date Options](https://kdp.amazon.com/en_US/help/topic/GZUV7SNV728WT4QE)
- [Schedule a Release](https://kdp.amazon.com/en_US/help/topic/GDTMGBCWHAY35NK4)
- [Update Your Book Details](https://kdp.amazon.com/en_US/help/topic/G200736410)

KDP instructs first-time publishers to leave Publication Date blank and choose a
release option. The supported lane creates original, first-publication substantive
books, so it now binds the blank date and release-now choice instead of leaving
those operator-visible inputs implicit. Scheduled releases remain unsupported
because their five-day lock/deadline creates a separate operational risk. This
does not authorize publication or prove live KDP entry. Etsy remained excluded.
The failed production-database administration route was not retried because no
credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #400 exact tested head: `e2844e3da91ace04b2fb11dfd6cdc11277e43513`.
- Schema v10 requires exact `publication_date: null` and
  `release_plan: { "mode": "release_now", "date": null }`.
- Prior-date strings, type-confused blanks, missing/extra release keys, scheduled
  mode and a date attached to release-now fail closed.
- Both fields are included in the canonical book-details hash; changing them
  requires a new descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_bind_new_release_setup`.
- POD integration gates run `39588988136`, job `119184904393`: success.
- POD container runtime gates run `39588988065`, job `119184904337`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `e132ad2b9fe587154edff5d7594fd6bbde8b2d50`.

### Money Factory dependent pin and hosted verification

- PR #108 exact tested head: `4a298e15f362328a0d17c508d5217780ee560960`.
- The cross-repository workflow pins Content Control merge
  `e132ad2b9fe587154edff5d7594fd6bbde8b2d50` and explicitly runs the
  publication-date/release-plan regression.
- POD cross-repository review verification run `39589721571`, job
  `119187353166`: success.
- Guarded Money Factory merge:
  `0c3ace5b0f98f3fcf355024f661f7c7601dea521`.

### Authorized Render verification

- Render detected Content Control merge `e132ad2b...` and created deployment
  `dep-dbc9q30473hc73a6l9bg`.
- Event `evt-dbc9q336v2tc739o154g` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T11:07:56.356552Z`.
- Event `evt-dbc9q355rp0s73ej9ipg` recorded the deployment ended failed at
  `2026-10-21T11:07:56.672595Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-consistency gap only. It does not establish live KDP
readback, actual preview/proof acceptance, production database/recovery, live
adapter acceptance, economics/reconciliation, end-to-end publication, or
controlled launch readiness. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.


## Run receipt r156 — KDP Expanded Distribution opt-out (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Expanded Distribution](https://kdp.amazon.com/en_US/help/topic/GQTT4W3T5AYK7L45)
- [Paperback and Hardcover Distribution Rights](https://kdp.amazon.com/en_US/help/topic/G201834280)
- [Paperback Royalty](https://kdp.amazon.com/en_US/help/topic/G201834330)
- [Print Book Pricing Page](https://kdp.amazon.com/en_US/help/topic/G8BKPU9AGVZSF9QF)

Expanded Distribution is optional and can expose eligible paperbacks through
bookstores, libraries, academic institutions and other retailers outside Amazon.
It has separate US/UK territorial-rights requirements and a 40% royalty basis
before printing cost. Metadata changes can take up to eight weeks to propagate.
Because current regional-rights, ISBN eligibility, live price/cost/royalty and
KDP readback evidence are absent, the supported bounded lane now requires an
explicit opt-out rather than silently enrolling. This does not select standard
Amazon sales territories or claim any rights. Etsy remained excluded. The failed
production-database administration route was not retried because no credible
access-path change was observed.

### Content Control implementation and hosted verification

- PR #402 exact tested head: `6a03a12439f6a3d107682c0f76acd7360cff0897`.
- Schema v11 requires exact `expanded_distribution: false`; true, null,
  type-confused values and omission fail closed.
- The value is included in the canonical book-details hash; changing it requires
  a new descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_require_expanded_distribution_opt_out`.
- POD integration gates run `39596605906`, job `119210360582`: success.
- POD container runtime gates run `39596605601`, job `119210358744`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `42d2ba06890b999969f70c15b8cdf95db260aafd`.

### Money Factory dependent pin and hosted verification

- PR #109 exact tested head: `dacfb7099a5ad83838f90a53e992fc79191e3f61`.
- The cross-repository workflow pins Content Control merge
  `42d2ba06890b999969f70c15b8cdf95db260aafd` and explicitly runs the
  Expanded Distribution opt-out regression.
- POD cross-repository review verification run `39597441829`, job
  `119213161662`: success.
- Guarded Money Factory merge:
  `3393008af61b096cc1329b490f5127aba9476c8e`.

### Authorized Render verification

- Render detected Content Control merge `42d2ba0...` and created deployment
  `dep-dbcan0m8bjmc73dd6mig`.
- Event `evt-dbcan0hocimc73b1kocg` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T12:09:38.328605Z`.
- Event `evt-dbcan0j6v2tc739oqk40` recorded the deployment ended failed at
  `2026-10-21T12:09:38.708784Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-consistency and distribution-scope safeguard only. It does
not establish regional rights, ISBN distribution eligibility, live KDP
price/cost/royalty readback, actual preview/proof acceptance, production
database/recovery, live adapter acceptance, financial reconciliation,
end-to-end publication, or controlled launch readiness. All 24 acceptance areas
remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted.

## Run receipt r157 — bounded KDP territory selection (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Paperback and Hardcover Distribution Rights](https://kdp.amazon.com/en_US/help/topic/G201834280)
- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)
- [Troubleshoot search results: Review selected territories](https://kdp.amazon.com/en_US/help/topic/GFJUYYXPBB4QA2WJ)

KDP requires a worldwide or individual-territory rights choice for print titles.
Verified worldwide territorial evidence is absent, so the bounded supported lane
now rejects worldwide scope and binds an exact individual United States
selection. This limits task intent but does not prove U.S. rights or live KDP
entry. Etsy remained excluded. The failed production-database administration
route was not retried because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #404 exact tested head: `23e8e071f3002ac944b0ad3129a056b7acdb96d8`.
- Schema v12 requires exact
  `distribution_rights: { "scope": "individual", "territories": ["US"] }`.
  Worldwide, empty, non-US, multi-territory, missing and extra-key forms fail
  closed.
- The selection is included in the canonical book-details hash; changing it
  requires a new descriptor and fresh Money Factory authority.
- Focused regression:
  `PODTests.test_kdp_book_details_bind_individual_us_distribution_rights`.
- POD integration gates run `39605417187`, job `119240235628`: success.
- POD container runtime gates run `39605417323`, job `119240237739`: success,
  including in-image Python/Node/PostgreSQL tests, real print/review workflow,
  and startup with publication disabled.
- Guarded Content Control merge:
  `db1eb6debd302ebde2a425db66c089f6538cfe7b`.

### Money Factory dependent pin and hosted verification

- PR #110 exact tested head: `432c7ed665c7c41f8349f202958f17ac13d99db5`.
- The cross-repository workflow pins Content Control merge
  `db1eb6debd302ebde2a425db66c089f6538cfe7b` and explicitly runs the
  individual-US territory regression.
- POD cross-repository review verification run `39606509275`, job
  `119243958710`: success.
- Guarded Money Factory merge:
  `0d9329690d3058d803863b92ce4ca5f932030d5a`.

### Authorized Render verification

- Render detected Content Control merge `db1eb6d...` and created deployment
  `dep-dbcbm167bikc73ftalog`.
- Event `evt-dbcbm11ocimc73b2i5r0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T13:15:48.644426Z`.
- Event `evt-dbcbm19kqasc7384tpig` recorded the deployment ended failed at
  `2026-10-21T13:15:49.030245Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes an implicit-territory package gap only. It does not establish
regional-rights evidence, live KDP readback, price/cost/royalty readback,
preview/proof acceptance, production database/recovery, live adapter acceptance,
financial reconciliation, end-to-end publication, or controlled launch
readiness. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.

## Run receipt r158 — KDP list-price/economics binding (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Paperback Royalty](https://kdp.amazon.com/en_US/help/topic/G201834330)
- [Print Book Pricing Page](https://kdp.amazon.com/en_US/help/topic/G8BKPU9AGVZSF9QF)
- [Paperback Printing Cost](https://kdp.amazon.com/en_US/help/topic/G201834340)

For Amazon.com paperbacks, the current official maximum list price is 250 USD.
The minimum varies with current printing cost and the applicable 50% or 60%
royalty rate. The package therefore binds an exact intended price but does not
guess a minimum, royalty, printing cost, tax, foreign exchange, margin, revenue,
or platform acceptance. Etsy remained excluded. The failed production-database
administration route was not retried because no credible access-path change was
observed.

### Content Control implementation and hosted verification

- PR #406 exact tested head:
  `9a8bb56cd9be270946242df4aab9906a13130e53`.
- Schema v13 requires exact
  `list_price: { "marketplace": "amazon.com", "currency": "USD",
  "amount_minor": <integer 1-25000> }`.
- Independent QA copies the validated price into its signed receipt. Immediately
  before any KDP adapter call, Content Control requires exact equality with the
  current verified Money Factory grant price; the existing package-scoped
  economics gate then revalidates the same price, receipts, costs, minima, and
  evidence lifetime.
- Missing, malformed, extra-key, non-USD, non-Amazon.com, zero, negative,
  over-maximum and QA-to-grant price mismatch forms fail closed.
- Focused regressions:
  `PODTests.test_kdp_book_details_bind_primary_list_price` and
  `KDP list price must match the signed Money Factory price before any adapter
  call`.
- POD integration gates run `39612589204`, job `119265065136`: success.
- POD container runtime gates run `39612589135`, job `119265067072`:
  success, including in-image Python/Node/PostgreSQL tests, real print/review
  workflow, and startup with publication disabled.
- Guarded Content Control merge:
  `b274b6a094b07756cb47a857c32e57d055105d80`.

### Money Factory dependent pin and hosted verification

- PR #111 exact tested head:
  `aef6716916f97d61658e4356031740f4da68a3d6`.
- The cross-repository workflow pins Content Control merge
  `b274b6a094b07756cb47a857c32e57d055105d80` and explicitly runs the new
  list-price regression plus the publication-path economics tests.
- POD cross-repository review verification run `39613666139`, job
  `119268855923`: success.
- Guarded Money Factory merge:
  `49f1634eedf8e2cc90cf2a2ed39a9ff6f3b6eba8`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, and one instance.
- Render detected Content Control merge `b274b6a...` and created deployment
  `dep-dbcccsgu01pc73d5l0t0`.
- Event `evt-dbcccspocimc73b39sn0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T14:04:35.140944Z`.
- Event `evt-dbcccsuk7voc73a2ct7g` recorded the deployment ended failed at
  `2026-10-21T14:04:35.613147Z`.
- No build or hosted rollout of this revision was verified. No manual retry,
  paid capacity, plan/cache change, replacement service, secret access, or
  network widening was attempted.

### Acceptance truth

This closes a package-to-release price-integrity gap only. It does not establish
a real KDP price, current live printing-cost or royalty readback, regional-rights
evidence, actual preview/proof acceptance, production database/recovery, live
adapter acceptance, financial reconciliation, end-to-end publication, or
controlled launch readiness. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.

## Run receipt r159 — scoped KDP regional-rights enforcement (2026-10-21 UTC)

### Scope and official basis

Fresh official KDP guidance was rechecked on 2026-10-21:

- [Paperback and Hardcover Distribution Rights](https://kdp.amazon.com/en_US/help/topic/G201834280)
- [Intellectual Property Rights Frequently Asked Questions](https://kdp.amazon.com/en_US/help/topic/G200672400)
- [Content Guidelines](https://kdp.amazon.com/en_US/help/topic/G200672390)
- [Categories](https://kdp.amazon.com/en_US/help/topic/G200652170)

KDP requires accurate territory and rights declarations and may request
documentation. The supported lane remains deliberately bounded to a United
States paperback. This run added a fail-closed signed-evidence contract; it did
not create legal rights, validate a real source document, or prove that KDP
would accept one. Etsy remained excluded. The failed production-database
administration route was not retried because no credible access-path change was
observed.

### Content Control implementation and hosted verification

- Superseded PR #408 exposed two defects before merge: a stale PostgreSQL QA
  fixture and a missing Python pattern-matcher import. Its runs
  `39623242388` and `39623242870` failed and were not treated as evidence.
- PR #409 exact tested head:
  `c5dbc5a5e0853032baadc59458e19cb3eefa108f`.
- Current signed `pod:package-rights` evidence now requires an exact
  `regional_rights` record for country/territory `US`, paperback format,
  the selected publishing basis and categories, commercial POD authority,
  original-work and verified-rights-holder assertions, non-revocation, retained
  authority/source identities, and a lowercase SHA-256 evidence digest.
- Independent QA copies the validated event identity, source identities,
  territory, categories, and evidence digest into its signed receipt. The
  publication policy rejects legacy KDP QA without the dedicated
  `regional_rights` check before any adapter call.
- Missing, expired, revoked, differently scoped, malformed, duplicate-source,
  extra-key, and legacy records fail closed.
- Focused regression:
  `PODTests.test_kdp_requires_current_scoped_regional_rights_evidence`.
- POD integration gates run `39624458233`, job `119306094234`: success.
- POD container runtime gates run `39624458198`, job `119306091935`:
  success, including production-image Python/Node/PostgreSQL tests, real
  print/review workflow, and startup with publication disabled.
- Guarded Content Control merge:
  `56e5ca3d7acb4a4b8d3267e0b8038ddeded6a17b`.

### Money Factory dependent pin and hosted verification

- PR #112 exact tested head:
  `20238b830296cb3a58c35920093761f05f3e662d`.
- The cross-repository workflow pins Content Control merge
  `56e5ca3d7acb4a4b8d3267e0b8038ddeded6a17b` and explicitly runs the
  regional-rights regression plus the publisher QA-binding tests.
- POD cross-repository review verification run `39625543458`, job
  `119309670618`: success.
- Guarded Money Factory merge:
  `0f562c050eed9317347e417de6a7d63a7fb95640`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, and one instance.
- Render later exposed deployment `dep-dbcdt715efls73bnk70g` for Content
  Control merge `56e5ca3d7acb4a4b8d3267e0b8038ddeded6a17b`. It was created at
  `2026-10-21T15:47:40.197748Z` and ended `build_failed` at
  `2026-10-21T15:47:42.906375Z`.
- Event `evt-dbcdt7i0cl3c739nvqc0` at
  `2026-10-21T15:47:42.334516Z` records the exact reason:
  `pipeline_minutes_exhausted`. Deploy-ended event
  `evt-dbcdt7l5rp0s73en60h0` followed at `2026-10-21T15:47:42.923372Z`.
- Receipt-only merge `e894285faa1dcb48332344fc3f194e3004b74a1c` was correctly ignored
  by Render in event `evt-dbcdq5dg1s2s738oqpqg` at
  `2026-10-21T15:41:09.207938Z`.
- No build or hosted rollout of r159 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access, or network
  widening was attempted.

### Acceptance truth

This closes a code-level regional-rights enforcement gap only. Synthetic signed
fixtures are not legal clearance or live acceptance. Genuine owner-authorized
regional-rights evidence, any documentation KDP requests, live KDP readback,
preview/proof acceptance, production database/recovery, live adapter acceptance,
financial reconciliation, end-to-end publication, and controlled launch
readiness remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.



## Run receipt r160 — retained regional-rights evidence bytes (2026-10-21 UTC)

### Scope

This run closed the next code-level integrity gap in the bounded United States
paperback lane. The signed regional-rights record can no longer pass by naming a
well-formed digest alone: the hash-addressed production task must carry the
retained evidence file and independent QA must read its bytes from a regular
non-symlink file, enforce the 16 MiB ceiling, and recompute the exact SHA-256.
This proves byte-to-receipt binding only; it does not authenticate a real legal
document or establish that KDP will accept it. Etsy remained excluded. The
failed production-database administration route was not retried because no
credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #411 exact tested head:
  `d08a243554b2a292dc05a4146fed08a6e6a90adf`.
- KDP stored tasks now require exactly eight interior roles, including
  `regionalRightsEvidence`; the resolver restores it only from a declared
  hash-addressed input into the isolated workspace.
- The production worker passes that resolved file to QA. QA rejects missing,
  tampered, empty, oversized, non-regular, and symlinked evidence and accepts
  only bytes whose recomputed SHA-256 matches the exact signed
  `regional_rights.evidence_sha256`.
- Regression coverage extends
  `PODTests.test_kdp_requires_current_scoped_regional_rights_evidence` and the
  stored-task resolver tests. Synthetic fixture bytes are explicitly not legal
  approval.
- POD integration gates run `39634351805`, job `119340712364`: success.
- POD container runtime gates run `39634351774`, job `119340711726`: success,
  including production-image Python/Node/PostgreSQL tests, real print/review
  workflow, and startup with publication disabled.
- Guarded Content Control merge:
  `312a2014ffac0bd33e0dddf44fec7bdd91ad5e14`.

### Money Factory dependent pin and hosted verification

- PR #113 exact tested head:
  `9037ca5ae16a987da99c21b61a2f93c6753cc94f`.
- The cross-repository workflow pins Content Control merge
  `312a2014ffac0bd33e0dddf44fec7bdd91ad5e14` and exercises the focused
  regional-rights regression plus the publisher QA-binding tests.
- POD cross-repository review verification run `39635531418`, job
  `119344826099`: success.
- Guarded Money Factory merge:
  `3e5f9e1935c69d1d49bb2644de7ab9228a42f257`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, and one instance.
- Render detected Content Control merge
  `312a2014ffac0bd33e0dddf44fec7bdd91ad5e14` and created deployment
  `dep-dbceldm1egvs739s64b0` at `2026-10-21T16:39:18.125917Z`.
- Event `evt-dbceldp5gs1s73bi93u0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T16:39:19.151517Z`;
  deploy-ended event `evt-dbceldtgtokc73c3mcr0` followed at
  `2026-10-21T16:39:19.995268Z`. The deployment finished
  `build_failed` at `2026-10-21T16:39:19.963983Z`.
- Receipt-only merge `eedf18b0e6cbc636dc986f7c9a286a22a7867bc8` was
  correctly ignored in event `evt-dbceno8u01pc73bm8veg` at
  `2026-10-21T16:44:17.066526Z`.
- No hosted rollout of r160 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access, or network widening
  was attempted.

### Acceptance truth

This closes a code-level byte-binding gap only. Synthetic signed fixtures are
not regional-rights clearance or live acceptance. Genuine owner-authorized
rights evidence, document authenticity/legal sufficiency, any documentation KDP
requests, live KDP readback, preview/proof acceptance, production
database/recovery, live adapter acceptance, financial reconciliation,
end-to-end publication, and controlled launch readiness remain unverified. All
24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted.

## Run receipt r161 — authenticated regional-rights evidence upload (2026-10-21 UTC)

### Scope

This run repaired the clean upload-to-task path for retained regional-rights
evidence. The production task introduced in r160 requires a hash-addressed
evidence artifact, but the authenticated artifact route and immutable store did
not accept the fixture's `text/plain` media type. The route now accepts bounded
plain-text evidence, preserves the exact bytes and media type, and returns the
SHA-256 identity consumed by the stored task. This is transport and integrity
support only; it does not validate the truth, provenance, legal sufficiency, or
KDP acceptability of any uploaded document. Etsy remained excluded. The failed
production-database administration route was not retried because no credible
access-path change was observed.

### Content Control implementation and hosted verification

- PR #413 exact tested head:
  `7f976baa7ac57df2ec1c5db4731b1b95d18da9ad`.
- `ArtifactStore` and the authenticated `POST /artifacts` route accept
  `text/plain` in addition to the existing bounded media allowlist; the
  existing 16 MiB object ceiling, immutable SHA-256 identity, deployment storage
  budget, authentication, and fail-closed rejection remain in force.
- Unit coverage verifies exact byte/media preservation and rejects unapproved
  `text/html` before any database access. The real HTTP regression sends
  `text/plain; charset=utf-8`, verifies status 201 and the exact SHA-256, and
  confirms stored bytes and normalized media type.
- POD integration gates run `39638398984`, job `119355174228`: success.
- POD container runtime gates run `39638398930`, job `119355174151`:
  success, including production-image tests and startup with publication
  disabled.
- Guarded Content Control merge:
  `3398af1414eeed7873992393ae2b43d6e7c7875d`.

### Money Factory dependent pin and hosted verification

- PR #114 exact tested head:
  `60c822163fa38d5b63b0ef3da5f5d4d8bfbef6b0`.
- The cross-repository workflow pins Content Control merge
  `3398af1414eeed7873992393ae2b43d6e7c7875d` and exercises the regional-rights
  regression, publisher QA binding, and complete Node/Python integration suites.
- POD cross-repository review verification run `39639473547`, job
  `119358912225`: success.
- Guarded Money Factory merge:
  `d7cd558e29fe67a85d1d019f757e7d2a07059f1e`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, and one instance.
- Render detected Content Control merge
  `3398af1414eeed7873992393ae2b43d6e7c7875d` and created deployment
  `dep-dbcetsvlk1mc73fuu750` at `2026-10-21T16:57:23.786570Z`.
- Event `evt-dbcett5e754c73bfqoug` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T16:57:24.670231Z`;
  deploy-ended event `evt-dbcettbhk1ds739sh65g` followed at
  `2026-10-21T16:57:25.245463Z`. The deployment finished
  `build_failed` at `2026-10-21T16:57:25.193192Z`.
- No hosted rollout of r161 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access, or network widening
  was attempted.

### Acceptance truth

This closes an upload-media compatibility gap only. Synthetic fixtures are not
regional-rights clearance or live acceptance. Genuine owner-authorized rights
evidence, document authenticity/legal sufficiency, any documentation KDP
requests, live KDP readback, preview/proof acceptance, production
database/recovery, live adapter acceptance, financial reconciliation,
end-to-end publication, and controlled launch readiness remain unverified. All
24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted.


## Run receipt r162 — authenticated KDP template archive upload (2026-10-21 UTC)

### Scope

This run repaired the clean upload-to-task path for both retained official KDP
template archives. Stored KDP tasks require separate hash-addressed
`templateSource` and `interior.source` ZIP inputs, but the authenticated
artifact route and immutable store did not accept `application/zip`. The route
now accepts bounded ZIP uploads and preserves their exact bytes, media type and
SHA-256 identity. The downstream bounded KDP import stages still independently
rehash and inspect each retained archive before rendering; accepting the media
type does not trust a filename, claimed profile, template provenance, or KDP
acceptance. Etsy remained excluded. The failed production-database
administration route was not retried because no credible access-path change was
observed.

### Content Control implementation and hosted verification

- PR #415 exact tested head:
  `3e21e04c2d589766827bd5fb34509e2adb86497c`.
- `ArtifactStore` and authenticated `POST /artifacts` accept
  `application/zip` under the existing 16 MiB object ceiling, immutable
  SHA-256 identity, deployment storage budget, authentication and fail-closed
  rejection policy.
- Store and real-HTTP regressions use exact ZIP signature bytes, verify the
  returned digest, and confirm exact byte/media preservation.
- Task-input documentation requires both retained archives to be uploaded as
  `application/zip` and notes the independent importer validation.
- POD integration gates run `39649405510`, job `119393909237`: success.
- POD container runtime gates run `39649405581`, job `119393917680`:
  success, including production Docker image, Python QA/rendering,
  Node/PostgreSQL tests, real print/review workflow, and startup with
  publication disabled.
- Guarded Content Control merge:
  `2ca1b87202625d58e1d05c89209187c345b36255`.

### Money Factory dependent pin and hosted verification

- PR #115 exact tested head:
  `dd26fb358d0fd7389aae766b9f24aa144e0d1092`.
- The cross-repository workflow pins Content Control merge
  `2ca1b87202625d58e1d05c89209187c345b36255` and exercises the KDP metadata,
  manuscript/font-rights, retained-template, CMYK cover, editorial, Node and
  Python verification suites.
- POD cross-repository review verification run `39650616263`, job
  `119397654088`: success.
- Guarded Money Factory merge:
  `a620fd38cfb84dff24bd3be3c3aded2fbbbeca50`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `2ca1b87202625d58e1d05c89209187c345b36255` and created deployment
  `dep-dbcg0ug473hc73c7gr3g` at `2026-10-21T18:12:10.179835Z`.
- Event `evt-dbcg0uibeu7c73fdlic0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T18:12:10.586162Z`;
  deploy-ended event `evt-dbcg0uvmfmcs739ojmv0` followed at
  `2026-10-21T18:12:11.071327Z`. The deployment finished
  `build_failed` at `2026-10-21T18:12:11.026056Z`.
- No build or hosted rollout of r162 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access, or network
  widening was attempted.

### Acceptance truth

This closes an upload-media compatibility gap only. Synthetic archives and
passing code tests are not official-template provenance, a real KDP preview or
proof, live platform readback, or launch acceptance. Genuine owner-authorized
rights evidence, live preview/proof acceptance, production database/recovery,
live adapter acceptance, financial reconciliation, end-to-end publication and
controlled launch readiness remain unverified. All 24 acceptance areas remain
OPEN. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted.
## Run receipt r163 — bind stored task artifacts to consuming media contracts (2026-10-21 UTC)

### Scope

This run closed a stored-task input-integrity gap. Authenticated artifact upload
already preserved a caller-supplied media type, but the task resolver did not
require that stored metadata to match the role consuming the bytes. A mislabeled
image, JSON evidence, font, rights record, or retained KDP template archive could
therefore be restored under an incompatible task role. The resolver now binds
each supported role to an exact media contract before any bytes are written to
its disposable workspace, rejects incompatible descriptor aliases, and removes
partial workspace state on mismatch. This is a trust-boundary repair across
stored task intake, KDP inputs and security; it does not establish provenance,
rights, editorial acceptance, or a live platform result. Etsy remained
excluded. The failed production-database administration route was not retried
because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #417 initial head `daa6d338adaf56e4365ef433940e1546873fb360`
  exposed two stale test assertions in run `39655832830`, job
  `119415701299`: duplicate-key fixtures still searched for the previous JSON
  source filename after the fixture became media-correct. That failed head is
  not acceptance evidence and was not merged.
- PR #417 corrected exact tested head:
  `80f8996ed08ad15c2a54e81920aa8f44ba4de0d5`.
- Stored task roles now require their exact declared media type: PNG sources and
  references, JSON templates/text layers/rights and KDP metadata, TTF fonts,
  plain-text font licences/regional-rights evidence, and ZIP retained KDP
  template sources. Incompatible aliases or restored metadata fail with the
  sanitized fixed reason `TASK_MEDIA_TYPE_INVALID`.
- Regression coverage verifies media-correct fixtures, JSON/PNG/ZIP mismatches,
  incompatible aliases and cleanup after rejection.
- Corrected POD integration gates run `39656093426`, job
  `119416628412`: success.
- Corrected POD container runtime gates run `39656093532`, job
  `119417177976`: success, including the production Docker image, Python
  QA/rendering, Node/PostgreSQL tests, real print/review workflow and startup
  with publication disabled.
- Guarded Content Control merge:
  `13ad85b1cd104ef57eba2492f5f8a0e2a756f415`.

### Money Factory dependent pin and hosted verification

- PR #116 exact tested head:
  `10db3f5718099be46360cc011016fb3ba7ab40ea`.
- The cross-repository workflow pins Content Control merge
  `13ad85b1cd104ef57eba2492f5f8a0e2a756f415` and exercises KDP metadata,
  original manuscript/font rights, retained official-template sources, CMYK
  cover, editorial-bound QA, complete Node tests and complete Python tests.
- POD cross-repository review verification run `39657183090`, job
  `119420444747`: success.
- Guarded Money Factory merge:
  `6b2a36f7e88c3547ab8a4e2fd57073b91e9122ef`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `13ad85b1cd104ef57eba2492f5f8a0e2a756f415` and created deployment
  `dep-dbcgmbavcj2c738ni9ug` at `2026-10-21T18:57:49.928371Z`.
- Event `evt-dbcgmbv2jbls73fvoq0g` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T18:57:51.228868Z`;
  deploy-ended event `evt-dbcgmc6a6ers73a9tolg` followed at
  `2026-10-21T18:57:52.306686Z`. The deployment finished
  `build_failed` at `2026-10-21T18:57:52.263293Z`.
- No hosted rollout of r163 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access, or network widening
  was attempted.

### Acceptance truth

This closes a stored-input media-confusion gap only. Passing synthetic and
container tests are not live acceptance. Restricted production database/schema
verification, durable retention/recovery drills, deployed hybrid dependencies,
mounted current Money Factory authority and real grants/revocation, authorized
accounts and market sources, current regional-rights and official-template
evidence, substantive KDP editorial/preview acceptance, independent QA and
remediation outcomes, permitted live adapters for KDP, Redbubble, TeePublic,
Zazzle and Spreadshirt, actual economics and financial reconciliation,
owner-phone operations, monitoring/recovery drills, measured capacity, real
end-to-end acceptance and controlled launch readiness remain unverified. All 24
acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was
attempted. This run did not claim a continuously running self-hosted worker.

## Run receipt r176 — harden Money Factory bridge file loading (2026-10-22 UTC)

### Scope and repaired boundary

This run closed the remaining ordinary-file boundary around the native Money
Factory bridge contract. Service startup, deployment preflight, the publisher
CLI and both restore CLIs previously used symlink-following, unbounded
`fs.readFile` with ordinary `JSON.parse`. They now share one 64-KiB reader
that opens nonblocking without following a final symlink, requires a nonempty
regular file, captures its exact size, decodes strict UTF-8, rejects recursively
duplicated decoded keys and validates every required fail-closed bridge rule.
The exact regressions cover a valid regular file, a final symlink, an escaped
duplicate authority key and the 64-KiB/+1 boundary. Etsy remained excluded. The
unchanged failed database-administration path was not retried.

### Verification and guarded merges

- The focused local suite passed 114/114 preflight, policy, state-archive and
  artifact-archive tests, with syntax and whitespace checks passing. A wider
  local glob executed 644 passing tests but could not load six PostgreSQL test
  files because this worktree did not have the optional `pg` dependency; two
  unrelated tests skipped. Hosted locked gates supplied that missing coverage.
- Content Control PR #444 exact head
  `50a95a9a9349dc4b9a02fa26438fec2ec8ad67e9` passed integration run
  `39742111187`, job `119701599074`, and container run `39742111185`,
  job `119701598993`.
- Guarded Content Control squash merge:
  `bb6815f5445606d43fcba337f8abd703704cb17e`.
- Money Factory PR #130 exact head
  `21146e7d0566498448ec4d7995ab73784bef33f5` pinned that merge, added the
  bridge preflight regression to the selected dependent suite, preserved the
  20-minute timeout and both publication flags false, and passed
  cross-repository run `39742936854`, job `119704364744`.
- Guarded Money Factory squash merge:
  `56a26249e0fc7e606eae8d63979daf7a834754e3`.

### Authorized Render verification

The authorized service remained unsuspended on the existing free plan, main
branch, commit-triggered Docker runtime and one instance. Render detected
`bb6815f5445606d43fcba337f8abd703704cb17e`: deploy
`dep-dbcrukvavr4c73cvd2q0` started in event
`evt-dbcrukv42ijs73bfhilg` at 2026-10-22T07:46:27.789189Z. Event
`evt-dbcrukukvk2s73e65tfg` recorded `pipeline_minutes_exhausted` at
07:46:27.865114Z, and event `evt-dbcrul742ijs73bfhiog` recorded failed
deployment at 07:46:28.204100Z. No hosted rollout, retry, plan/cache change,
replacement service, spending, secret access or network widening occurred.

### Acceptance truth

This repair is code, CI and image evidence only. It does not establish production
database isolation, durable live recovery, a deployed current image, mounted live
Money Factory authority, real accounts/grants/sources/rights/templates, KDP
editorial/preview acceptance, independent QA/remediation outcomes, permitted
live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or
financial reconciliation, owner-phone operations, monitoring drills, measured
capacity, real end-to-end acceptance or controlled launch readiness. All 24
acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted
and no continuously running self-hosted worker is claimed.

## Run receipt r175 — bound signed production files (2026-10-22 UTC)

### Scope and repaired boundary

This run closed one parent-worker input boundary before rendering and completion.
Signed cover templates, KDP interior templates and signed QA output were previously
read with unbounded, symlink-following `fs.readFile` plus ordinary `JSON.parse`.
The exact regression showed that escaped duplicate outer keys could reach template
interpretation or QA result handling, and a final template symlink was followed.
The worker now captures one nonempty, at-most-2-MiB regular-file snapshot with
nonblocking/no-follow semantics, strict UTF-8 and the existing recursive
duplicate-key parser. Invalid inputs fail as `ENVELOPE_INVALID`; no later stage
or completion is allowed. Etsy remained excluded. The unchanged failed database
administration path was not retried.

### Verification and guarded merges

- Content Control PR #442 exact head
  `1b62b496da8a2159f04738536f8e722860c7e114` passed 348 selected Node
  contracts locally, including 66 focused production/template/QA tests, with
  zero failures/skips. Syntax and whitespace checks passed.
- Hosted integration run `39740202781`, job `119695307972`, passed the
  locked full POD Node/Python/PostgreSQL E2E and guard suite.
- Hosted container run `39740202779`, job `119695308282`, passed the exact
  production image, real rendering/QA, Node/PostgreSQL tests, durable review and
  disabled-startup checks.
- Guarded Content Control squash merge:
  `e27a9498dc6a243875d4c76142bc1c3fd3aa7565`.
- Money Factory PR #129 exact head
  `c784e205c6f4ca72e0195b84a6780423127fd3dd` pinned that merge while
  preserving the 20-minute timeout and both publication flags false.
  Cross-repository run `39740777060`, job `119697198223`, passed.
- Guarded Money Factory squash merge:
  `ec1298e03c143f3503a98d35306bcae99594cc4a`.

### Authorized Render verification

The authorized service remained unsuspended on the existing free plan, main
branch, commit-triggered Docker runtime and one instance. Render detected
`e27a9498dc6a243875d4c76142bc1c3fd3aa7565`: deploy
`dep-dbcrm9bm8hqs73akvbu0` started in event
`evt-dbcrm9ktuius73cbd8d0` at 2026-10-22T07:28:38.273097Z. Event
`evt-dbcrm9j657ic73am3gu0` recorded `pipeline_minutes_exhausted` at
07:28:38.448026Z, and event `evt-dbcrm9n42ijs73bfba30` recorded failed
deployment at 07:28:38.818345Z. No hosted rollout, retry, plan/cache change,
replacement service, spending, secret access or network widening occurred.

### Acceptance truth

This repair is code, CI and image evidence only. It does not establish production
database isolation, durable live recovery, a deployed current image, mounted live
Money Factory authority, real accounts/grants/sources/rights/templates, KDP
editorial/preview acceptance, independent QA/remediation outcomes, permitted
live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or
financial reconciliation, owner-phone operations, monitoring drills, measured
capacity, real end-to-end acceptance or controlled launch readiness. All 24
acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted
and no continuously running self-hosted worker is claimed.

## Run receipt r174 — reject ambiguous package manifests (2026-10-22 UTC)

### Scope and reproduced gap

This run closed one package-admission ambiguity before durable artifact storage
and review hold. The parent manifest reader rejected repeated top-level keys but
used ordinary `JSON.parse` for nested objects, so a package could repeat a nested
template/member key and rely on decoder last-value behavior. The exact pre-fix
regression reproduced this as
`PRE_FIX_ACCEPTED_NESTED_DUPLICATE_MANIFEST`. The parent now applies the existing
strict recursive JSON parser before interpreting any package, template, file or
text identity; duplicate decoded keys at every depth fail as
`MANIFEST_INVALID`. Exact producer-byte hashing remains intact, including
Python JSON's integer/float distinction. Etsy remained excluded. The failed
production-database administration path was not retried because no credible
access-path change was observed.

### Failure learning and corrected verification

- The first candidate exact head `3679bdbee49632630028376219b33be651752fa4`
  also required JavaScript reserialization equality. Hosted integration run
  `39729467945` and container run `39729468112` correctly exposed that this
  rejected legitimate Python-produced floating-point spelling such as `450.0`
  in the real stored-task E2E. That candidate was not merged.
- Corrected PR #440 exact head:
  `3bf99a0b7c127f37246421d09089463d86824fcb`.
- Focused package/worker/source/QA tests passed 96/96 locally; syntax and
  whitespace checks passed. The corrected hosted integration gate run
  `39730371519`, job `119663784013`, passed, including the locked dependencies,
  full POD Node suite, Python suites, PostgreSQL E2E and control checks.
- Corrected container gate run `39730371543`, job `119663783961`, passed,
  including the exact production image, Python QA/rendering, Node/PostgreSQL
  tests, real print/review workflow and startup with publication and production
  disabled.
- Guarded Content Control merge:
  `da68eb139715ef3241566676c156ced860f289f6`.

### Money Factory dependent pin and verification

- Money Factory main advanced concurrently with unrelated monitor state at
  `14b042da841bbec4e45352c0a2d29b91d90ac778`. The existing PR #128 branch was
  updated with an exact force-with-lease onto that head, then only the one-line
  POD pin was reapplied; no duplicate PR was created.
- PR #128 exact tested head:
  `3f727ccfab75d0429e096809c3115d762fe6bf67`.
- The authoritative cross-repository workflow pins Content Control merge
  `da68eb139715ef3241566676c156ced860f289f6`; its 20-minute timeout and
  `PUBLICATION_ENABLED=false` / `POD_PUBLICATION_ENABLED=false` remained
  unchanged.
- Cross-repository run `39731163570`, job `119666290647`, passed.
- Guarded Money Factory merge:
  `4f461877e26b186579783b1c03a9910f26b28177`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `da68eb139715ef3241566676c156ced860f289f6` and started deployment
  `dep-dbcqbrbncjis73b52dmg`; event `evt-dbcqbrf40dgc7394sdfg` recorded the
  start at `2026-10-22T05:58:05.821754Z`.
- Event `evt-dbcqbrdk3hvs739qfa20` recorded
  `pipeline_minutes_exhausted` at `2026-10-22T05:58:05.921187Z`;
  deploy-ended event `evt-dbcqbrkdthfc73dj59c0` recorded failed status at
  `2026-10-22T05:58:06.231437Z`.
- No hosted rollout of r174 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access or network widening was
  attempted.

### Acceptance truth

This closes one parent package-parsing ambiguity only. Passing code, CI and
production-image tests are not official-template provenance, a real KDP
preview/proof, live platform readback or launch acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed hybrid
dependencies, mounted current Money Factory authority and real grants/revocation,
authorized accounts and market sources, current regional rights and
official-template evidence, substantive KDP editorial/preview acceptance,
independent QA/remediation outcomes, permitted live adapters for KDP, Redbubble,
TeePublic, Zazzle and Spreadshirt, actual economics and financial reconciliation,
owner-phone operations, monitoring/recovery drills, measured capacity, real
end-to-end acceptance and controlled launch readiness remain unverified. All 24
acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; no publication was attempted.
This run used only its actually available bounded tools and did not claim a
continuously running self-hosted worker.

## Run receipt r173 — bind package text to signed production layers (2026-10-22 UTC)

### Scope and reproduced gap

This run closed a generated-package text-identity gap before durable artifact
storage, independent review and completion. The parent worker authenticated the
source artwork and rights envelope, while the Python child authenticated the
text-layer file, but the parent did not snapshot that file or bind the returned
manifest to its signed identity. A changed text-layer file or substituted
manifest text identity could therefore cross the parent/child trust boundary.
The pre-fix regression reproduced that acceptance as
`PRE_FIX_ACCEPTED_TEXT_LAYER_SUBSTITUTION`. The parent now snapshots bounded
regular text-layer bytes, rejects ambiguous JSON, verifies their canonical
digest against the signed rights envelope, and requires the package manifest
to carry the same digest plus exact rendered text/font identities before any
artifact storage or review hold. Etsy remained excluded. The failed
production-database administration path was not retried because no credible
access-path change was observed.

### Content Control implementation and verification

- PR #438 exact tested head:
  `ca32901322b60fc3399b89ca71c65ca1ab71a982`.
- The remote changed tree `3e840f7835ad3a78b83c412fe5653a1eafc8e346`
  exactly matched the locally tested ten-file tree.
- Focused source/package/worker/QA coverage passed 95/95 Node tests; the actual
  Node/Python KDP inspector bridge passed 93/93 Python tests. The broad
  dependency-free POD Node suite passed 637 tests with two expected skips.
  Broader local Python discovery passed 230 tests and had only two unrelated
  import errors because local OpenCV was unavailable; the hosted gates installed
  the locked OpenCV dependency and passed their declared Python coverage.
  Syntax checks and `git diff --check` passed.
- POD integration gates run `39723927267`, job `119643427315`: success.
- POD container runtime gates run `39723927376`, job `119643428078`:
  success, including the production Docker image, Python QA/rendering,
  Node/PostgreSQL tests, real print/review workflow and startup with publication
  and production disabled.
- Guarded Content Control merge:
  `9456f8fa2add878139d5e3aa558ac5f135034d24`.

### Money Factory dependent pin and verification

- PR #127 exact tested head:
  `036bcbbbaa12279b4e9607ed261aa34b3e844007`.
- The authoritative cross-repository workflow pins Content Control merge
  `9456f8fa2add878139d5e3aa558ac5f135034d24`; its 20-minute timeout and
  `PUBLICATION_ENABLED=false` / `POD_PUBLICATION_ENABLED=false` remained
  unchanged.
- POD cross-repository review verification run `39724653197`, job
  `119645692864`: success.
- Guarded Money Factory merge:
  `b910c8d09dd66f45e08e0d6d14e8c63e93a010ae`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `9456f8fa2add878139d5e3aa558ac5f135034d24` and started deployment
  `dep-dbcpbutg1s2s738aa5tg`; event `evt-dbcpbuv40dgc73947uqg` recorded
  the start at `2026-10-22T04:50:03.381135Z`.
- Event `evt-dbcpbutk3hvs739prkp0` recorded
  `pipeline_minutes_exhausted` at `2026-10-22T04:50:03.416108Z`;
  deploy-ended event `evt-dbcpbup12hec73atvvig` recorded failed status at
  `2026-10-22T04:50:03.711089Z`.
- No hosted rollout of r173 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access or network widening was
  attempted.

### Acceptance truth

This closes one parent/child package-integrity gap only. Passing code, CI and
production-image tests are not official-template provenance, a real KDP
preview/proof, live platform readback or launch acceptance. Restricted
production database/schema verification, durable retention/recovery drills,
deployed hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, independent QA/remediation outcomes, permitted live adapters for
KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics and
financial reconciliation, owner-phone operations, monitoring/recovery drills,
measured capacity, real end-to-end acceptance and controlled launch readiness
remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r290 — keep POD transactions under helper control (2026-10-26 UTC)

### Scope and implementation

Fresh reconstruction began from Content Control
`3e4770f0ec77a65bd3fcfb5ed89664aa5ce3137d` and Money Factory
`9d57e2a1079f213dff629a48315990c1150dbd9d`, after reading the current
completion, implementation and free-deployment records plus open pull requests,
workflow results and the authorized Render service. No open pull request
duplicated this repair.

`PodDB.tx` already forced callback statements through PostgreSQL extended
query protocol, but a callback could issue a standalone `COMMIT`, `ROLLBACK`
or related transaction-control command. That could end or replace the
helper-owned transaction and make a later rollback unable to undo prior writes.
The guarded transaction query now rejects `ABORT`, `BEGIN`, `COMMIT`,
`END`, `PREPARE`, `RELEASE`, `ROLLBACK`, `SAVEPOINT` and `START`
before PostgreSQL executes them, including leading-semicolon, line-comment and
nested-block-comment forms. Normal business SQL remains on extended protocol.

### Content Control verification and merge

- The regression-first focused suite failed against the prior helper with the
  expected missing rejection, then passed 9/9 after the repair.
- The complete local serial POD Node suite passed 876 tests, skipped eight
  environment-dependent PostgreSQL cases and failed zero. `node --check` and
  `git diff --check` passed.
- The first hosted integration run `40418384737` exposed overlapping test
  intent: the existing extended-protocol test began with `COMMIT` and
  correctly reached the new guard before PostgreSQL SQLSTATE `42601`. The test
  was corrected to begin with ordinary `SELECT` while retaining the separate
  real PostgreSQL callback-escape regression; the failed run was not blindly
  retried.
- Corrected exact head
  `857f7b6e19ffd457d3867b3d827998e65433b1be` passed POD integration run
  `40418592742` and production-container run `40418592750`. The hosted
  PostgreSQL 18 gate passed all 884 Node tests, including the real write,
  comment-obscured `COMMIT`, rejection and rollback-preservation proof.
- Guarded PR #713 merged as
  `bde3f2c54ce9aa5bc10ab3080fd5ad42ed76a500`.

### Money Factory dependent pin

- The workflow now pins immutable Content Control merge
  `bde3f2c54ce9aa5bc10ab3080fd5ad42ed76a500`.
- Local Money Factory integration tests passed 116 tests, skipped one
  environment-dependent PostgreSQL case and failed zero. The Python
  production/review suite passed 81 tests with zero failures. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`.
- Money Factory main advanced concurrently to
  `15f79e3bb48bf1ea44db5955a786bbc565b5432c`; its unrelated free-monitor
  evidence was preserved and PR mergeability was re-read before merge.
- Exact PR #245 head
  `6a19269044d6d6e92fd393921ea3930b7c8a2e1e` passed cross-repository run
  `40419665575`, then merged as
  `b9bb64ca9294dc69058eb9989472d640aa68acb6`.

### Authorized Render verification

- The authorized service remained on its existing free plan, `main` branch
  and commit-triggered deployment path. No manual deploy was requested.
- Render detected exact Content Control merge
  `bde3f2c54ce9aa5bc10ab3080fd5ad42ed76a500` and created deployment
  `dep-dbfu2bbbc2fs739krcm0`.
- Deploy-started event `evt-dbfu2bdgtmfc73b732r0` recorded the merge at
  `2026-10-26T23:24:29.894680Z`; event
  `evt-dbfu2bdgtmfc73b732s0` recorded
  `pipeline_minutes_exhausted` at `2026-10-26T23:24:29.898762Z`; and
  deploy-ended event `evt-dbfu2bhlfrss73efl5ig` recorded failed status at
  `2026-10-26T23:24:30.348787Z`.
- No build or hosted rollout of r290 was verified. No paid capacity, cache/plan
  change, replacement service, secret access or network widening was attempted.

### Acceptance truth

This closes one managed-transaction integrity gap only. Existing code, passing
synthetic/PostgreSQL/container tests and an attempted deployment are not live
acceptance. The prior database-administration route was not retried; the
documented free Neon replacement and recovery evidence do not remove the
remaining live preflight, independent backup and authority/deployment
requirements. Dedicated database, durable storage/recovery, hybrid hosting,
Money Factory authority, current grants/revocation, account records, authorized
market intelligence, concept selection, regional-rights evidence, original
generation, official templates, KDP interiors/editorial, independent QA,
remediation, authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters,
publishing safeguards, economics, financial reconciliation, mobile operations,
monitoring, security, measured capacity, end-to-end acceptance and controlled
launch readiness all remain OPEN. Etsy remained excluded.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r289 — single-statement guarded transactions (2026-10-26 UTC)

### Scope and repair

- Work began from Content Control `3abff4dcb5db895cca4709481a0a4ea5453d2737`
  and Money Factory `10ea78b27dc01423b5b05fff928dc1b63bfff801`.
- Fresh remote-head and open-PR checks found no overlapping POD repair. Existing
  unrelated drafts were preserved.
- [Content Control PR 711](https://github.com/wecreates/content-control/pull/711)
  merged as `fbe6e11aed6cf7e894ec12f9acf5bf111455c553`. Every business
  statement issued through a shared `PodDB.tx` callback now uses node-postgres
  extended-query protocol, including parameterless statements. PostgreSQL
  therefore rejects multiple commands in one callback call instead of allowing
  a simple-query `COMMIT` followed by a second statement outside the managed
  transaction and storage-lifetime checks. A transaction is recorded as open
  only after `BEGIN` succeeds.

### Verification and failure learning

- Regression-first unit tests failed against the prior helper because callback
  SQL was a plain string and a failed `BEGIN` was followed by `ROLLBACK`.
- The repaired local serial POD suite passed 875 tests, skipped eight
  environment-dependent PostgreSQL cases and failed none.
- Hosted attempts exposed PostgreSQL-only wrappers that inspected only
  string-form queries. Those test harnesses were normalized to inspect query-
  config text while passing the exact config through to PostgreSQL.
- Final integration run `40407467718` passed all 883 Node tests and the
  Python/review checks on exact head `ae0fcac1`. Its real PostgreSQL regression
  submits `COMMIT; UPDATE cyzor_social_vault ...`, requires SQLSTATE `42601`,
  and confirms the protected row remains unchanged.
- Production-container run `40407467638` passed the exact Dockerfile, real
  PostgreSQL, print/review and startup-disabled gates before the exact-head
  squash merge.
- [Money Factory PR 244](https://github.com/wecreates/Money-factory/pull/244)
  merged as `9d57e2a1079f213dff629a48315990c1150dbd9d`, pinning Content
  Control `fbe6e11a`. Local verification passed 116/117 Node integration tests
  with the real-PostgreSQL case skipped and 81/81 Python tests. Generated KDP
  fixtures remained `REVIEW_REQUIRED`, `production_ready=false` and
  `publication_enabled=false`. Hosted cross-repository run `40408758920`
  completed successfully before the exact-head merge.

### Authorized Render verification

- The existing service attempted `fbe6e11a` as deploy
  `dep-dbfsp9ek1f9s73e4es0g`.
- Event `evt-dbfsp9801rvs73fd7ci0` records pipeline-minutes exhaustion before
  build, and `evt-dbfsp9n6a6rc73d72ogg` records the failed deploy end. No
  redundant manual deploy, paid capacity, plan/cache change, replacement
  service, secret access or network widening was attempted.

### Acceptance truth

There was no credible changed database-administration access path, so the
previously failed connector/browser action was not repeated. Live database
migration, durable live recovery, successful Render deployment, external
account/grant/rights evidence, authorized live market observations, platform
previews, independent human review, live remediation, measured live capacity,
financial reconciliation, end-to-end acceptance and controlled launch remain
open. All 24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy was excluded and no
publication was attempted. Existing code and hosted tests are not treated as
live acceptance. No approval, clearance, marketplace result, revenue,
completion or continuously running self-hosted worker is claimed.

## Run receipt r172 — bind KDP interior package admission (2026-10-22 UTC)

### Scope and reproduced gap

This run closed a KDP package-admission integrity gap before durable artifact
storage and review hold. The worker authenticated the parent interior template,
but package admission did not bind `manifest.interior` or the retained
`interior.receipt.json` semantics to it. A package with a valid outer hash could
therefore substitute a different interior template. The pre-fix regression
reproduced that acceptance as `PRE_FIX_ACCEPTED_KDP_INTERIOR_SUBSTITUTION`.
Admission now requires the exact authenticated interior template, exact bounded
canonical receipt bytes and hashes, matching interior PDF/template identities,
and fail-closed receipt semantics: technical checks passed, editorial review
unassessed, production readiness false and publication disabled. Etsy remained
excluded. The failed production-database administration path was not retried
because no credible access-path change was observed.

### Content Control implementation and verification

- PR #436 exact tested head:
  `710a7efe56826a7dded0f20df1c29f7a5c4887c1`.
- Local focused Node package/worker/QA coverage passed 89/89; the actual
  Node/Python KDP inspector bridge passed 93/93. The dependency-free POD Node
  suite passed 634 tests with two expected database-only skips. Six PostgreSQL
  files could not run locally because this checkout lacked the `pg` dependency;
  the hosted integration/container gates supplied their declared dependencies.
- POD integration gates run `39720185646`, job `119631613591`: success.
- POD container runtime gates run `39720185470`, job `119631613177`: success,
  including the production Docker image, Python QA/rendering,
  Node/PostgreSQL tests, real print/review workflow and startup with publication
  disabled.
- Guarded Content Control merge:
  `ac5901211dee3f4df3a47f2d1a4676319a58bb6c`.

### Money Factory dependent pin and verification

- PR #126 exact tested head:
  `add0043ca241f544a73aad7182663aa7ba75463b`.
- The authoritative cross-repository workflow pins Content Control merge
  `ac5901211dee3f4df3a47f2d1a4676319a58bb6c`; its 20-minute timeout and
  `PUBLICATION_ENABLED=false` / `POD_PUBLICATION_ENABLED=false` remained
  unchanged.
- POD cross-repository review verification run `39720951888`, job
  `119633997994`: success.
- Guarded Money Factory merge:
  `ee6de1c67fea996838fe8c0ee74f80b60a00875d`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `ac5901211dee3f4df3a47f2d1a4676319a58bb6c` and started deployment
  `dep-dbcopajbc2fs738mf0q0`; event `evt-dbcopav40dgc7393rt80` recorded the
  start at `2026-10-22T04:10:19.054077Z`.
- Event `evt-dbcopauj5dgc739pfdg0` recorded
  `pipeline_minutes_exhausted` at `2026-10-22T04:10:19.182795Z`; deploy-ended
  event `evt-dbcopap12hec73atkdhg` recorded failed status at
  `2026-10-22T04:10:19.480088Z`.
- No hosted rollout of r172 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access or network widening was
  attempted.

### Acceptance truth

This closes one package-integrity gap only. Passing code, CI and production
image tests are not official-template provenance, a real KDP preview/proof,
live platform readback or launch acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed
hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, independent QA/remediation outcomes, permitted live adapters for
KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics and
financial reconciliation, owner-phone operations, monitoring/recovery drills,
measured capacity, real end-to-end acceptance and controlled launch readiness
remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run did not claim a continuously
running self-hosted worker.

## Run receipt r164 — recover current artifact media contracts (2026-10-21 UTC)

### Scope

This run repaired a durability regression created by the accepted KDP/right-input
media expansion. Authenticated artifact storage accepted `text/plain` for retained
regional-rights and font-license evidence and `application/zip` for retained KDP
template archives, but both encrypted recovery implementations still allowed only
the older PNG/PDF/JSON/TTF set. A legitimate current artifact table containing
either new media type therefore blocked artifact-only export and full ten-table
state export. Both recovery paths now consume the same exact exported media
contract as authenticated storage, preserve those types without relabeling, and
continue to reject unknown legacy/foreign types. This improves acceptance area 2
recovery correctness without claiming a live backup or restoration drill. Etsy
remained excluded. The failed production-database administration route was not
retried because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #419 exact tested head:
  `10fbf178fd693a72e8d1abe9cc75457b1d5c51ef`.
- The hosted final tree
  `0ffc8e79298a777e359a7a4ea6e4c2e9b0c053f1` exactly matched the locally
  tested tree.
- ArtifactStore exports one immutable six-type contract: `image/png`,
  `application/pdf`, `application/json`, `font/ttf`, `text/plain` and
  `application/zip`. Artifact-only and full-state archive validation now use
  that contract.
- New regressions export, offline-verify and restore every current type, including
  rights/font-license text and retained KDP ZIPs, and reject `text/html`.
- Focused local artifact/state recovery tests: 79 passed, zero failed/skipped.
  An attempted aggregate local command was not evidence because this fresh clone
  had not installed the `pg` package; the hosted suites installed locked
  dependencies and ran the complete PostgreSQL coverage.
- POD integration gates run `39663522121`, job `119442428646`: success.
- POD container runtime gates run `39663522224`, job `119442429122`:
  success, including the production Docker image, Python QA/rendering,
  Node/PostgreSQL recovery tests, real print/review workflow and startup with
  publication disabled.
- Guarded Content Control merge:
  `379fcd306a9f624e9a089e07463715a774186a43`.

### Money Factory dependent pin and hosted verification

- The intervening Money Factory head
  `398f963e2e9538c0dbbb5623253ee1888badeeea` changed only
  `FREE_MONITOR_EVENTS.json` and `FREE_MONITOR_STATE.json`; it was preserved
  as PR #117's exact base.
- PR #117 exact tested head:
  `71649b9c432b79684bdec251523785c383dc272c`.
- The cross-repository workflow pins Content Control merge
  `379fcd306a9f624e9a089e07463715a774186a43` and exercises the current
  state-archive contract alongside KDP metadata, original manuscript/font
  rights, retained official-template sources, CMYK cover, editorial-bound QA,
  complete Node tests and complete Python tests.
- POD cross-repository review verification run `39664608458`, job
  `119446200851`: success.
- Guarded Money Factory merge:
  `a906818256eacbb64787fd3c3e36f095b90abeb7`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `379fcd306a9f624e9a089e07463715a774186a43` and created deployment
  `dep-dbchd64s728c7392ge6g` at `2026-10-21T19:46:32.753777Z`.
- Event `evt-dbchd6dc968c73d30ovg` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T19:46:33.984077Z`;
  deploy-ended event `evt-dbchd6ma6ers73aakg2g` followed at
  `2026-10-21T19:46:34.411757Z`. The deployment finished
  `build_failed` at `2026-10-21T19:46:34.379005Z`.
- No hosted rollout of r164 was verified. No manual retry, paid capacity,
  plan/cache change, replacement service, secret access, or network widening
  was attempted.

### Acceptance truth

Current artifact formats can now pass both implemented encrypted recovery paths,
but synthetic and hosted disposable tests are not a retained production snapshot
or authorized restoration drill. Restricted production database/schema
verification, independent durable retention, actual restore/RTO/RPO evidence,
source-database expiry resolution, deployed hybrid dependencies, live Money
Factory authority and grants/revocation, authorized accounts and market sources,
current rights and official-template provenance, substantive KDP
editorial/preview acceptance, calibrated independent QA/remediation, permitted
live adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual
economics/financial reconciliation, owner-phone operations, monitoring drills,
measured capacity, end-to-end acceptance and controlled launch readiness remain
unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run did not claim a continuously
running self-hosted worker.

## Run receipt r165 — reject unsupported stored artifact media on read (2026-10-21 UTC)

### Scope

This run closed a read-side storage and security integrity gap. Artifact writes,
recovery and stored-task role resolution enforced the shared six-type POD media
allowlist, but `ArtifactStore.get` previously accepted a legacy or foreign row
whose bytes, SHA-256 and size were valid even when its stored `media_type` was
unsupported. The read path now filters exact approved media types in PostgreSQL
before transferring a blob and independently rechecks the metadata in the
application for alternate pool implementations. Unsupported metadata fails
closed as `ARTIFACT_UNAVAILABLE`; it is not relabeled on read. This does not
establish provenance, rights, editorial acceptance or a live platform result.
Etsy remained excluded. The failed production-database administration route was
not retried because no credible access-path change was observed.

### Content Control implementation and hosted verification

- PR #421 exact tested head:
  `065f6aa421c93ebb1abff6040a510f777ce04968`.
- The exact remote tree
  `04f450f2736d47fd51462dfeb1f7f69468cefb5a` matched the locally tested
  four-file repair.
- PostgreSQL artifact reads require `media_type=ANY($3::text[])` using the
  shared immutable allowlist before blob transfer, then recheck the returned
  metadata in-process.
- Unit and disposable-PostgreSQL regressions prove that a valid hash and body
  stored as `text/html` remain unavailable and that the database filter
  returns zero blob bytes.
- Focused local Node verification passed 95 tests with 0 failures or skips.
  A separate broader local command reached one environment-only failure because
  the clean worktree had no `express` dependency installed; it was not counted
  as acceptance evidence.
- `git diff --check` passed.
- POD integration gates run `39677559877`, job `119491263545`: success.
- POD container runtime gates run `39677559869`, job `119491263736`:
  success.
- Guarded Content Control merge:
  `06e1267b1992c015ac068d8f26ac606b78da67ed`.

### Money Factory dependent pin and hosted verification

- PR #118 exact tested head:
  `ef7535a5640e3015339584f1c2775e04c4e40e24`.
- The cross-repository workflow pins Content Control merge
  `06e1267b1992c015ac068d8f26ac606b78da67ed` while keeping
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- POD cross-repository review verification run `39678592977`, job
  `119494838642`: success.
- Guarded Money Factory merge:
  `d4be5ef3b7a7da71b82e2555bc3801d24877decd`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `06e1267b1992c015ac068d8f26ac606b78da67ed` and started deployment
  `dep-dbciqu4s728c73akcecg`.
- Deploy-started event `evt-dbciqu3657ic73ag1ceg` occurred at
  `2026-10-21T21:24:08.835971Z`.
- Event `evt-dbciqu740dgc738vmvs0` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T21:24:08.947314Z`;
  deploy-ended event `evt-dbciquekvk2s73dvt5r0` followed at
  `2026-10-21T21:24:09.239895Z` with failed status.
- No build or hosted rollout of r165 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes a stored-media read-confusion gap only. Passing synthetic,
PostgreSQL and container tests are not live acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed
hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, independent QA/remediation outcomes, permitted live adapters for
KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics and
financial reconciliation, owner-phone operations, monitoring/recovery drills,
measured capacity, real end-to-end acceptance and controlled launch readiness
remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run did not claim a continuously
running self-hosted worker.

## Run receipt r166 — reject unsupported stored evidence media (2026-10-21 UTC)

### Scope

This run closed a stored-evidence integrity gap. Market, financial and provider
listing intake verified referenced SHA-256 bytes directly in PostgreSQL, but
those paths bypassed the artifact read contract and could accept a legacy or
foreign row with unsupported stored media metadata. The shared verifier now
checks the exact six-type artifact media allowlist for every referenced proof.
Unsupported blobs remain visible only as metadata so they can return the fixed
`EVIDENCE_ARTIFACT_MEDIA_INVALID` reason; PostgreSQL does not hash them and no
blob body crosses into the application. Missing proof and supported-media byte
corruption retain their existing distinct fail-closed reasons. This establishes
technical media-contract consistency only, not source truth, rights, financial
authenticity or provider acceptance. Etsy remained excluded. The failed
production-database administration route was not retried because no credible
access-path change was observed.

### Content Control implementation and hosted verification

- PR #423 exact tested head:
  `4748269765cd0b2cffe9d643bb1a327845415aff`.
- All 11 remote changed blobs exactly matched the locally tested files.
- The shared evidence query conditionally hashes a body only when its stored
  media type belongs to `ARTIFACT_MEDIA_TYPES`, then rechecks metadata in the
  application for alternate pool implementations.
- Disposable-PostgreSQL coverage inserts valid bytes under unsupported
  `text/html` metadata and proves market, financial and listing intake all
  reject without queue, inbox, event, ledger or market mutations.
- The broad focused local suite passed 171 tests with zero failures/skips; its
  direct evidence/release subset passed 76 tests with zero failures/skips.
- `git diff --check` passed.
- POD integration gates run `39685689346`, job `119519038181`: success.
- POD container runtime gates run `39685689344`, job `119519037868`:
  success.
- Guarded Content Control merge:
  `10353132631d3ac89abc348d7a04992194230520`.

### Money Factory dependent pin and hosted verification

- Initial PR #119 head `4428b9a678c076ecfbaf4b30a069a9558f17f326`
  passed run `39686386494`, job `119521399093`, but was not merged after
  main advanced with unrelated monitor commit
  `ed1768125d9c44fe5e77448fe775a8dfd0b1484c`.
- The branch was moved with an exact-head lease to that current main and the
  pin was reapplied, preserving the monitor change. The superseded PR closed
  without merge.
- Replacement PR #120 exact tested head:
  `babbcdafa71da0057ff919e023f03686ce2387c9`.
- POD cross-repository review verification run `39687118980`, job
  `119523891603`: success.
- The workflow pins Content Control merge
  `10353132631d3ac89abc348d7a04992194230520` and retains both false
  publication flags.
- Guarded Money Factory merge:
  `a1b6a13f5e25722dee4a267ad558069eb75b76f7`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `10353132631d3ac89abc348d7a04992194230520` and created deployment
  `dep-dbcjnitg1s2s7384l0gg`.
- Event `evt-dbcjnj5k3hvs739m6i7g` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T22:25:16.124495Z`;
  deploy-started event `evt-dbcjnj4tuius73c65tp0` and deploy-ended event
  `evt-dbcjnj6j5dgc739m3slg` recorded the same failed attempt.
- No build or hosted rollout of r166 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one stored-evidence media-confusion gap only. Passing synthetic,
PostgreSQL and container tests are not live acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed
hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, independent QA/remediation outcomes, permitted live adapters for
KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics and
financial reconciliation, owner-phone operations, monitoring/recovery drills,
measured capacity, real end-to-end acceptance and controlled launch readiness
remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run did not claim a continuously
running self-hosted worker.

## Run receipt r167 — bind generated package manifests to platform media contracts (2026-10-21 UTC)

### Scope

This run closed a generated-package ingestion gap. The production worker
previously accepted an empty, partial, extra or unknown output manifest and
inferred media types from filename extensions, including a fallback to
`image/png`. Generated packages now use an exact platform contract:
`print.png`, `art-mask.png` and `text-mask.png` for the supported
merchandise platforms, with `cover.pdf`, `interior.pdf` and
`interior.receipt.json` additionally required for KDP. Empty, incomplete,
extra, unknown-platform and unsupported-platform packages fail closed before
artifact storage. Media types come from the exact filename contract rather than
an extension fallback. Etsy remained excluded. The failed production-database
administration route was not retried because no credible access-path change was
observed.

### Content Control implementation and hosted verification

- PR #425 initial head
  `a8124efe8495d94620dc01786d714a8a5f28564a` was not accepted: integration
  run `39688770606`, job `119529417892`, exposed one stale synthetic KDP
  fixture after the Node suite had passed. The fixture was corrected to emit
  the exact KDP package; the failed run is not counted as acceptance evidence.
- PR #425 exact tested head:
  `5eb2955aa83c439a858106ed1cc26979e119d5e6`.
- Focused local Node verification passed 79 tests with zero failures/skips.
  The complete local `test_pod_book_bounds.py` suite passed 93 tests with zero
  failures/skips. `node --check` and `git diff --check` passed.
- A broader local production-E2E command could not start because the clean
  worktree did not have the `pg` dependency installed; it was not counted as
  evidence. The hosted integration and container jobs exercised the required
  dependency environment instead.
- POD integration gates run `39689123998`, job `119530610386`: success.
- POD container runtime gates run `39689124039`, job `119531020618`:
  success, including Python QA/rendering, Node/PostgreSQL tests, real
  print/review generation and startup with production/publication disabled.
- Guarded Content Control merge:
  `33104098301dc639dd0a8b32c2d7cd62939abf63`.

### Money Factory dependent pin and hosted verification

- PR #121 exact tested head:
  `418d51fd3df85f233649443918faa3d08df76973`.
- The cross-repository workflow pins Content Control merge
  `33104098301dc639dd0a8b32c2d7cd62939abf63` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- POD cross-repository review verification run `39690026627`, job
  `119533628199`: success.
- Guarded Money Factory merge:
  `07b170bb43142812fe6613ab7c209a2a9fd02613`.

### Authorized Render verification

- The authorized service remained unsuspended on its existing free plan, main
  branch, commit-triggered auto-deploy, Docker runtime and one instance.
- Render detected Content Control merge
  `33104098301dc639dd0a8b32c2d7cd62939abf63` and created deployment
  `dep-dbck5qtg1s2s73855cd0`.
- Event `evt-dbck5qv40dgc7390qerg` recorded
  `pipeline_minutes_exhausted` at `2026-10-21T22:55:39.771741Z`;
  deploy-ended event `evt-dbck5r4tuius73c6glhg` followed at
  `2026-10-21T22:55:40.096776Z` with failed status.
- No build or hosted rollout of r167 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one generated-package manifest and media-confusion gap only.
Passing synthetic, PostgreSQL and container tests are not live acceptance.
Restricted production database/schema verification, durable
retention/recovery drills, deployed hybrid dependencies, mounted current Money
Factory authority and real grants/revocation, authorized accounts and market
sources, current regional rights and official-template evidence, substantive
KDP editorial/preview acceptance, independent QA/remediation outcomes,
permitted live adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt,
actual economics and financial reconciliation, owner-phone operations,
monitoring/recovery drills, measured capacity, real end-to-end acceptance and
controlled launch readiness remain unverified. All 24 acceptance areas remain
OPEN. `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run did not claim a continuously
running self-hosted worker.

## Run receipt r168 — reject media-confused generated package bytes (2026-10-22 UTC)

### Scope

This run closed the next generated-package storage boundary gap. A complete
Redbubble package containing matching manifest hashes and the exact three
required names was reproduced with HTML/script bytes in every `.png` file;
the prior reader accepted all three and labeled them `image/png`. Package
ingestion now requires bounded media-envelope evidence before persistence:
PNG members have the PNG signature, first IHDR and terminal IEND; PDF members
have a supported header and terminal EOF marker; and receipts decode as strict
UTF-8 JSON objects. Hash matches can no longer relabel HTML, malformed binary
data, JSON arrays/primitives or invalid UTF-8 as trusted package media. These
checks do not replace complete decoding or independent product QA. Etsy remained
excluded. The failed production-database administration route was not retried
because no credible access-path change was observed.

### Content Control implementation and hosted verification

- Pre-fix reproduction accepted three HTML/script bodies as `image/png` under
  a complete Redbubble manifest.
- PR #427 exact tested head:
  `73decaeb2a70c33589142f44662137606fa4520e`.
- All six remote changed blobs exactly matched the locally tested files.
- The affected local Node suite passed 80 tests with zero failures/skips. The
  complete local `test_pod_book_bounds.py` suite passed 93 tests with zero
  failures/skips. `node --check` and `git diff --check` passed.
- POD integration gates run `39698383281`, job `119561276151`: success.
- POD container runtime gates run `39698383273`, job `119561276385`:
  success, including Python QA/rendering, Node/PostgreSQL tests, real
  print/review generation and startup with production/publication disabled.
- Guarded Content Control merge:
  `1aaddb44fe1e32d3db873e00dc68cd5a1b43bf42`.

### Money Factory dependent pin and hosted verification

- PR #122 exact tested head:
  `a6177c92e96f640c8937878be9ecd458f20ca791`.
- The cross-repository workflow pins Content Control merge
  `1aaddb44fe1e32d3db873e00dc68cd5a1b43bf42` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- POD cross-repository review verification run `39699107787`, job
  `119563690299`: success.
- Guarded Money Factory merge:
  `7829604be2c3ae731b36bb079d579a711c0906ba`.

### Authorized Render verification

- The authorized service remained on its existing free plan, main branch and
  commit-triggered deployment path.
- Render detected Content Control merge
  `1aaddb44fe1e32d3db873e00dc68cd5a1b43bf42` and created deployment
  `dep-dbcld9ou01pc73bff2qg`.
- Deploy-started event `evt-dbcld9uj5dgc739nakkg` occurred at
  `2026-10-22T00:19:51.420414Z`.
- Event `evt-dbcld9ukvk2s73e1suu0` recorded
  `pipeline_minutes_exhausted` at `2026-10-22T00:19:51.440573Z`;
  deploy-ended event `evt-dbcld9ukvk2s73e1suvg` followed at
  `2026-10-22T00:19:51.737509Z` with failed status.
- No build or hosted rollout of r168 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one generated-package media-confusion gap only. Passing synthetic,
PostgreSQL and container tests are not live acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed
hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, calibrated independent QA/remediation outcomes, permitted live
adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics
and financial reconciliation, owner-phone operations, monitoring/recovery
drills, measured capacity, real end-to-end acceptance and controlled launch
readiness remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r171 — bind generated packages to authenticated source art (2026-10-22 UTC)

### Scope

This run closed the next generated-package admission gap. The production
worker previously accepted a hash-consistent package manifest without a
`source_sha256`; the parent process therefore relied on child behavior and
could store and hold a package that was not bound to the authenticated source
artwork. The worker now verifies the signed asset-rights envelope, the exact
source bytes and their digest before invoking generation, then requires the
returned manifest to carry the same source digest before storage or review
hold. Reads are bounded, final symlinks are refused, JSON and UTF-8 are strict,
and fixed redacted failure reasons distinguish missing, invalid and mismatched
source evidence. This does not establish artwork quality, marketplace rights
or live acceptance. Etsy remained excluded. The failed production-database
administration route was not retried because no credible access-path change
was observed.

### Content Control implementation and hosted verification

- Pre-fix reproduction printed `PRE_FIX_ACCEPTED_MISSING_SOURCE_IDENTITY` for
  a package whose outer hash was valid but whose manifest omitted source
  identity.
- PR #434 exact tested head:
  `b6798012689ebd6313c755a9a0806268c04f1dcb`.
- All nine remote changed blobs exactly matched the locally tested files.
- The broad dependency-free local Node run passed 632 tests with zero failures
  and two expected database-only skips. The focused source, artifact, worker
  and QA-process run passed 90 tests with zero failures/skips. The complete
  local `test_pod_book_bounds.py` suite passed 93 tests with zero
  failures/skips. Locally unavailable dependency-backed suites were not
  counted as passing. `node --check` and `git diff --check` passed.
- POD integration gates run `39711808336`, job `119604630207`: success.
- POD container runtime gates run `39711808307`, job `119604630318`:
  success, including image build, nonroot dependency installation, Python
  QA/rendering, Node/PostgreSQL tests, real print/review generation and startup
  with production/publication disabled.
- Guarded Content Control merge:
  `1a5ef2bec2f44b724b789e8f99b200f9e500827f`.

### Money Factory dependent pin and hosted verification

- PR #125 first exact head
  `ba026ac4b88eaf31bbdda5642f63dfc6690a508e` pinned the verified Content
  Control merge while retaining `PUBLICATION_ENABLED=false` and
  `POD_PUBLICATION_ENABLED=false`.
- Cross-repository run `39713069298`, job `119608702410`, passed every
  completed step but was cancelled by the workflow's existing 10-minute job
  limit during the long KDP editorial-bound suite. No test failure was
  reported.
- The same PR increased only that job limit to 20 minutes. The final exact
  head was `4e8df38cd1edac6233223e0c4621e7b953dc9766`; its workflow blob
  `759a2f27889f0fd7cd80ffb0ef09adf46f184863` exactly matched the local file.
- POD cross-repository review verification run `39714081210`, job
  `119611932250`: success, including all previously interrupted and remaining
  Node/Python suites.
- Guarded Money Factory merge:
  `d6b931e93b04a73ecb8ea7be8e48f973ce388ddc`.

### Authorized Render verification

- The authorized service remained on its existing free plan, main branch and
  commit-triggered deployment path.
- Render detected Content Control merge
  `1a5ef2bec2f44b724b789e8f99b200f9e500827f` and created deployment
  `dep-dbcnh1uk1f9s73arts90`.
- Deploy-started event `evt-dbcnh1uj5dgc739om3d0` recorded the exact merge at
  `2026-10-22T02:44:23.918054Z`; event `evt-dbcnh1sdthfc73dhdt2g`
  recorded `pipeline_minutes_exhausted` at
  `2026-10-22T02:44:23.975533Z`; deploy-ended event
  `evt-dbcnh2740dgc73931u9g` recorded failed status at
  `2026-10-22T02:44:24.270010Z`.
- No build or hosted rollout of r171 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one generated-package source-integrity gap only. Passing
synthetic, PostgreSQL and container tests are not live acceptance. Restricted
production database/schema verification, durable retention/recovery drills,
deployed hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, calibrated independent QA/remediation outcomes, permitted live
adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics
and financial reconciliation, owner-phone operations, monitoring/recovery
drills, measured capacity, real end-to-end acceptance and controlled launch
readiness remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r169 — bind package identity before durable storage (2026-10-22 UTC)

### Scope

This run closed the next generated-package admission gap. The production
worker previously parsed `manifest.json`, verified each declared artifact hash
and media envelope, but did not authenticate the manifest's own
`package_sha256` before writing artifact bytes or creating a review hold. A
synthetic package with a valid file map and an unrelated 64-character package
hash was reproduced as admissible on the no-review path. The worker now reads
one bounded regular-file manifest snapshot without following a final symlink,
requires strict UTF-8 JSON within depth/node limits, binds schema version,
platform, `publication_enabled=false` and template identity, and verifies the
package hash over the exact canonical bytes before any durable artifact write.
The exact-byte check avoids reinterpreting Python float formatting. It does not
replace independent product QA or prove live marketplace acceptance. Etsy
remained excluded. The failed production-database administration route was not
retried because no credible access-path change was observed.

### Content Control implementation and hosted verification

- Pre-fix reproduction reached the review-hold boundary with an unrelated
  syntactically valid `package_sha256`.
- PR #429 exact tested head:
  `308fa17b576fa668141719f86dd0d07081b4e55e`.
- All seven remote changed blobs exactly matched the locally tested files.
- The focused local Node suite passed 88 tests with zero failures/skips. The
  complete local `test_pod_book_bounds.py` suite passed 93 tests with zero
  failures/skips. A broad dependency-free POD run passed 624 tests; six
  PostgreSQL test files could not start in the clean local worktree because
  the `pg` dependency was not installed and were not counted as passing.
  `node --check` and `git diff --check` passed.
- POD integration gates run `39700462077`, job `119568155613`: success.
- POD container runtime gates run `39700462019`, job `119568155033`:
  success, including Python QA/rendering, Node/PostgreSQL tests, real
  print/review generation and startup with production/publication disabled.
- Guarded Content Control merge:
  `d7802f99daafeeb26db7fde6c2e08618c9037c68`.

### Money Factory dependent pin and hosted verification

- PR #123 exact tested head:
  `bd9f2102e976edb71b025d9409e332824525ba50`.
- The cross-repository workflow pins Content Control merge
  `d7802f99daafeeb26db7fde6c2e08618c9037c68` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- POD cross-repository review verification run `39701179188`, job
  `119570510833`: success.
- Guarded Money Factory merge:
  `694e4c054144698d151767b51f64aae1233084b8`.

### Authorized Render verification

- The authorized service remained on its existing free plan, main branch and
  commit-triggered deployment path.
- Render detected Content Control merge
  `d7802f99daafeeb26db7fde6c2e08618c9037c68` and created deployment
  `dep-dbclmvbncjis73b0itc0`.
- Event `evt-dbclmvfj6onc73btgg8g` recorded
  `pipeline_minutes_exhausted` at `2026-10-22T00:40:29.669532Z`;
  deploy-started event `evt-dbclmvctuius73c7ies0` followed at
  `2026-10-22T00:40:29.682624Z`, and deploy-ended event
  `evt-dbclmvn40dgc7391tojg` recorded failed status at
  `2026-10-22T00:40:30.127136Z`.
- No build or hosted rollout of r169 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one package-manifest integrity gap only. Passing synthetic,
PostgreSQL and container tests are not live acceptance. Restricted production
database/schema verification, durable retention/recovery drills, deployed
hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, calibrated independent QA/remediation outcomes, permitted live
adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics
and financial reconciliation, owner-phone operations, monitoring/recovery
drills, measured capacity, real end-to-end acceptance and controlled launch
readiness remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.

## Run receipt r170 — bind generated packages to authenticated templates (2026-10-22 UTC)

### Scope

This run closed the next generated-package admission gap. The production
worker previously required a syntactically valid `template_sha256`, but did not
verify it against the embedded manifest template or bind that embedded template
to the authenticated, scope-checked template approved before generation. A
synthetic manifest with an unrelated 64-character template hash and a correctly
recomputed outer package hash was reproduced as admissible. The worker now
extracts unambiguous top-level manifest members, verifies the template digest
over the exact embedded bytes, and compares its parsed value with the authorized
template before any artifact storage or review hold. Fixed redacted reasons
distinguish digest and authority mismatches. This does not establish official
template provenance, product quality or live marketplace acceptance. Etsy
remained excluded. The failed production-database administration route was not
retried because no credible access-path change was observed.

### Content Control implementation and hosted verification

- Pre-fix reproduction printed `PRE_FIX_ACCEPTED_TEMPLATE_HASH_MISMATCH` for a
  manifest whose outer package hash was valid but whose template digest was
  unrelated.
- PR #431 exact tested head:
  `edc45aefc224036f14815aa12ad2410106f4357f`.
- All seven remote changed blobs exactly matched the locally tested files.
- The broad dependency-free local Node run passed 627 tests with zero
  failures/skips. The focused artifact, worker and QA-process run passed 85
  tests with zero failures/skips. The complete local
  `test_pod_book_bounds.py` suite passed 93 tests with zero failures/skips.
  Locally unavailable dependency-backed suites were not counted as passing.
  `node --check` and `git diff --check` passed.
- POD integration gates run `39707460286`, job `119590747166`: success.
- POD container runtime gates run `39707460442`, job `119590747820`:
  success, including Python QA/rendering, Node/PostgreSQL tests, real
  print/review generation and startup with production/publication disabled.
- Guarded Content Control merge:
  `b3eb9d1aacf7d20ec5738bcf33a5263d99d963f3`.

### Money Factory dependent pin and hosted verification

- PR #124 exact tested head:
  `a6539db94a5c3a7d4b98442aa1139829e1983c63`.
- The cross-repository workflow pins Content Control merge
  `b3eb9d1aacf7d20ec5738bcf33a5263d99d963f3` while retaining
  `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
- POD cross-repository review verification run `39708187688`, job
  `119593050031`: success.
- Guarded Money Factory merge:
  `5a79a8b0a988981ed3d30f1e1633c3ee6c601c04`.

### Authorized Render verification

- The authorized service remained on its existing free plan, main branch and
  commit-triggered deployment path.
- Render detected Content Control merge
  `b3eb9d1aacf7d20ec5738bcf33a5263d99d963f3` and created deployment
  `dep-dbcmoajm8hqs73agcsn0`.
- Deploy-started event `evt-dbcmoan42ijs73bc6mn0` recorded the exact merge at
  `2026-10-22T01:51:38.465187Z`; event `evt-dbcmoakdthfc73dgvc9g`
  recorded `pipeline_minutes_exhausted` at
  `2026-10-22T01:51:38.643784Z`; deploy-ended event
  `evt-dbcmoan42ijs73bc6mq0` recorded failed status at
  `2026-10-22T01:51:38.971407Z`.
- No build or hosted rollout of r170 was verified. No manual retry, paid
  capacity, plan/cache change, replacement service, secret access or network
  widening was attempted.

### Acceptance truth

This closes one generated-package template-integrity gap only. Passing
synthetic, PostgreSQL and container tests are not live acceptance. Restricted
production database/schema verification, durable retention/recovery drills,
deployed hybrid dependencies, mounted current Money Factory authority and real
grants/revocation, authorized accounts and market sources, current regional
rights and official-template evidence, substantive KDP editorial/preview
acceptance, calibrated independent QA/remediation outcomes, permitted live
adapters for KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, actual economics
and financial reconciliation, owner-phone operations, monitoring/recovery
drills, measured capacity, real end-to-end acceptance and controlled launch
readiness remain unverified. All 24 acceptance areas remain OPEN.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; no publication was attempted. This run used only its actually
available bounded tools and did not claim a continuously running self-hosted
worker.
