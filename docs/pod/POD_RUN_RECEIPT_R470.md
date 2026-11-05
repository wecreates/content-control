# POD run receipt R470

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `057522e7045bce09a954895be54206c78f6af829`, the R469 evidence merge.
- Money Factory `main` was
  `6fba073913b4f76f85ea7f9936b539ea08c908cb`, the R469 event-transaction
  deadline repair.
- No later commit, overlapping POD/KDP pull request or duplicate R470 job
  existed. Unrelated draft pull requests and excluded Etsy work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The shared Money Factory handler configuration boundary and the direct event
inbox options boundary copied their known own data properties but silently
ignored every unknown own property. An operator typo such as
`transactionTimeuotMs` therefore created a handler using the 15-second default
instead of rejecting configuration that did not express the intended policy.
The same behavior covered non-enumerable and symbol properties.

The regression-only change produced six expected failures on the prior
implementation: three authority/event handler construction variants and three
direct inbox option variants. Each configuration was accepted or advanced to
ordinary envelope validation instead of failing with its fixed configuration
error before authentication or database work.

Money Factory PR 425 makes both boundaries exact. Unknown own string,
non-enumerable and symbol properties are rejected before authority values are
read, an event is authenticated or a database client can be acquired. Known
optional properties and inert null-prototype configuration objects retain their
existing behavior. The four-file diff contained only the boundary checks and
regressions. Review found no material correctness, compatibility, security or
missing-test issue.

Exact PR head `6c52aacab0dfd8ff60bbd3acdaf7a6767e48c4c3` was cleanly
mergeable on the reconciled Money Factory base and was squash-merged under the
standing authorization as `417d40dc15fa4c6f49a97f4b17ae416ba74659c8`.
The tested and merged commits share exact tree
`41f35d17b8c334bcf5ceaa87de61a3bd51e9585f`.

## Verification evidence

Local verification against the reconciled Content Control checkout recorded:

- expected-red focused regression: 6 failed and 29 passed on the prior
  implementation;
- repaired focused suite: all 35 tests passed;
- full Money Factory POD Node suite: 274 total, 273 passed, one expected local
  PostgreSQL-environment skip and zero failures;
- Money Factory POD Python suite: all 81 tests passed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`42001094974` (run number 427), job `127156200088`, completed successfully.
Hosted logs recorded all 825 pinned Content Control Node tests passed; the pinned
Content Control Python/KDP groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests
passed; all 274 Money Factory Node/PostgreSQL tests passed with no failures or
skips against disposable PostgreSQL 18; and all 81 Money Factory bridge Python
tests passed. The workflow's Content Control checkout was exact revision
`523daed598faf543efa57a95b3f448505feb6c03`; this was pinned consumer evidence,
not a claim that it was the then-current Content Control `main` revision.

The hosted environment recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false` throughout. The merged workflow retains both
literal false values.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained a
one-instance free-plan Docker web service. Its latest deploy
`dep-dbm3135petos738pddeg` remained `live` on Content Control revision
`d4bcd59ed58ba11da6fd637ef99452f4c669488b`.

This proves rollout liveness for that exact Content Control revision only. The
current report-only `state/live-deployment-health.json` still records `FAIL`, an
incomplete probe and false readiness checks. The live Content Control service
does not contain or validate the separate Money Factory construction-boundary
repair. The available Render connector verified deploy state but did not
independently verify a green `/readyz` response. This documentation-only R470
receipt uses `[skip render]` and must not trigger another deployment.

After Content Control receipt PR 1037 merged as
`8cb64967ec9307fb7f3f1513ca34d214508c52b7`, Render recorded
`commit_ignored` event `evt-dbm4mhbncjis738q4lp0` at
2026-11-05T09:24:21.454861Z. No deploy started; the live revision and deploy ID
above remained unchanged.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes fail-closed
Money Factory configuration parsing only. It does not create or validate the
dedicated live database, prove durable storage and independent recovery, mount
and authenticate the live Money Factory authority, provide current grants or
revocation evidence, configure owner-authorized marketplace accounts, establish
authorized market intelligence or regional rights, accept generation, official
templates, KDP manuscripts/editorial/preview output, independent QA or verified
remediation, demonstrate authorized submit/readback on KDP, Redbubble,
TeePublic, Zazzle and Spreadshirt, reconcile actual economics or financial
statements, demonstrate production mobile operations, monitoring, security or
measured capacity, complete an authorized end-to-end job, or grant controlled
launch approval. Publication remains held for explicit approval after every
acceptance requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the previously recorded connector and browser failures. The
run used only its actually available repository, hosted workflow and authorized
Render inspection capabilities; it did not have a continuously running
self-hosted worker, database shell, marketplace session or authority to widen
network access. It did not use or disclose credentials, contact anyone, purchase
resources, access the social vault, evade bot detection, or enable production or
publication.

Useful unblocked work remains, so the automation stays enabled. It must be
disabled only after all 24 acceptance areas are verifiably complete with
publication still held for explicit approval.
