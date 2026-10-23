# POD run receipt r204 — manifest destination identity confirmation

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `5004ad663c7f43be5eae3b92bc7f927e3b18843b`
- Money Factory: `6687f3f6c64a3e41665285540f1e51e8605e3b39`
- The Money Factory head included a newer monitor-cadence commit and was
  preserved as the base for dependent work.
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free, unsuspended Docker web service
  on `main` with automatic commit deployment.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 500](https://github.com/wecreates/content-control/pull/500)
merged exact tested head `1f3878df0715f345e242d2662ceb82595bc69529`
as `3de453f76016061c8d856f25115b8dc0b0a8c393`. Both the
forward KDP manifest rename and exact-original rollback rename now confirm that
the package path still names the staged inode before treating replacement as
complete. A post-rename forward replacement is rejected as
`MANIFEST_CHANGED`, the original manifest is restored, and only owned
interior links are removed. A replaced rollback reports
`BOOK_MANIFEST_ROLLBACK_FAILED` and preserves installed files because cleanup
can no longer prove which manifest is authoritative.

Regression-first verification installed a different pre-created manifest inode
immediately after the forward rename returned. Before the repair assembly
reported success, so the regression failed with
`AssertionError: ValueError not raised`. After the repair the same interleaving
was rejected and the original package remained retryable. A second regression
replaced the rollback destination and confirmed the fail-closed preservation
path. Local verification included:

- the two new targeted regressions: 2/2 passed;
- recovery, KDP book-boundary and binary-I/O suites: 154/154 passed;
- broad POD Python discovery: 259 tests ran, with 257 runnable tests passed;
  only the two known OpenCV-dependent modules failed import because this local
  runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `01a22eba6f7c74f29f65c075a842363f4f0439a2`,
  `7399661caa2d6f8a735dd7d1cd7d72d23af7fa30`, and
  `15be3c147e9df757c29a9deb0974ba54436e3050`;
- [integration run 39942388414](https://github.com/wecreates/content-control/actions/runs/39942388414),
  job `120376721090`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39942388324](https://github.com/wecreates/content-control/actions/runs/39942388324),
  job `120376721103`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 158](https://github.com/wecreates/Money-factory/pull/158)
pinned cross-repository verification to Content Control
`3de453f76016061c8d856f25115b8dc0b0a8c393`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. It was based
on the current monitor-tick head rather than overwriting it. Exact head
`7e7882f0f77c5beadd0f31c3ccee54386576458a` passed
[cross-repository run 39943232782](https://github.com/wecreates/Money-factory/actions/runs/39943232782),
job `120379514572`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `39185bbf732886a8cf7f8e39471a049637edfc80`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`3de453f76016061c8d856f25115b8dc0b0a8c393` as deployment
`dep-dbdjt2bm8hqs73ed9l9g`. Event
`evt-dbdjt2afocic73adro7g` recorded `pipeline_minutes_exhausted` at
`2026-10-23T11:01:29.633814Z`; deploy-start event
`evt-dbdjt28l0d7c739dq1n0` bound the exact merge at
`2026-10-23T11:01:29.6853Z`; and deploy-end event
`evt-dbdjt2ihv4oc73br6ds0` recorded failure at
`2026-10-23T11:01:30.117437Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one post-rename namespace
confirmation gap only; it is not an atomic multi-file transaction, protection
from a same-user writer that continues after the identity check, independent
backup, retention policy or production recovery drill. Merged code plus hosted
CI are not live acceptance. Production restricted database/schema/migrations,
retained off-host recovery evidence, deployed hybrid dependencies, mounted
Money Factory authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform adapters,
actual economics/reconciliation, owner-phone acceptance, monitoring/recovery
drills, measured capacity and a real authorized end-to-end launch remain
unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
