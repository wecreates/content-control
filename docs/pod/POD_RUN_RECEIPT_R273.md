# POD run receipt r273 — operational snapshot clock integrity

Date: 2026-10-25 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`819f75c8d74b0e9f14d75ce84c9c8dde8581dd51`; Money Factory main was
`c96822a2c8153b11542bd0ea5ea66dbc733ebb82`. The current completion,
implementation and free-deployment records, open pull requests, recent workflow
results and the authorized existing Render service were inspected before
editing. Existing open pull requests were unrelated to POD operational-clock
reporting, so no duplicate job or PR was created.

The prior database-administration path still had no credible access change and
was not retried. The separately reported local full-database export remained
outside this execution environment and no isolated restore target was
available, so no restoration acceptance was claimed. No network rule, database
identity, secret, paid resource or service setting was changed.

## Implemented and merged

[Content Control PR 666](https://github.com/wecreates/content-control/pull/666)
hardened the read-only operational health snapshot. The previous implementation
rejected only non-finite observation clocks. A finite fractional, negative or
out-of-range clock could be normalized or could produce an uncontrolled
`RangeError`; a negative configured expiry was reported as a plausible 1969
timestamp instead of invalid configuration.

The snapshot now requires its observation clock and configured expiry to be
exact, nonnegative safe integers within JavaScript's supported date range. An
invalid observation clock returns fixed `OPERATIONAL_CLOCK_INVALID`; an invalid
configured expiry remains observable as critical `STORAGE_EXPIRY_UNKNOWN` with
no normalized timestamp. Diagnostics remain read-only and cannot enable workers,
clear failures, approve content or publish.

Regression-first verification reproduced both gaps on reconstructed main: an
invalid finite wall clock was accepted and a negative expiry was normalized to
1969. After the repair, focused monitoring, HTTP and capacity tests passed 58/58.
The complete local POD Node suite passed 856 tests: 847 passed, nine expected
environment-gated skips and zero failures. Whitespace checks were clean. Exact
PR head `6f11320cc1d45926de268b96482c91a467a546d1` passed:

- integration run
  [40277871386](https://github.com/wecreates/content-control/actions/runs/40277871386),
  job `121424396651`;
- production-container run
  [40277871337](https://github.com/wecreates/content-control/actions/runs/40277871337),
  job `121424396553`.

The base remained `819f75c8d74b0e9f14d75ce84c9c8dde8581dd51` and the exact
tested head was squash-merged as
`59e3a70fede13e093088176090d7c1bd4daad2ad`.

Dependent [Money Factory PR 229](https://github.com/wecreates/Money-factory/pull/229)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`065200447cf1439572139163c19d1bf0f5b85bf5` passed run
[40278522776](https://github.com/wecreates/Money-factory/actions/runs/40278522776),
job `121426411966`, across review, evidence, recovery, KDP, rights and adapter
contract stages. Its base remained
`c96822a2c8153b11542bd0ea5ea66dbc733ebb82`; it merged as
`60409a0bc700d4b0886f86124e50f885fc19aa55`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`59e3a70fede13e093088176090d7c1bd4daad2ad` as deploy
`dep-dbfeul67bikc73c4s9dg`. Event `evt-dbfeul34qb4c73acqbo0` records the start,
`evt-dbfeul6bs3rs73cn7bfg` records `pipeline_minutes_exhausted`, and
`evt-dbfeul6gej5s73afjqd0` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This monitoring repair is merged code
plus hosted test evidence, not live database retention or restoration,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone
acceptance, live alert delivery/recovery drills, measured capacity, publication,
revenue or launch readiness. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, provider result or continuously running
self-hosted worker is claimed.
