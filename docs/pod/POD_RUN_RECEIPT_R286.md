# POD run receipt r286 — guarded reads across connection waits

Date: 2026-10-26

## Scope and observed heads

- Content Control work began from `5e8e10e101e6480e37c999501ee4d07bfd0fa79e`.
- Money Factory's current main before its pin update was
  `6d9bf3ca5bd8f45b3b7320e60958e75ee6c509b3`.
- Concurrent Content Control commits `669e4369`, `5e8e10e1` and `ea6ae74d`
  touched only media/watchdog state and were preserved.
- The completion checklist still leaves all 24 live acceptance areas open.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained false. Etsy was
  excluded. No marketplace publication or external provider write was made.

## Storage-retention repair

[Content Control PR 705](https://github.com/wecreates/content-control/pull/705)
merged as `14cfd49a4dce56df9bf3ed003005fc30c12e166d`. It adds a
guarded `PodDB.read` operation that validates storage lifetime before acquiring
a pooled connection, again immediately after acquisition and again after SQL.
Direct release-ready, operations, review-package, review-artifact, artifact,
financial-total and outbox-selection reads now use that contract. A regression
exercises every production read path and proves that expiry while waiting for a
connection releases the acquired client without issuing SQL.

Local verification included 41 focused artifact/storage tests, 68 focused
release/review/operations tests, 42 HTTP response tests, syntax and diff checks,
and the complete 875-test POD Node suite. The first hosted integration run
`40386074864` correctly exposed a PostgreSQL artifact helper that lacked the
new fixture contract; it was repaired before merge. Hosted integration run
`40386452605` and production-container run `40386452447` then completed
successfully on the reviewed head `7341083d`.

## Money Factory authority propagation

[Money Factory PR 241](https://github.com/wecreates/Money-factory/pull/241)
merged as `194c60b4401b47fae50f9eb72b47be5f78f0ed03`. It pins the
cross-repository POD workflow to Content Control merge `14cfd49a` and updates
the disposable PostgreSQL roundtrip facade to implement the guarded-read
contract. Local verification passed 116 Node contracts with the PostgreSQL-only
case skipped because this runtime has no local PostgreSQL service, plus 81/81
Python production/review tests. The first hosted run `40387870794` exercised
that PostgreSQL case and exposed the incomplete facade; after repair, hosted
cross-repository run `40388454784` completed successfully, including the real
PostgreSQL roundtrip and all pinned Content Control checks.

## Render deployment evidence

The authorized free Render service attempted Content Control merge `14cfd49a`
as deploy `dep-dbfqlnmq1p3s738b84q0`. Event
`evt-dbfqlnts22ds738p1kg0` records pipeline-minutes exhaustion before a build
could run, and event `evt-dbfqlnsqcggc73c4pou0` records the deploy ending
failed. This is not live deployment acceptance and does not establish a
code-level build failure. No redundant manual deploy was started.

## Remaining boundaries

There was no credible changed database-administration access path, so the
previously failed connector/browser database action was not repeated. Live
database migration, durable live recovery, successful Render deployment,
external account/grant/rights evidence, authorized live market observations,
platform previews, independent human review, live remediation, measured live
capacity, financial reconciliation, end-to-end acceptance and controlled
launch remain open. Existing code and hosted test success are not treated as
live acceptance. No approval, clearance, marketplace result, revenue,
completion or continuously running self-hosted worker is claimed.
