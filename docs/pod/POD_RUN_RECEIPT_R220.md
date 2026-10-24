# POD run receipt r220 — authenticated event shape boundary

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`a54478e381aa35758371550fba3e50dd13db9fdb`; Money Factory started from
`f8bf37c9d37cc9a31e042dae638c90cb1947fc7f`. Current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
No open pull request overlapped this POD receiver repair. The previously failed
database-administration path had no credible access change and was not retried.
No resource, credential, account, network rule or marketplace state was created
or changed.

## Repair and regression evidence

Money Factory's authenticated Content Control event receiver verified the HMAC,
audience, freshness and event ID, but then retained any signed event whose kind
started with `pod.`. A correctly signed envelope could therefore add extra
private fields, omit actual outbox fields, use malformed job scope or creation
time, or substitute an array for the event payload before database acquisition.
The new regression reproduced the extra-field case as an unexpected database
connection.

[Money Factory PR 175](https://github.com/wecreates/Money-factory/pull/175)
now admits only the exact signed Content Control outbox envelope and five-field
event record. Event IDs and non-null job IDs must be UUIDs, kinds must be bounded
lowercase `pod.*` identifiers, payloads must be JSON objects, and `created_at`
must be a canonical UTC millisecond timestamp. Extra/missing fields and malformed
scope fail before a database connection. The receiver remains observation-only
and cannot update readiness or verified revenue.

The exact final remote head
`78b89f4190df55c026238f8c7a7b2b912cb727a4` had tree
`eac427036369a00a3c1d99b308f479ca2133491e`; the production receiver blob was
`56bc3d8d14bd0f134813efa2d8894fea859c881a` and the dedicated regression blob
was `658b2dcd456a144d449bf033c3b465131d28e7e3`.

The full local Node POD suite passed 109 tests with one expected PostgreSQL-only
skip and zero failures using the pinned Content Control checkout. The full local
Money Factory Python POD suite passed 81 tests. The first hosted run
[40048468050](https://github.com/wecreates/Money-factory/actions/runs/40048468050)
correctly exposed a stale real-PostgreSQL fixture expectation after 109 other
Node tests passed; this result was not waived. The fixture was bound to the same
canonical five-field event used for signing and hashing.

Final exact-head hosted run
[40048812895](https://github.com/wecreates/Money-factory/actions/runs/40048812895),
job 120736585650, passed the disposable PostgreSQL round trip, full Money Factory
Node/Python suites and all pinned Content Control review, recovery, template,
rights, KDP/editorial, QA and package-contract gates. PR 175 was squash-merged as
`a61f14d55619b810419847d8b3b7b992ff52363d` after remote Money Factory main
remained at the reviewed base.

## Render and acceptance state

This was a Money Factory-only runtime contract repair and did not change the
Content Control Render service. The authorized service remained an unsuspended
free-plan Docker web service on `main`, one instance, commit-triggered auto-deploy
and `/health`. Its latest event was `commit_ignored` for the prior r219 receipt
commit `a54478e381aa35758371550fba3e50dd13db9fdb`. The latest application deploy
attempt remained `dep-dbdv0mm1egvs73fb4b80` for Content Control
`08469319dab2e543dc777554de994220f028e186`; Render recorded
`pipeline_minutes_exhausted` and failed it before a build. No retry, purchase,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authenticated
event-ingress boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
