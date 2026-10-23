# POD run receipt r196 — output-directory identity handoff

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `06100f6212d48796113a6b23da818813c7f3ac19`
- Money Factory: `06ea34b6a7531f4b7f6b5cb6efc163e5b5172d33`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main` with
  automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 484](https://github.com/wecreates/content-control/pull/484)
merged exact tested head `25239fd0f4b59ac7d3dd72430cd88033bd0697b1`
as `a797195d5241eda57f6cab171739b97733ddf248`. The ownership-checked
review/asset output guard now compares the directory created at acquisition with
the descriptor it opens and compares that held identity with the output path
again before successful handoff. A concurrent replacement in either interval
fails with `OUTPUT_REPLACED`; the replacement is not treated as a completed
package or cleanup target, and moved attempts remain for manual investigation.

Two integration regressions exercise a swap before descriptor acquisition and a
swap after the final successful review stage. Both verify that the replacement
is preserved and no success is returned. Existing failure cleanup, private file
modes, retry and publication-disabled behavior remain in force.

Verification after repair:

- focused recovery, exporter and binary-output suites: 71/71 passed;
- full local POD Node gate after restoring the locked dependencies: 688 tests,
  679 passed, nine expected environment-gated skips and zero failures;
- broad local POD Python discovery: 244 runnable tests passed; only the two
  known OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- [integration run 39889869907](https://github.com/wecreates/content-control/actions/runs/39889869907),
  job `120206801614`: passed on the exact PR head, including the full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39889869886](https://github.com/wecreates/content-control/actions/runs/39889869886),
  job `120206801648`: passed on the exact PR head, including image build,
  non-root dependency checks, full Python QA/rendering, Node/PostgreSQL, real
  print/durable-review and publication-disabled startup.

[Money Factory PR 150](https://github.com/wecreates/Money-factory/pull/150)
pinned cross-repository verification to Content Control
`a797195d5241eda57f6cab171739b97733ddf248`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`061b973f1d7235099157593c876ffdc5c5b28d50` passed
[cross-repository run 39890531276](https://github.com/wecreates/Money-factory/actions/runs/39890531276),
job `120208933841`, including pinned review/export, recovery, binary-output,
rights, KDP metadata/editorial, Money Factory Node and final Python integration
stages. It merged as `bd97797ec06577fafc9e66725c060da7dac0a5ee`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`a797195d5241eda57f6cab171739b97733ddf248` as deployment
`dep-dbdcgbp5efls73amv0t0`. Deploy-start event
`evt-dbdcgbp8a10s738bqpn0` bound the exact merge at
`2026-10-23T02:36:31.761176Z`; event `evt-dbdcgbojr8sc73810ks0`
recorded `pipeline_minutes_exhausted` at `2026-10-23T02:36:31.784279Z`; and
deploy-end event `evt-dbdcgc2hv4oc73bm4i30` recorded failure at
`2026-10-23T02:36:32.085073Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one generated-output
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
