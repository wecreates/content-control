# POD run receipt R468

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `19e13b5d3727b8f33e955e34e0a0f1ead85a12f0`,
  the R467 event-receiver request-admission repair.
- Content Control `main` was `0f16d3313b983e3a6b760bc2a33328e31bd6dee0`,
  the R467 evidence receipt.
- No later commit, overlapping POD/KDP pull request or duplicate R468 job existed.
  Existing unrelated draft pull requests, concurrent monitor work and excluded Etsy
  work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The Money Factory grant authority capped unresolved snapshot lookups at 32 and
bounded each request body to 4 KiB, but imposed no aggregate bound before decoding
a request. An arbitrary number of valid-shaped, slow bodies could therefore each
retain a handler and body buffer before reaching the snapshot-lookup cap. This left
pre-lookup authority capacity unbounded even though its backend work was bounded.

The expected-red authority-admission suite ran five tests on the prior
implementation. Four passed and the new regression failed because a 33rd request
was decoded and signed with HTTP 200 while 32 slow request bodies were still
unsettled; the required fail-closed HTTP 409 was not returned.

Money Factory now admits at most 32 concurrent authority requests per verified
server-owned snapshot loader before reading their bodies. Overflow is rejected with
the existing redacted `GRANT_BLOCKED` response. The admission lease is released
exactly once after the handler settles, including decoding, lookup, signing, timeout
and failure paths. The existing, independently bounded snapshot-lookup gate remains
in force after request validation.

Money Factory PR 423 contained only the authority handler and its regression test.
Its exact head was `6af0eaac6a74cf00d81d010d0720582f3f0f7792`, based on the
reconciled Money Factory main. GitHub reported the PR cleanly mergeable and review
of the focused diff found no material correctness, security, compatibility or
missing-test issue. PR 423 was squash-merged under the standing authorization as
`88e120ee0a9b7b5cbe4624cd76b4417d30670918`.

## Verification evidence

Local verification against the reconciled Content Control checkout:

- expected-red authority-admission suite: 5 total, 4 passed and the single new
  admission regression failed for the reason above;
- repaired authority admission and handler suites: 26 passed, 0 failed;
- full Money Factory POD Node suite: 264 total, 263 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41986477888` (run number 425), job `127108295846`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Content Control Python/KDP groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests passed; all 264 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and new authority admission regression; and all 81 Money Factory
bridge Python tests passed.

The hosted environment recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged workflow retains both literal false
values.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblt4f6of33c73en5f0g` remained `live` on Content Control revision
`82f5f48b924130253aa38a3731857e7cb14e4338`.

That confirms rollout liveness for those Content Control runtime bytes only. The
current report-only `state/live-deployment-health.json` remains `FAIL`: the probe
is incomplete and every recorded readiness check is false. The live deploy does
not contain or validate the separate Money Factory authority repair and does not
establish database, authority, marketplace, end-to-end or publication acceptance.
This documentation-only R468 receipt uses `[skip render]` and must not trigger
another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a tested
pre-lookup admission bound for the grant authority only. It does not create or
validate the dedicated live database, prove durable storage and independent
recovery, mount and authenticate the live Money Factory authority, provide current
grants/revocation or marketplace account records, supply authorized intelligence
and regional rights, establish accepted generation, official templates, KDP
editorial/preview evidence, independent QA or verified remediation, demonstrate
authorized submission and readback on KDP, Redbubble, TeePublic, Zazzle and
Spreadshirt, reconcile actual economics or financial statements, demonstrate
mobile operations and monitoring in production, measure production capacity,
complete an authorized end-to-end job, or grant controlled launch approval.
Publication remains held for explicit approval after every acceptance requirement
is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the previously recorded connector and browser failures. The run
used only its actually available repository, hosted workflow and authorized Render
inspection capabilities; it did not have a continuously running self-hosted worker,
database shell, marketplace session, or authority to widen network access. It did
not use or disclose credentials, contact anyone, purchase resources, access the
social vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
