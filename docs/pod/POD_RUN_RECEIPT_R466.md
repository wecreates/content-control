# POD run receipt R466

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `837e605ea7a64762041df61cdabefc2076a1566d`.
  Its post-R465 free-monitor cadence commit changed only monitor evidence and was
  preserved.
- Content Control `main` was `cae81119e9586da4374a9da36c14eae1f71da7de`,
  the R465 evidence receipt.
- No open overlapping POD/KDP pull request or duplicate R466 job existed.
  Existing unrelated draft pull requests, concurrent work and excluded Etsy work
  were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The Money Factory event HTTP receiver classified a caught failure by the text of
the native Error's own `message`. That avoided executing Proxy or accessor-backed
rejection values, but it did not prove the origin of the message. A database or
transport implementation could throw an ordinary native Error whose message was
`REQUEST_TOO_LARGE`, `EVENT_SIGNATURE_INVALID`, `EVENT_REPLAY_CONFLICT`,
`EVENT_ENVELOPE_INVALID`, `EVENT_SCOPE_INVALID` or
`EVENT_STORAGE_TEXT_INVALID`; the receiver would then misreport an internal
failure as 413, 401, 409 or 400 instead of its redacted retryable 503. Any native
`SyntaxError` from that untrusted path was also classified as request-invalid.

The expected-red event-handler suite ran 20 tests on the prior implementation.
Nineteen passed and the new regression failed because a database
`Error('REQUEST_TOO_LARGE')` produced HTTP 413 instead of 503.

Money Factory now binds outer request-size, decoding, timeout and envelope-shape
failures to handler-local sentinels. The event inbox uses a private WeakMap to tag
only client faults that its trusted validation path creates, while preserving the
existing direct error messages for callers and tests. Signed JSON parse failures,
signature faults, scope faults, storage-text faults and replay conflicts retain
their intended client status. Database, query, connection and transport failures
cannot acquire that private provenance and therefore remain redacted as
`EVENT_RECEIVER_UNAVAILABLE` with HTTP 503, regardless of their Error type or
message. Storage validation now exposes a boolean result backed by a module-private
sentinel; its existing throwing assertion API remains compatible.

Money Factory PR 421 contained only the event handler, inbox, storage validator
and regression test. Its exact head was
`3896ca3130ad671e0f0adc789cbbdcb809604d9b`, based on the reconciled Money
Factory main. GitHub reported the PR cleanly mergeable and the repository defined
no separate commit-status checks. PR 421 was squash-merged under the standing
authorization as `004e821284591af9cbaeeb65caaf774ede74196c`.

## Verification evidence

Local verification against the reconciled Content Control checkout:

- expected-red event-handler suite: 20 total, 19 passed and the single new
  provenance regression failed for the reason above;
- repaired focused handler, envelope, JSON, storage, clock and round-trip suites:
  57 total, 56 passed, 1 PostgreSQL-only test skipped locally, 0 failed;
- full Money Factory POD Node suite: 262 total, 261 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41969573014` (run number 423), job `127054414116`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Content Control Python/KDP
groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests passed; all 262 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and the new failure-provenance regression; and all 81 Money
Factory bridge Python tests passed.

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
This allowlisted R466 receipt uses `[skip render]` and must not trigger another
deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a tested
failure-provenance boundary for the event receiver only. It does not create or
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
