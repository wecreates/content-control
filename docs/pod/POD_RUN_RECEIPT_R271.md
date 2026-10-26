# POD run receipt r271 — pre-query storage retention guard

Date: 2026-10-25 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`aeb149a07b869ec4ab576c0fd71c7bd76240ac9a`; Money Factory main was
`28abe8141e4ff94b3c28e239703958cdfc6abc6b`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and the authorized existing Render service were inspected before editing. Open
pull requests were unrelated to this POD transaction work, so no duplicate job
or PR was created.

The failed database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource or
service setting was changed.

## Implemented and merged

[Content Control PR 660](https://github.com/wecreates/content-control/pull/660)
closed a remaining gap in the shared `PodDB.tx` storage-retention boundary. The
r270 guard checked after every callback query, but a callback could await
non-database work, cross the retention cutoff, and issue one more SQL statement
before the post-query check rejected the transaction. This is material to archive
restoration, where authenticated file reads can occur between database statements.

The guarded transaction client now checks storage retention immediately before
and after every callback query. A cutoff crossed during archive reads or any
other non-database callback wait stops before the next business statement is
issued; opened transactions still roll back.

The new regression failed on reconstructed main: four existing checkpoint tests
passed, but the late query was issued after simulated expiry. It passed after the
repair. Focused transaction, archive, recovery, outbox, finance, publication and
core POD suites passed 182/182. The complete local POD Node suite passed 854
tests: 845 passed, nine expected environment-gated skips and zero failures.
Whitespace checks were clean. Exact PR head
`f4d65aaaae01cf1cd74bceae8788d1b6fee695ae` passed:

- integration run
  [40265830012](https://github.com/wecreates/content-control/actions/runs/40265830012),
  job `121387926788`;
- production-container run
  [40265830011](https://github.com/wecreates/content-control/actions/runs/40265830011),
  job `121387926598`.

The base remained `aeb149a07b869ec4ab576c0fd71c7bd76240ac9a` and the exact
tested head was cleanly squash-merged as
`211e3736f5fc06493d4105dcdc181bcd27431ca8`.

Dependent [Money Factory PR 227](https://github.com/wecreates/Money-factory/pull/227)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`7953acb8d7e462760a13d1449f55c98779167d7a` passed run
[40266466614](https://github.com/wecreates/Money-factory/actions/runs/40266466614),
job `121389856641`, across review, evidence, recovery, KDP, rights and adapter
contract stages. Its base remained
`28abe8141e4ff94b3c28e239703958cdfc6abc6b`; it merged as
`e4258eb1f638723a8c4e5bb5e4de43b6c450df6e`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`211e3736f5fc06493d4105dcdc181bcd27431ca8` as deploy
`dep-dbfctu4s728c73ddt940`. Event `evt-dbfctu3sp5es73cms4p0` records the start,
`evt-dbfctu0s76nc739pcrp0` records `pipeline_minutes_exhausted`, and
`evt-dbfctu3phbkc73abvnn0` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This transaction repair is merged code
plus hosted test evidence, not live database retention, deployment, real
account/source/rights/template/reviewer evidence, authorized marketplace
submission, actual economics/reconciliation, owner-phone acceptance, measured
capacity, publication, revenue or launch readiness. Both publication flags
remain false; Etsy remains excluded. No approval, clearance, provider result or
continuously running self-hosted worker is claimed.
