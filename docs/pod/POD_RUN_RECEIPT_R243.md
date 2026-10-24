# POD run receipt r243 — archive parent durability identity

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`2f2b348fa7699904665236d3d5c7e37a25054656`; Money Factory initially started
from `d0b302a6e7a377f403e8bed0ce87b219a6ca173c`. Current POD completion,
implementation-status and free-deployment documents, the r242 receipt, open pull
requests, workflow results and the authorized existing Render service were
inspected. Existing open pull requests were unrelated drafts and none overlapped
this POD archive work. The previously failed database-administration path had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Both exporters held the newly created archive directory descriptor and fsynced
the original parent, but the final identity check covered only the archive inode.
A concurrent actor could replace the parent, move that same archive inode beneath
the replacement, and let the exporter return `EXPORTED` after flushing the old
parent rather than the parent containing the final directory entry. Both new
pre-fix regressions failed with `Missing expected rejection`; the focused run
reported 72 passes and two failures.

[Content Control PR 582](https://github.com/wecreates/content-control/pull/582)
retains the original parent device/inode when creating an archive and requires
both the archive and that parent to remain at the requested path through the
final flush boundary. Artifact-only and full-state exports now reject the
same-inode child move with `ARCHIVE_DIRECTORY_INVALID` rather than issuing a
durability receipt. The exact remote head was
`626a000e9cae0c5dd54aa1ffef69e920c6da0dd8`, and its remote tree
`9f4447277086cfe18c3d02ce4de85f69fc888e7a` exactly matched the tested local
tree.

The repaired focused archive suites passed 74/74. The broad dependency-free POD
Node suite passed 708/708; syntax and whitespace checks were clean. Exact-head
hosted [integration run 40143296592](https://github.com/wecreates/content-control/actions/runs/40143296592),
job 121019334644, and
[production-container run 40143296544](https://github.com/wecreates/content-control/actions/runs/40143296544),
job 121019334604, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 582 was merged as
`7f64a5e1312791eec4339cbde0e9de1b45c72ee2`.

[Money Factory PR 199](https://github.com/wecreates/Money-factory/pull/199)
pinned its cross-repository production gate to that immutable Content Control
merge while retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Money Factory main advanced concurrently to
`56900ae4127c581ddcb6a863bd61725b31f2e257` with a free-monitor receipt; the pin
branch was rebuilt on that head before publication, preserving the concurrent
files. Its exact remote head was
`72f95eb7326b4421dafc9937220a4b3db72da96b`, and remote tree
`36c0a3145b6e92ceb27e2c9efcfc8b1cb9582e44` matched the locally validated
tree. Exact-head hosted
[run 40143829795](https://github.com/wecreates/Money-factory/actions/runs/40143829795),
job 121020906832, passed all pinned review, recovery, rights, template,
editorial, package-contract, Node, Python and bridge stages. PR 199 was merged
as `d00ffee35fcefaac68f5afb0f21720c4e775fc82`.

## Deployment and acceptance state

Render automatically attempted the Content Control merge as deploy
`dep-dbek46jbc2fs738bms1g`, but failed before application build at
2026-10-24T23:41:15Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbek46pr5j6c73ftbf10`,
`pipeline_minutes_exhausted` `evt-dbek46rphbkc739rmh60`, and failed deploy end
`evt-dbek46o4cbqc73dg5t80`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one archive-export
durability race only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
financial reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
