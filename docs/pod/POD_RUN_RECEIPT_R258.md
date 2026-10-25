# POD run receipt r258 — read-list retention cutoff

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`55645c24f98c65b1d7bfae6f0abf3000f7625c57`; Money Factory started from
`9f580b3e44228ac1f79759311e32d4ca65ae1201`. The Content Control head included
concurrent zero-credit QA proof and accepted-candidate rollback-ledger updates;
both were preserved. The only open Content Control pull request was an unrelated
draft video candidate, and Money Factory had no open pull request. Current POD
acceptance, status and free-deployment evidence, workflow results and the
authorized Render service were inspected. The failed database-administration
route had no changed access path and was not retried. No resource, credential,
account, network rule or marketplace state changed.

## Repair and regression evidence

The review-package path already rechecked the configured storage lifetime after
its database wait. The release-ready list and authenticated owner operations
job list checked the lifetime only before their queries. A read crossing the
retention safety cutoff while waiting could therefore still return rows. This
was a fail-closed storage boundary gap, not evidence that any live rows were
returned after expiry.

[Content Control PR 620](https://github.com/wecreates/content-control/pull/620)
adds the post-query lifetime checks and documents the contract. The two
regressions advance the configured lifetime during each database wait. Both
failed on the baseline because the reads resolved instead of rejecting. After
repair, focused storage/health/dashboard suites passed 39/39. The complete
local POD Node suite ran 810 tests: 801 passed, nine intentional
environment-gated tests skipped and zero failed. The local production
end-to-end command retained its one intentional environment skip. Syntax,
workflow control, four free-review guards and diff checks passed.

Exact head `16a38d0f79cfb0177c3874de203bd617528a6ae7`, tree
`91f46e256ff737e0866ab920cbd10683d1f1a917`, passed
[integration run 40204158026](https://github.com/wecreates/content-control/actions/runs/40204158026),
job `121201406643`, and
[container run 40204157968](https://github.com/wecreates/content-control/actions/runs/40204157968),
job `121201406213`. PR 620 merged as
`cb4a7ebb2b7dda7760d5fd2a88d975785252845c` with the same exact tree.

[Money Factory PR 214](https://github.com/wecreates/Money-factory/pull/214)
pins that immutable merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local
verification passed 116 of 117 Node tests with one intentional PostgreSQL
environment skip and passed 81/81 Python tests. Exact head
`272e7d9a1b68a890d81f79b2c098ccb99bfb57f2`, tree
`d99ab6ebc76bce3c4fea70fb90629d18e19d2d2f`, passed
[cross-repository run 40204778020](https://github.com/wecreates/Money-factory/actions/runs/40204778020),
job `121203295701`. PR 214 merged as
`a108e9a62392a5c6fe7b9453e6a18019649b49c2` with the same exact tree and both
publication flags false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`cb4a7ebb2b7dda7760d5fd2a88d975785252845c` as deploy
`dep-dbf1hne7bikc73bn81eg`. Deploy-start event
`evt-dbf1hnegej5s73a6h8q0`, `pipeline_minutes_exhausted` event
`evt-dbf1hnb8vfls738uqqng` and failed deploy event
`evt-dbf1hncegpmc73bt0rm0` show that the application build did not run.
Hosted behavior remains unverified. No manual retry, purchase, plan/cache
change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes two
read-list retention boundaries only; code and hosted CI are not live storage,
database, marketplace or deployment acceptance. Restricted production
database/schema/migrations, retained recovery, deployed hybrid dependencies,
mounted Money Factory authority and current grants/revocation, real
accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
