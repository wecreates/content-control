# POD run receipt r197 — KDP package-directory identity handoff

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `ac255e74061259ffe6f8b645645eaa64af0f11f6`
- Money Factory: `bd97797ec06577fafc9e66725c060da7dac0a5ee`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main` with
  automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 486](https://github.com/wecreates/content-control/pull/486)
merged exact tested head `9a1a07b80bbdcb807336c992eca2ee5facefe7a4`
as `475f0ad26e7d0f7caa325854a64523b4c9cd7686`. KDP interior
assembly now binds the caller-visible cover-package path to the directory
descriptor held during acquisition and checks the same identity after the final
manifest commit. An acquisition or successful-handoff swap fails with
`PACKAGE_REPLACED` instead of returning a false success. Concurrent replacement
paths remain untouched; a completed moved package retains its manifest, interior
PDF and receipt for manual recovery. Private staging cleanup is rooted at the
held package descriptor, so a moved package does not strand its staging directory
or redirect cleanup through the replacement path.

Regression-first verification reproduced the prior false-success result before
the repair. Two regressions cover acquisition and post-commit replacements. Local
verification after the repair included:

- recovery, KDP book-boundary and binary-I/O suites: 143/143 passed;
- broad POD Python discovery: 246 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- [integration run 39897250863](https://github.com/wecreates/content-control/actions/runs/39897250863),
  job `120230427887`: passed on the exact PR head, including the full Node,
  pinned Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39897250868](https://github.com/wecreates/content-control/actions/runs/39897250868),
  job `120230427711`: passed on the exact PR head, including image build,
  non-root dependency checks, full Python QA/rendering, Node/PostgreSQL, real
  print/durable-review and publication-disabled startup.

[Money Factory PR 151](https://github.com/wecreates/Money-factory/pull/151)
pinned cross-repository verification to Content Control
`475f0ad26e7d0f7caa325854a64523b4c9cd7686`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`c8b18f3d1d9a6635a220d71237aaa8714cd65bf7` passed
[cross-repository run 39897959270](https://github.com/wecreates/Money-factory/actions/runs/39897959270),
job `120232663125`, including pinned review/export, recovery, binary-output,
rights, KDP metadata/editorial, Money Factory Node and final Python integration
stages. It merged as `76d1c3f0c5a3ae43d5326a8c1781b982be67f37e`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`475f0ad26e7d0f7caa325854a64523b4c9cd7686` as deployment
`dep-dbddnb6417fc738ghrv0`. Deploy-start event
`evt-dbddnb4ii53c73dq75og` bound the exact merge at
`2026-10-23T03:59:40.502896Z`; event `evt-dbddnb2hv4oc73bmt7tg`
recorded `pipeline_minutes_exhausted` at
`2026-10-23T03:59:40.637442Z`; and deploy-end event
`evt-dbddnb37uolc73b2j7sg` recorded failure at
`2026-10-23T03:59:40.912044Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one KDP package-path
identity boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
