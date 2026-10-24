# POD run receipt r242 — post-commit restore identity

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`c74b9d2e0e4273912146bcc35077e717f7eee625`; Money Factory started from
`47e38fecde5409771caf38253319ce0e2cbada97`. Current POD completion,
implementation-status and free-deployment documents, the r241 receipt, open pull
requests, workflow results and the authorized existing Render service were
inspected. Existing open pull requests were unrelated drafts and none overlapped
this POD recovery work. The previously failed database-administration path had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Artifact-only and full-state restore transactions rechecked the requested archive
root before commit, but could still return `RESTORED` after a replacement during
commit. Both new pre-fix regressions failed with `Missing expected rejection`;
the focused run reported 70 passes and two failures.

[Content Control PR 580](https://github.com/wecreates/content-control/pull/580)
now rechecks the requested root's device/inode identity again after the database
transaction returns and before emitting a success receipt. A late replacement
therefore fails closed. Documentation and regressions explicitly preserve the
transactional boundary: committed artifacts, restored state and safety holds may
remain, so the rejection requires reconciliation rather than a blind retry. The
exact remote head was `4e73a9bd4692966b2193135754e04c431e72edcb`, and its
remote tree `ee9066717d3d779e633a639b0e863d5ac2407fa3` exactly matched the
tested local tree.

The repaired focused archive suites passed 72/72. The broad dependency-free POD
Node suite passed 706 tests with two expected environment-gated skips and zero
failures. Syntax and whitespace checks were clean. Exact-head hosted
[integration run 40141858246](https://github.com/wecreates/content-control/actions/runs/40141858246),
job 121015087140, and
[production-container run 40141858347](https://github.com/wecreates/content-control/actions/runs/40141858347),
job 121015087827, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 580 was merged as
`400cd2bebe4352b6e2336b888b86f56055855c4c`.

[Money Factory PR 198](https://github.com/wecreates/Money-factory/pull/198)
pinned its cross-repository production gate to that immutable Content Control
merge while retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Its exact remote head was
`b6d94cfb823513b499bfe24f5aa0987918a8aac5`, and remote tree
`25bc1b9ec0b9e2d22e60788a544b9a65b5bc2027` matched the locally validated
tree. Exact-head hosted
[run 40142406824](https://github.com/wecreates/Money-factory/actions/runs/40142406824),
job 121016696215, passed all pinned review, recovery, rights, template,
editorial, package-contract and bridge stages. PR 198 was merged as
`d0b302a6e7a377f403e8bed0ce87b219a6ca173c`.

## Deployment and acceptance state

Render automatically attempted the Content Control merge as deploy
`dep-dbejqip5efls73b4irf0`, but failed before application build at
2026-10-24T23:20:44Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbejqj4egpmc73bkcc9g`,
`pipeline_minutes_exhausted` `evt-dbejqj0a6lpc73eaimn0`, and failed deploy end
`evt-dbejqj4egpmc73bkccb0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one post-commit restore
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
