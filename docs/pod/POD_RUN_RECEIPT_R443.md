# POD run receipt R443

Date: 2026-11-04 UTC (2026-11-03 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `e17e4da331ea19e681054eeebb64e94a22a276d9`.
- Content Control `main` was `1432594a6e0248e02c53df09f7a292e353fa8311`.
- No open POD pull request or duplicate R443 job existed in Money Factory. The only
  open Content Control result matching the broad POD search was unrelated disabled
  OpenFilm draft PR 378; it was not changed or merged.
- The monitoring, zero-credit QA and prior POD receipt history already present in
  the exact Content Control base were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require live, attributable evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

The exported Money Factory `economicsFixture` is explicitly synthetic test data,
but it directly read job properties and performed arithmetic on the caller's clock.
A Proxy, property accessor, inherited job or coercible clock could therefore execute
caller code while creating evidence later consumed by release-authority tests. This
was a test-fixture integrity defect, not proof of a production economics bypass.

Four focused regressions separately exercised a job Proxy, job accessor, inherited
job and clock coercion. Before the repair, the focused evidence suite ran nine tests:
five passed and all four new regressions failed because those inputs were accepted.
The direct reproduction observed five Proxy reads, one accessor read and two clock
coercion calls.

The repaired fixture now accepts only an inert plain or null-prototype job with own
data descriptors for the five required fields. It validates bounded opaque job,
business and account identities, one of the five in-scope platforms, a lowercase
64-character package SHA-256 and an exact safe timestamp before creating the
synthetic budget. Invalid evidence fails with `ECONOMICS_FIXTURE_INVALID` without
invoking caller code. The production economics enforcer and all live configuration
are unchanged.

Money Factory PR 398 contained only:

- `integrations/pod/economics-fixture.mjs`: inert fixture input validation;
- `integrations/pod/economics-evidence.test.mjs`: four no-invocation regressions.

The exact PR head was `58e85c57d126cf8d7d8134112d4da6159dbf6239`.
It was two commits ahead of the unchanged base, with 36 additions across those two
files. PR 398 was squash-merged under the standing authorization as
`b1d5d63bdc12bd895cbb868742a19d87a6df425d`.

## Verification evidence

Local verification against Content Control
`1432594a6e0248e02c53df09f7a292e353fa8311`:

- repaired focused economics/grant suites: 27 passed, 0 failed;
- full Money Factory POD Node suite: 209 total, 208 passed, 1 PostgreSQL-only
  test skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41790456936` (run number 400), job `126442358302`, completed successfully. Every
reported job step succeeded. Its logs recorded:

- 825 pinned Content Control Node tests passed;
- the pinned Python groups passed with 34, 23, 40, 28, 28, 93, 5 and 6 tests;
- 23 editorial-bound KDP tests passed;
- all 209 Money Factory Node/PostgreSQL tests passed, including the four new
  regressions;
- all 81 Money Factory bridge Python tests passed.

The hosted environment recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow at
`b1d5d63bdc12bd895cbb868742a19d87a6df425d` retains both values as literal
`'false'`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblaboepbehc73ctnjm0` remained `live` on runtime-bearing Content Control
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. The R442 documentation-only merge
did not create another deploy, as intended. R443 changes Money Factory test-fixture
code and this allowlisted receipt only; it does not change the Render application's
runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. Synthetic fixture integrity is not
actual price, cost, fee, royalty, profit, statement or revenue evidence and does not
close economics or financial reconciliation acceptance. This run also does not
provide real marketplace accounts, current regional rights evidence, official print
proofs, independent product acceptance, live submission/readback, measured
production capacity, an authorized end-to-end publication, or launch approval.
Publication remains held for explicit approval after every acceptance requirement is
satisfied. Etsy remains excluded.

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
