# POD run receipt r238 — exact nested outbox JSON values

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`63b1138b928991126443e5c962527de5ab2f1ea5`; Money Factory started from
`b352ed0730888684cf94de84b52b47181a0eb896`. Current POD completion,
implementation-status and free-deployment documents, the r237 receipt, open
pull requests, exact-head workflow results and the authorized existing Render
service were inspected. No open pull request overlapped the POD outbox repair;
the matching OpenFilm draft explicitly excluded POD changes. The previously
failed database-administration path had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state
was created or changed.

## Repair and regression evidence

The outbox recursively checked the types of a durable event payload by reading
nested values directly before serializing and signing the event. Accessor-backed
objects and proxies could therefore execute during validation and again during
serialization, allowing the validated and authenticated observations to differ.
Negative zero was silently normalized to zero. Array accessors, custom
prototypes and extra string or symbol members could also be read, normalized or
omitted inconsistently. The focused pre-fix run passed 24 tests and failed the
new regression with `Missing expected rejection`.

[Content Control PR 572](https://github.com/wecreates/content-control/pull/572)
now accepts only exact inert JSON values throughout nested outbox payloads.
Proxies and accessors are rejected without invoking traps or getters; custom
prototypes, sparse or extended arrays, symbol members and negative zero also
fail before signing or network access. Accepted values are read only from data
descriptors. Frozen ordinary JSON objects and arrays remain compatible. The
exact remote PR head was
`950b6318797da74effbf495689286ff485faa23f`. Remote blobs matched the tested
local contents: `e40e52ab0427f7eaa6f671920774292fb496427e` for
`outbox.mjs`, `9773208189e58022b16f9107570e12b6e23c584c` for the
regression and `a9cb57beac3749162e6118e9061c342461b90db6` for
`OUTBOX.md`.

The final focused outbox suite passed 25/25. The broad dependency-free local
POD Node suite reached 700 tests with 698 passed, two expected skips and zero
failures. Syntax and whitespace checks were clean. Exact-head hosted runs
[40125134345](https://github.com/wecreates/content-control/actions/runs/40125134345),
job 120964824191, and
[40125134349](https://github.com/wecreates/content-control/actions/runs/40125134349),
job 120964824276, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 572 was squash-merged
as `ca68e235df8426caf459a568503fffd76633489c`.

[Money Factory PR 193](https://github.com/wecreates/Money-factory/pull/193)
pinned its cross-repository production gate to that immutable Content Control
merge and added the outbox regression suite to its selected contracts. Its
exact remote head was `383acdfe52841d6bea37a639deda6cc5fe4278ed`, with
workflow blob `cbe5411a5b9149b5a08b8dad66c1134b12a41210`. Exact-head
hosted run
[40125735447](https://github.com/wecreates/Money-factory/actions/runs/40125735447),
job 120966617009, passed all pinned review, recovery, rights, template,
editorial, outbox, package-contract and disposable-PostgreSQL stages. PR 193
was squash-merged as `4cbefde8b9ec6e1c04ecac3e4ece155a43dfc666`.

## Deployment and acceptance state

Render auto-deploy observed the Content Control application merge as deploy
`dep-dbegf0mq1p3s73e8dqtg`, but failed before build at
2026-10-24T19:31:14Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbegf0ga6lpc73e8cea0`,
`pipeline_minutes_exhausted` `evt-dbegf0g4cbqc73ddql7g`, and failed deploy end
`evt-dbegf0pr5j6c73fr17n0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one internal
outbox serialization/authentication ambiguity only; merged code and hosted CI
are not live acceptance. Production restricted database/schema/migrations,
retained recovery evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
