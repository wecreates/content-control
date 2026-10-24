# POD run receipt r239 — descriptor-bound archive paths

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`364c90c77a25d09000e05378db7fa6c7e3e1e53e`; Money Factory started from
`4cbefde8b9ec6e1c04ecac3e4ece155a43dfc666`. Current POD completion,
implementation-status and free-deployment documents, the r238 receipt, open
pull requests, exact-head workflow results and the authorized existing Render
service were inspected. No open pull request overlapped this archive repair.
The previously failed database-administration path had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Artifact-library and full-state exporters created a destination directory and
then addressed it repeatedly by pathname. A concurrent rename followed by a
replacement symlink could redirect encrypted objects and the final catalog to
another directory while the exporter still returned `EXPORTED`. The pre-fix
artifact regression failed with `Missing expected rejection`; the test file
reported 33 passes and one failure.

[Content Control PR 574](https://github.com/wecreates/content-control/pull/574)
binds directory creation, encrypted writes and durability flushes to held
parent and archive directory descriptors. It verifies that the requested
destination still names the opened inode before returning success. Archive
verification and restore now read every catalog and object through one held
directory descriptor. Artifact and state regressions prove a replacement
symlink cannot receive a catalog. Recovery documentation and directory-flush
and cancellation fixtures were updated for the descriptor-bound behavior.
The exact remote PR head was
`dc9d1efa1c364ea39dfd9e479b198dc30ba0c156`, and its remote tree
`f486c8219bd2b99bf678decd363d69433745b079` exactly matched the tested local
tree.

The focused artifact/state archive suites passed 66/66. The broad
dependency-free local POD Node suite reached 702 tests with 700 passed, two
expected skips and zero failures. Syntax and whitespace checks were clean.
Exact-head hosted runs
[40127473071](https://github.com/wecreates/content-control/actions/runs/40127473071),
job 120971873811, and
[40127473030](https://github.com/wecreates/content-control/actions/runs/40127473030),
job 120971873591, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 574 was merged as
`1a0b8b4dd03452240a4b10ff523e91fd62355e91`.

[Money Factory PR 195](https://github.com/wecreates/Money-factory/pull/195)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`1740f7a9336805ae9522d0d80c6920f3d3aa4a83`, and remote tree
`df44406b6aba7a2cc9bcd392ab0908557da4de11` exactly matched the tested local
tree. Exact-head hosted run
[40127946686](https://github.com/wecreates/Money-factory/actions/runs/40127946686),
job 120973296495, passed all pinned review, recovery, rights, template,
editorial, package-contract and disposable-PostgreSQL stages. PR 195 was
merged as `10e111c4a629854a6e8418eef0e58afb29f52e80`.

An initial publication attempt accidentally constructed a tree without its
base and exposed hundreds of unintended deletions in Money Factory PR 194.
It was detected from the PR file count before CI or merge, closed unmerged,
and its disposable automation branch was reset to the exact base. Corrected
PR 195 contained one insertion and one deletion in one workflow file.

## Deployment and acceptance state

Render auto-deploy observed the Content Control merge as deploy
`dep-dbegsujbc2fs7388ifi0`, but failed before build at
2026-10-24T20:00:59Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbegsujsp5es73c4f8c0`,
`pipeline_minutes_exhausted` `evt-dbegsuj4qb4c739p70kg`, and failed deploy end
`evt-dbegsuubs3rs73c3mrig`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one internal archive
path-identity race only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
