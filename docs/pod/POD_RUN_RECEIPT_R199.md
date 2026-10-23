# POD run receipt r199 — anchored KDP package input verification

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `7b038c45da9dbedc2d1f6937fc2a6e44bcfa003d`
- Money Factory: `67e605a13dba8270a2e7823df7ec7c11dc9e8bb1`
- The Money Factory head included a concurrent free-monitor cadence update; this
  work based its dependent pin on that newer head and preserved it.
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main`
  with automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 490](https://github.com/wecreates/content-control/pull/490)
merged exact tested head `ed9568c72d212511d3e5e9330d5fea6b4805f4d3`
as `a5aa21a7775236982f77ec2e01d4bcecf0d1b39b`. KDP interior
assembly now opens and identity-binds the package directory before reading its
manifest or declared cover files. It snapshots and strictly parses the manifest
through the held directory descriptor, validates the package hash and every
declared file digest through the verified Linux `/proc/self/fd` alias, and only
then continues print-option checks and private staging. An unavailable package
descriptor alias fails closed with `BOOK_PACKAGE_PATH_UNAVAILABLE`; private
stage alias failure remains `BOOK_STAGING_PATH_UNAVAILABLE`.

Regression-first verification reproduced the prior gap: a package replacement
injected exactly when the directory was opened reused the original manifest,
substituted declared cover bytes, and still assembled before the repair. The
new regression joins acquisition, pre-staging, stage-creation and post-commit
swap coverage. Local verification after the repair included:

- recovery, KDP book-boundary and binary-I/O suites: 146/146 passed;
- broad POD Python discovery: 249 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- [integration run 39907832360](https://github.com/wecreates/content-control/actions/runs/39907832360),
  job `120263739056`: passed on the exact PR head;
- [production-container run 39907832316](https://github.com/wecreates/content-control/actions/runs/39907832316),
  job `120263738806`: passed on the exact PR head, including the real Linux
  descriptor-alias path in the production image and publication-disabled
  startup.

[Money Factory PR 153](https://github.com/wecreates/Money-factory/pull/153)
pinned cross-repository verification to Content Control
`a5aa21a7775236982f77ec2e01d4bcecf0d1b39b`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`030773df12a4639aed9fb5e7875eb4ee9a4ab40a` passed
[cross-repository run 39908412976](https://github.com/wecreates/Money-factory/actions/runs/39908412976),
job `120265559796`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `212ffe6a4f313019f59a41bfe8584148b07321fd`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`a5aa21a7775236982f77ec2e01d4bcecf0d1b39b` as deployment
`dep-dbdfcsc9v7es73dtgf6g`. Deploy-start event
`evt-dbdfcs98a10s738dm5qg` bound the exact merge at
`2026-10-23T05:53:53.358046Z`; event `evt-dbdfcs8l0d7c739ah3rg`
recorded `pipeline_minutes_exhausted` at
`2026-10-23T05:53:53.384448Z`; and deploy-end event
`evt-dbdfcscii53c73dr96t0` recorded failure at
`2026-10-23T05:53:53.745564Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one KDP package-input
identity and declared-file verification boundary only; merged code and hosted
CI are not live acceptance. Production restricted database/schema/migrations,
retained recovery evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real accounts/sources/rights/templates/
reviewers, authorized five-platform adapters, actual economics/reconciliation,
owner-phone acceptance, monitoring/recovery drills, measured capacity and a
real authorized end-to-end launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
