# POD run receipt r228 — JSON outbox acknowledgement media type

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`c1e838dcec20cf009b9b123dd44da567cd3c6d4b`. Money Factory was initially
inspected at `e7e7a3f5cb4c97c2c6f3f1f58e36d89a82b05f82`; an unrelated concurrent
free-monitor cadence commit advanced its main to
`5798802feaec7cae3b617091251cb51838eb8773` before the dependent pin merged.
Current POD completion, implementation-status and free-deployment documents,
open pull requests, exact-head workflow results and the authorized existing
Render service were inspected. Open pull requests were unrelated draft
media/offline work and did not overlap this repair. The previously failed
database-administration path had no credible access change and was not retried.
No resource, credential, account, network rule or marketplace state was created
or changed.

## Repair and regression evidence

Content Control's outbox accepted the exact acknowledgement JSON object from a
successful response even when the response was labeled `text/html`,
`application/problem+json`, or had no media type. That allowed a confused or
mislabeled receiver response to mark a durable event delivered. The pre-fix
regression reproduced the fault as a missing expected rejection.

[Content Control PR 553](https://github.com/wecreates/content-control/pull/553)
now requires the response's exact base media type to be `application/json`
before accepting its exact one-member acknowledgement object. Media type
matching is case-insensitive and permits parameters such as `charset=utf-8`;
HTML, problem JSON and missing labels fail closed with
`OUTBOX_ACK_MEDIA_TYPE_INVALID`, leaving the event pending for the existing
bounded retry and idempotent receiver path. The exact remote PR head was
`f36d729cf9a866b7462005d27e24ed241dda9005`. Production blobs were
`8e7aeb2cea8509c656ba532b3e18d93d5937312b` and
`7d1a7825a19834fb379b04eb1e15dbaaabf7ace6`; documentation blob was
`61a75a3f4d5a901f65e06227d65e889f502a3d35`; regression/runtime/PostgreSQL
test blobs were `0862a590f39abcfb78d7f818f1698a201555a69b`,
`06fdaf3e2d5dd08a8026eaba5c60c9e31473d804`, and
`27d2b2ed7f0a9ee3f539529fd76c57ad28cb020c`.

The focused bridge/outbox suites passed 60/60. The dependency-free local POD
Node suite passed 688 tests with two expected skips and zero failures. The
unfiltered local command also demonstrated the runner limitation honestly: six
PostgreSQL/Express test entrypoints could not import packages absent from this
scratch checkout, so no local pass was claimed for them. Exact-head hosted runs
[40081546077](https://github.com/wecreates/content-control/actions/runs/40081546077),
job 120835972147, and
[40081546148](https://github.com/wecreates/content-control/actions/runs/40081546148),
job 120835972901, both passed. They supplied the pinned dependencies,
disposable PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 553 was squash-merged
as `e402c55fb422e425edc9328ecb1514c801e4e518`.

[Money Factory PR 183](https://github.com/wecreates/Money-factory/pull/183)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`8045e2d6b990f3f46d98f201174a1b4e3a3aec00`, with workflow blob
`b83fd084d322786dbb8c9487d232b1d124b9c1c8`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. Exact-head hosted run
[40082039588](https://github.com/wecreates/Money-factory/actions/runs/40082039588),
job 120837409793, passed all steps, including the disposable PostgreSQL round
trip and the pinned review, recovery, rights, template, editorial, Node, Python
and package contract gates. PR 183 was squash-merged after the unrelated cadence
commit as `516ea716a4a54e4da77b09285b315f2c3ee3c1b4`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe7jqu7bikc73aukod0`, but failed before build at
2026-10-24T09:27:07Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe7jqrsp5es73btarig`,
`pipeline_minutes_exhausted` `evt-dbe7jqr4qb4c739i3nng`, and failed deploy end
`evt-dbe7jr1r5j6c73fk7bkg`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one sender/receiver
media-type boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
