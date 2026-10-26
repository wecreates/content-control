# POD run receipt r268 — storage-backed evidence-writer checkpoints

Date: 2026-10-26

## Reconstructed state and scope

Content Control started from current main
`40c16fd37b033d8a15959a05071c88bd07bd65d7`; Money Factory started from
`1f169d5acb17de472e98b33f2ac6a924fc488e85`. The completion checklist,
implementation status, free-deployment guide, open pull requests, workflow
results and the authorized Render service were inspected. No open POD pull
request duplicated this repair. The previously failed database-administration
route had no credible changed access path and was not retried. No paid resource,
credential, account, network rule or marketplace state changed.

## Repair and regression evidence

Market observations, financial events and listing readbacks already ran in
transactions whose final pre-commit storage-retention check rolled back an
expired operation. They did not, however, recheck retention after each earlier
SQL wait. Expiry during evidence lookup or a conflicting insert could therefore
allow unnecessary later queries or mutations before the final rollback.

Six regressions reproduced these gaps on current main: all six failed before
the repair. Content Control PR 651 adds an explicit `PodDB.active()` checkpoint
after every evidence lookup, insert, conflict/readback query and listing-state
mutation in these three writers. A crossed cutoff now stops before the next SQL
statement, and the transaction's existing final check remains in place.

The focused affected suite passed 97/97 after the repair. The full local POD
Node suite passed 836 tests with nine intentional environment-gated skips and
zero failures (845 total). Syntax and whitespace checks passed. Initial hosted
integration run 40250822769, job 121342112356, exposed a test-only timezone
wrapper that delegated to the real `PodDB.tx()` but did not forward `active()`;
the wrapper was corrected without weakening the production checkpoint.

The final exact head `97f07c3755e1422e4cfae5b3d248d013f8e3830e`
passed integration run 40250994605, job 121342627912, and production-container
run 40250994595, job 121342817926. Those runs covered live PostgreSQL,
the pinned Python/OpenCV runtime, Node contracts, Python rendering and QA,
real print-package generation, durable review flow and publication-disabled
startup. PR 651 was confirmed ahead of unchanged main with a clean merge and
was squash-merged as `635aeab95b2107126b52a55b43505cb17a5deffe`.

Money Factory PR 224 changed only its immutable Content Control checkout to
that merge. Local dependent verification passed 116 Node tests with one
intentional PostgreSQL-environment skip and 81 Python tests. Exact-head
cross-repository run 40251661544, job 121344700394, passed every step. After an
unchanged-base and clean-mergeability check, head
`523c74880167cbb32755128b453bebca8f0120af` was squash-merged as
`7d4662e57abdf5b0f102351017bb37a7712bc06e`. The workflow retained
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`635aeab95b2107126b52a55b43505cb17a5deffe` as deployment
`dep-dbfa9b5g1s2s73a58otg`. Deploy-start event
`evt-dbfa9b38vfls73958e1g`, `pipeline_minutes_exhausted` event
`evt-dbfa9b4egpmc73c3g25g` and failed deploy event
`evt-dbfa9b0s76nc739nvf40` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes one prompt
storage-expiry boundary; code and hosted CI are not live storage, database,
marketplace, reconciliation or deployment acceptance. Restricted production
database/schema/migrations, retained off-host recovery, deployed hybrid
dependencies, mounted Money Factory authority and current grants/revocation,
real accounts/sources/rights/templates/reviewers, authorized KDP, Redbubble,
TeePublic, Zazzle and Spreadshirt adapters, actual economics and provider
reconciliation, owner-phone acceptance, monitoring/recovery drills, measured
capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbfaccss728c73dbiiq0` verifies that exact merge
`f121a516b0fc309a7f40bc30f82a76f750d1c0b9` was ignored rather than deployed.
