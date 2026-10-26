# POD run receipt r272 — invalid storage-clock guard

Date: 2026-10-25 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`9fd3221f8996c9fd411a321b440a69d18ee3fb54`; Money Factory main was
`e4258eb1f638723a8c4e5bb5e4de43b6c450df6e`. The current completion,
implementation and free-deployment records, open pull requests, recent workflow
results and the authorized existing Render service were inspected before
editing. Existing open pull requests were unrelated to the shared POD storage
clock, so no duplicate job or PR was created.

The prior database-administration path still had no credible access change and
was not retried. The separately reported local full-database export was not
available to this execution environment, and no isolated restore target was
available; no restore acceptance was claimed. No network rule, database
identity, secret, paid resource or service setting was changed.

## Implemented and merged

[Content Control PR 663](https://github.com/wecreates/content-control/pull/663)
hardened the central `PodDB.active()` retention boundary. The previous
subtraction-based comparison failed open when the process clock returned `NaN`
or another nonnumeric value: the resulting comparison was false, so a POD
transaction could open a database connection and reach its callback.

The guard now requires the process wall clock and configured expiry to be exact,
nonnegative safe integers within JavaScript's supported date range. Invalid
clock state returns the existing `POD_STORAGE_EXPIRING` failure before database
access. The regression covers `NaN`, string, fractional, negative and unsafe or
out-of-range values and verifies zero connection attempts.

The regression failed on reconstructed main by reaching the transaction
callback with `Date.now()` returning `NaN`; it passed after the repair. The
focused storage, artifact, market, finance, outbox, publication and health suite
passed 138/138. The complete local POD Node suite passed 855 tests: 846 passed,
nine expected environment-gated skips and zero failures. Whitespace checks were
clean. Exact PR head `b84038c96697ef6adc524a4d77741799992c5d06`
passed:

- integration run
  [40273684331](https://github.com/wecreates/content-control/actions/runs/40273684331),
  job `121411780049`;
- production-container run
  [40273684289](https://github.com/wecreates/content-control/actions/runs/40273684289),
  job `121411779446`.

The base remained `9fd3221f8996c9fd411a321b440a69d18ee3fb54` and the exact
tested head was squash-merged as
`8b067ee709559674cfe703cf6bb3bd8b0a88c296`.

Dependent [Money Factory PR 228](https://github.com/wecreates/Money-factory/pull/228)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`567e96dc9091a20702a502069e823a986ec67a7c` passed run
[40274418668](https://github.com/wecreates/Money-factory/actions/runs/40274418668),
job `121413998635`, across review, evidence, recovery, KDP, rights and adapter
contract stages. Its base remained
`e4258eb1f638723a8c4e5bb5e4de43b6c450df6e`; it merged as
`c96822a2c8153b11542bd0ea5ea66dbc733ebb82`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`8b067ee709559674cfe703cf6bb3bd8b0a88c296` as deploy
`dep-dbfe9lcs728c73df3d70`. Event `evt-dbfe9lbphbkc73acnrng` records the start,
`evt-dbfe9lb8vfls7397d34g` records `pipeline_minutes_exhausted`, and
`evt-dbfe9lmbs3rs73cmr61g` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This clock repair is merged code plus
hosted test evidence, not live database retention or restoration, deployment,
real account/source/rights/template/reviewer evidence, authorized marketplace
submission, actual economics/reconciliation, owner-phone acceptance, measured
capacity, publication, revenue or launch readiness. Both publication flags
remain false; Etsy remains excluded. No approval, clearance, provider result or
continuously running self-hosted worker is claimed.
