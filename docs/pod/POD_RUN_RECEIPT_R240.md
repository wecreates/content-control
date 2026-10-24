# POD run receipt r240 — stable offline verification roots

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`9dfd2212bf28bc4c46bc1d1f5c7b21296484b9e0`; Money Factory started from
`10e111c4a629854a6e8418eef0e58afb29f52e80`. Current POD completion,
implementation-status and free-deployment documents, the r239 receipt, open
pull requests, workflow results and the authorized existing Render service were
inspected. Existing open pull requests were unrelated drafts and none overlapped
this POD archive work. The previously failed database-administration path had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Artifact-library and full-state verification opened the requested archive root
once and read every authenticated file through that held descriptor. A
concurrent rename and replacement of the requested pathname therefore could not
redirect reads, but verification still returned `VERIFIED` even though that
pathname now named different storage. Both new pre-fix regressions failed with
`Missing expected rejection`; the combined test run reported 66 passes and two
failures.

[Content Control PR 576](https://github.com/wecreates/content-control/pull/576)
now requires the requested root pathname to retain the opened directory's
device/inode identity after every authenticated archive read and before an
offline verification receipt is returned. Artifact and state regressions rename
the opened root, replace it with a symlink, and require the fixed
`ARCHIVE_DIRECTORY_INVALID` failure instead of success. Recovery documentation
records the stronger receipt contract. Restore continues to consume one held,
authenticated source descriptor; publication and worker state are unchanged.
The exact remote PR head was
`84a3a576ac1eda789d40277c1e33570ff10bbca3`, and its remote tree
`0f5b982179f6fae5d2bfac114c17fc45d8e4cf34` exactly matched the tested local
tree.

The repaired focused artifact/state archive suites passed 68/68. The broad
dependency-free local POD Node suite reached 704 tests with 702 passed, two
expected skips and zero failures. Syntax and whitespace checks were clean.
Exact-head hosted runs
[40130106152](https://github.com/wecreates/content-control/actions/runs/40130106152),
job 120979804842, and
[40130106167](https://github.com/wecreates/content-control/actions/runs/40130106167),
job 120979804843, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 576 was merged as
`ee3a3d024bd9e4073c515c3cf8357f2ad7932f92`.

[Money Factory PR 196](https://github.com/wecreates/Money-factory/pull/196)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`ba447fa197a54239aa0969ab816a071f95c74751`, and remote tree
`f9d447a740dae93d4e215edb881f320fe06de148` exactly matched the tested local
tree. Exact-head hosted run
[40130647146](https://github.com/wecreates/Money-factory/actions/runs/40130647146),
job 120981440258, passed all pinned review, recovery, rights, template,
editorial, package-contract and disposable-PostgreSQL stages. PR 196 was
merged as `d6a6e77c7a872c8481a7df0203d3198fb01b1521`.

## Deployment and acceptance state

Render auto-deploy observed the Content Control merge as deploy
`dep-dbehe2m7bikc73b9h5p0`, but failed before build at
2026-10-24T20:37:31Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbehe2r4qb4c739pjbp0`,
`pipeline_minutes_exhausted` `evt-dbehe2ubs3rs73c433f0`, and failed deploy end
`evt-dbehe2o4cbqc73dehi40`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one offline archive
receipt race only; merged code and hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
