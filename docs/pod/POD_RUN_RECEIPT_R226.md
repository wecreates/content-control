# POD run receipt r226 — bounded outbox request transport

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`4bc29d66571eec04e4ebeae885be3ee7a0d2c79c`; Money Factory started from
`884f2876311afdc3f75683ebc9776e3a1c474881`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. No open POD pull request overlapped this repair. The previously
failed database-administration path had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state
was created or changed.

## Repair and regression evidence

The Money Factory event inbox already bounded decoded signed payloads at
262,144 UTF-8 bytes and outer request bodies at 524,288 bytes, but Content
Control's outbox sender did not enforce either receiver contract before
dispatch. An oversized durable event could therefore be signed and sent even
though the configured authority could only reject it, wasting bounded transport
capacity on every retry. The pre-fix regression reproduced the fault: 19 of 20
focused tests passed, while the oversized event reached the transport instead
of failing locally.

[Content Control PR 549](https://github.com/wecreates/content-control/pull/549)
now checks the exact decoded payload before HMAC work, serializes the outer body
once, checks that exact wire representation, and sends the same checked bytes.
It does not truncate or mark a rejected event delivered; existing bounded
retry/pagination semantics remain intact. The exact remote PR head was
`ebbc1a6754b8065b1db049fad53fce66ab5d5a8e`; production blob was
`506b250dfcf85e534e49b53242c057fad754a2f8`, documentation blob was
`37ec458599b53688759be61d0f6c4a783f8ea8b6`, and regression blob was
`2ee93df720774dbc045303fe37ece1f3f42c0be0`.

The focused suite passed all 20 tests after repair. The dependency-free local
POD Node suite passed 686 tests with two expected skips and zero failures; all
93 local POD book-bounds Python tests passed. Exact-head hosted runs
[40073537138](https://github.com/wecreates/content-control/actions/runs/40073537138),
job 120811927158, and
[40073537139](https://github.com/wecreates/content-control/actions/runs/40073537139),
job 120811926974, both passed, including the production-image PostgreSQL,
rendering, review-path and disabled-publication startup gates. PR 549 was
squash-merged as `0a4eb53e3b1d10d9c50cce45d0dac29ebc5842fb`.

[Money Factory PR 181](https://github.com/wecreates/Money-factory/pull/181)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`3ec7081c42fee16705014446dcbe6902a6ddd5f1`, with workflow blob
`4417d7d1ee3dbffc03a12057b0f5b1e340ac492e`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. Exact-head hosted run
[40073958915](https://github.com/wecreates/Money-factory/actions/runs/40073958915),
job 120813227726, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, template, editorial, Node, Python and package
contract gates. PR 181 was squash-merged as
`2e26714d34048783e46217806870b29fa5a4b847`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe5plmq1p3s73fabg0g`, but failed before build at
2026-10-24T07:23:03Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe5plm4uq4c739obnmg`,
`pipeline_minutes_exhausted` `evt-dbe5plgk84hc73ei6h10`, and failed deploy end
`evt-dbe5plok84hc73ei6h20`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one sender/receiver
transport-contract boundary only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform adapters,
actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
