# POD run receipt r241 — rollback-safe restore roots

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`93ce6cf42c22c41ac7057b908ea6b22517690262`; Money Factory started from
`31a6070490028ede24b09da9d20e373b0342083d`. Current POD completion,
implementation-status and free-deployment documents, the r240 receipt, open pull
requests, workflow results and the authorized existing Render service were
inspected. Existing open pull requests were unrelated drafts and none overlapped
this POD recovery work. The previously failed database-administration path had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Artifact-only and full-state restores authenticated every archive byte through a
held directory descriptor, but could still commit and return `RESTORED` after the
requested root pathname was renamed and replaced. Both new pre-fix regressions
failed with `Missing expected rejection`; the focused run reported 68 passes and
two failures.

[Content Control PR 578](https://github.com/wecreates/content-control/pull/578)
now rechecks the requested root's device/inode identity inside the database
transaction after authenticated reads and before commit. Artifact inserts and
full-state inserts therefore roll back if the pathname no longer names the opened
archive; state safety mutations are not applied to a rejected restore. The exact
remote head was `e458ac327fb8aae1a74825c13e6885c338b32051`, and its remote tree
`e44edb2b8da1f2c85e0076abac8224cf8e8b1a6b` exactly matched the tested
local tree.

The repaired focused archive suites passed 70/70. The broad dependency-free POD
Node suite passed 704 tests with two expected environment-gated skips and zero
failures. Syntax, YAML and whitespace checks were clean. Exact-head hosted
[integration run 40135325009](https://github.com/wecreates/content-control/actions/runs/40135325009),
job 120995519193, and
[production-container run 40135325020](https://github.com/wecreates/content-control/actions/runs/40135325020),
job 120995519381, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 578 was merged as
`cd3e842a4e0250a6615a23dc4f895a74aafb9fb7`.

[Money Factory PR 197](https://github.com/wecreates/Money-factory/pull/197)
pinned its cross-repository production gate to that immutable Content Control
merge while retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Its exact remote head was
`4bece8aa295c7d78b0c11acb8b81c99d921ec899`, and remote tree
`64f53a1c79cf8c079c637916afe6a4201723fa35` matched the locally validated
tree. Exact-head hosted
[run 40135790002](https://github.com/wecreates/Money-factory/actions/runs/40135790002),
job 120996902388, passed all pinned review, recovery, rights, template,
editorial, package-contract and bridge stages. PR 197 was merged as
`47e38fecde5409771caf38253319ce0e2cbada97`.

## Deployment and acceptance state

Render automatically attempted the Content Control merge as deploy
`dep-dbeieos9v7es73cio3ug`, but failed before application build at
2026-10-24T21:47:16Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbeiep6gej5s739t39fg`,
`pipeline_minutes_exhausted` `evt-dbeiep1r5j6c73fsdjng`, and failed deploy end
`evt-dbeiep04cbqc73df7c5g`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one transactional
restore race only; merged code and hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
