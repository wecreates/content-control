# POD run receipt R444

Date: 2026-11-04 UTC (2026-11-03 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `b1d5d63bdc12bd895cbb868742a19d87a6df425d`.
- Content Control `main` was `67cc6fba24161c346fe6023019bbcdcb6cb98973`.
- No open POD pull request or duplicate R444 work existed in either repository.
  Unrelated draft Content Control pull requests were preserved without modification.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require live attributable evidence and keep all
  24 acceptance areas open.
- The authorized Render service remained live on the previously verified runtime
  revision before implementation began.

## Confirmed defect and repair

The shared Money Factory authority snapshot copier rejected executable evidence and
bounded recursion depth and container count, but it did not bound total primitive
fanout or aggregate text. A single server-loaded snapshot could therefore pass the
safety copy and force a large recursive copy, JSON serialization and HMAC operation
before the authority handler reached its response-size check. This was an
authority-process availability and evidence-integrity defect, not proof of a grant
bypass or live authority deployment.

Two focused expected-red regressions exercised an 8,193-field payload and more than
256 KiB of aggregate text. Before the repair, the focused signer suite ran seven
tests: five passed and both new regressions failed because the over-budget payloads
were signed.

The repaired copier now admits at most 8,192 copied values and 256 KiB of aggregate
string values and object-key text. It rejects an over-budget snapshot with the
existing `AUTHORITY_SNAPSHOT_UNVERIFIED` failure before recursive copying,
serialization or HMAC. Existing depth, object, Proxy, accessor, cycle and shape
checks remain intact. Grant meaning, approval checks, economics enforcement and all
live configuration are unchanged.

Money Factory PR 399 contained only:

- `integrations/pod/authority-evidence.mjs`: bounded snapshot value and text budgets;
- `integrations/pod/sign-grant-evidence.test.mjs`: two budget regressions.

The exact PR head was `b7673671ffce431133dcfad65487fcbcc3b16642`.
It was two commits ahead of the unchanged base, with 30 additions and 4 deletions
across those two files. PR 399 was squash-merged under the standing authorization as
`52f2b4d974d226659f9489f251aec7f2b4a24ba2`.

## Verification evidence

Local verification against Content Control
`67cc6fba24161c346fe6023019bbcdcb6cb98973`:

- repaired focused authority/economics evidence suites: 30 passed, 0 failed;
- full Money Factory POD Node suite: 211 total, 210 passed, 1 PostgreSQL-only
  test skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41793145665` (run number 401), job `126450939770`, completed successfully. Every
reported job step succeeded. Its logs recorded:

- 825 pinned Content Control Node tests passed;
- the pinned Python groups passed with 34, 23, 40, 28, 28, 93, 5 and 6 tests;
- 23 editorial-bound KDP tests passed;
- all 211 Money Factory Node/PostgreSQL tests passed, including both new
  regressions and the live disposable PostgreSQL bridge test;
- all 81 Money Factory bridge Python tests passed.

The hosted environment recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow at
`52f2b4d974d226659f9489f251aec7f2b4a24ba2` retains both values as literal
`'false'`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblaboepbehc73ctnjm0` remained `live` on runtime-bearing Content Control
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. R444 changes only Money Factory
authority code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. The new budgets are code-level
authority safety evidence only. This run does not mount the live Money Factory
authority, provide current marketplace accounts or regional rights, import and
print-verify official templates, establish independent product acceptance, reconcile
actual economics or statements, demonstrate authorized submission/readback on all
five marketplaces, measure production capacity, complete an authorized end-to-end
job, or grant launch approval. Publication remains held for explicit approval after
every acceptance requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this scheduled run had no credible
changed access path after the previously recorded connector and browser failures.
The run used only its actually available repository, workflow and authorized Render
inspection capabilities; it did not have a continuously running self-hosted worker,
database shell, marketplace session, or authority to widen network access. It did
not use or disclose credentials, contact anyone, purchase resources, access the
social vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
