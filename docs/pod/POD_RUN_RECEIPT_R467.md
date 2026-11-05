# POD run receipt R467

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `004e821284591af9cbaeeb65caaf774ede74196c`,
  the R466 event-receiver failure-provenance repair.
- Content Control `main` was `e58b5caca8c7d5dbeadcb17b5dd3e3369af0c333`,
  the R466 evidence receipt.
- No later commit, overlapping POD/KDP pull request or duplicate R467 job existed.
  Existing unrelated draft pull requests, concurrent monitor work and excluded Etsy
  work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The Money Factory event receiver capped unresolved PostgreSQL acquisitions at 32,
but imposed no equivalent bound before authenticating a request. An arbitrary
number of valid-shaped, slow request bodies could therefore each retain a handler
and up to 512 KiB of body memory before reaching the database cap. This left the
receiver's pre-database capacity unbounded even though its downstream queue was
bounded.

The expected-red event-handler suite ran 21 tests on the prior implementation.
Twenty passed and the new regression failed because a 33rd request was decoded and
committed with HTTP 200 while 32 slow request bodies were still unsettled; the
required retryable HTTP 503 was not returned.

Money Factory now admits at most 32 concurrent event requests per verified pool
before reading their bodies. Overflow is rejected with the existing redacted,
retryable `EVENT_RECEIVER_UNAVAILABLE` response. The admission lease is released
exactly once after the handler settles, including decoding, signature, database,
timeout and failure paths. The existing, independently bounded database-acquisition
gate remains in force after authentication.

Money Factory PR 422 contained only the event handler and its regression test. Its
exact head was `a2432ce22203f4475e1b4b52c65471e137b02393`, based on the reconciled
Money Factory main. GitHub reported the PR cleanly mergeable and review of the
focused diff found no material correctness, security, compatibility or missing-test
issue. PR 422 was squash-merged under the standing authorization as
`19e13b5d3727b8f33e955e34e0a0f1ead85a12f0`.

## Verification evidence

Local verification against the reconciled Content Control checkout:

- expected-red event-handler suite: 21 total, 20 passed and the single new
  admission regression failed for the reason above;
- repaired event-handler suite: 21 passed, 0 failed;
- full Money Factory POD Node suite: 263 total, 262 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41976220795` (run number 424), job `127075574874`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Content Control Python/KDP groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests passed; all 263 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and new admission regression; and all 81 Money Factory bridge
Python tests passed.

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
not contain or validate the separate Money Factory receiver repair and does not
establish database, authority, marketplace, end-to-end or publication acceptance.
This documentation-only R467 receipt uses `[skip render]` and must not trigger
another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a tested
pre-database admission bound for the event receiver only. It does not create or
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
