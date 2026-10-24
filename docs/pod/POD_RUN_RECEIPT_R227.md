# POD run receipt r227 — exact outbox acknowledgement contract

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`3bdc718226e24ebc59721c110c84fcf2163dfc76`; Money Factory started from
`2e26714d34048783e46217806870b29fa5a4b847`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. Open pull requests were unrelated draft media/offline work and did
not overlap this repair. The previously failed database-administration path had
no credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Content Control's outbox accepted any successful JSON response containing the
matching `accepted_event_id`, even when the response also said
`status: "rejected"`, included an error, or carried other private fields. That
contradicted the existing exact-acknowledgement contract and could mark a durable
event delivered after a mixed or confused response. The pre-fix regression
reproduced the fault: the matching-ID plus rejected-status response wrote the
delivered marker instead of raising `OUTBOX_ACK_INVALID`.

[Content Control PR 551](https://github.com/wecreates/content-control/pull/551)
now requires the receiver's exact one-member JSON object,
`{"accepted_event_id":"<event UUID>"}`, before starting the delivered-marker
transaction. Additional status, error or private members fail closed; the event
stays pending for the existing bounded retry and idempotent receiver path. The
exact remote PR head was
`5d7d4d778f819a2346f0ffd5398f9c712ce90365`; production blob was
`da557dfd3675c64c0b91819a69f1172088a2059a`, documentation blob was
`676ac943a9e69bc8ac3e0835dc3e9ecad1a27d90`, and regression blob was
`1e847fb79eb6a05624505b636f855fa04915df33`.

The focused bridge/outbox suites passed 59/59. The dependency-free local POD
Node suite passed 687 tests with two expected skips and zero failures. The
unfiltered local command also demonstrated the runner limitation honestly: six
PostgreSQL/Express test entrypoints could not import packages absent from this
scratch checkout, so no local pass was claimed for them. Exact-head hosted runs
[40077881574](https://github.com/wecreates/content-control/actions/runs/40077881574),
job 120825087172, and
[40077881718](https://github.com/wecreates/content-control/actions/runs/40077881718),
job 120825087621, both passed. They supplied the pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 551 was squash-merged
as `e32b7912d410efe2a7dd41c7dc563157dfbed59f`.

[Money Factory PR 182](https://github.com/wecreates/Money-factory/pull/182)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`e9c1171bbb0968e2c2658f2bd12343d0d909ad6c`, with workflow blob
`10f8a894d3728e70c4c47b0462c84beb3f3aa1f4`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. Exact-head hosted run
[40078401855](https://github.com/wecreates/Money-factory/actions/runs/40078401855),
job 120826623624, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, template, editorial, Node, Python and package
contract gates. PR 182 was squash-merged as
`e7e7a3f5cb4c97c2c6f3f1f58e36d89a82b05f82`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe6pheq1p3s73du7dj0`, but failed before build at
2026-10-24T08:31:02Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe6phb4qb4c739hg1n0`,
`pipeline_minutes_exhausted` `evt-dbe6ph9r5j6c73fjk7mg`, and failed deploy end
`evt-dbe6phjphbkc739hv2n0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one sender/receiver
acknowledgement boundary only; merged code and hosted CI are not live
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
