# POD run receipt r207 — descriptor-bound member verification

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `07e15c90f980756fc1927557247cc4996561b10f`
- Money Factory: `31496212f7d0dd126f660b7e972bd0200520557b`
- No open POD/KDP pull request overlapped this work in either repository.
- The authorized Render service remained a free, unsuspended Docker web service
  on `main`, with automatic commit deployment enabled.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 506](https://github.com/wecreates/content-control/pull/506)
merged exact tested head `72e566debabc20021cd38b4d6b978df948eb7174`
as `b433d782890d7060317760c98a6fdf12e61e7731`. Declared KDP
package members are now hashed by walking every path component through the
already-open package-directory descriptor with `O_NOFOLLOW`. This closes the
window in which a validated parent directory could be replaced by a symlink to
an external directory before the member was opened. Verification remains
bounded by the existing 16 MiB artifact ceiling and rejects the substitution
before rendering.

Regression-first verification replaced a declared member's validated parent
with a symlink to an external directory containing identical bytes. Before the
repair, verification followed that replacement and invoked `render_book`; the
regression failed because rendering had started. After the repair, it returned
`ARTIFACT_PATH_INVALID` before rendering. Verification evidence:

- the new race regression plus two adjacent checks: 3/3 passed;
- the recovery suite: 38/38 passed;
- recovery, KDP book-boundary and binary-I/O suites: 159/159 passed;
- broad POD Python discovery: 264 tests discovered, with 262 runnable tests
  passed; only the two known OpenCV-dependent modules failed import because
  this local runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- both remote changed blobs exactly matched the locally tested files:
  `3c16c41808949573e8e4f7cfae97907221686a0c` and
  `106beb9465a9f4919d8c421f46c468082fcf461d`;
- [integration run 39963177755](https://github.com/wecreates/content-control/actions/runs/39963177755),
  job `120446123041`: passed on the exact PR head, including Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39963177817](https://github.com/wecreates/content-control/actions/runs/39963177817),
  job `120446123367`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 161](https://github.com/wecreates/Money-factory/pull/161)
pinned cross-repository verification to Content Control
`b433d782890d7060317760c98a6fdf12e61e7731`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`5607c06bf7e06a7ff5da743755d0f2f68e5e3cc9` passed
[cross-repository run 39964785584](https://github.com/wecreates/Money-factory/actions/runs/39964785584),
job `120451699708`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `859c2b1195f1fac07b4d3460df2a1930c5d6eeae`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`b433d782890d7060317760c98a6fdf12e61e7731` as deployment
`dep-dbdmce3m8hqs73egoj6g`. Event
`evt-dbdmce9tqros738p3380` recorded `pipeline_minutes_exhausted` at
`2026-10-23T13:50:49.603683Z`; deploy-start event
`evt-dbdmcecp5sqc73870590` bound the exact merge at
`2026-10-23T13:50:49.604555Z`; and deploy-end event
`evt-dbdmcegjr8sc73887iug` recorded failure at
`2026-10-23T13:50:50.211817Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one package-path race in
the local KDP assembly transaction only; it is not an atomic multi-file
transaction, independent backup, retention policy or production recovery drill.
Merged code plus hosted CI are not live acceptance. Production restricted
database/schema/migrations, retained off-host recovery evidence, deployed hybrid
dependencies, mounted Money Factory authority/current grants and revocation,
real accounts/sources/rights/templates/reviewers, authorized five-platform
adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
