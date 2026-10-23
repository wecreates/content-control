# POD run receipt r202 — durable KDP manifest commit

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `d5fe7d33c6189fd30e607b13a394c0df6dc6a719`
- Money Factory: `5b04047297138fc4e5298315482bcd181c9ff728`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main`
  with automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 496](https://github.com/wecreates/content-control/pull/496)
merged exact tested head `c571c2c8a8f6760c0b103bf48d1f4b93efbea414`
as `60986cf9e5543aeb6a49bc5e44041db8db9e6771`. KDP interior
assembly now synchronizes the held package directory after atomically replacing
the final manifest. The existing pre-commit sync persists the complete linked
interior files first; the new post-replace sync persists the manifest directory
entry before assembly reports success. If that final sync fails, assembly
reports `BOOK_PACKAGE_DURABILITY_UNCERTAIN` and preserves the complete
manifest with the exact files it references instead of cleaning those files
from a manifest that may already survive a crash.

Regression-first verification recorded the package-directory sync and manifest
replacement order. Before the repair only the pre-manifest sync occurred, so
the regression failed. After the repair the order ended with manifest replace
then package sync. A second regression injected failure at that final sync and
confirmed the visible package remained internally complete. Local verification
included:

- complete recovery suite: 29/29 passed;
- recovery, KDP book-boundary and binary-I/O suites: 150/150 passed;
- broad POD Python discovery: 255 tests ran, with 253 runnable tests passed;
  only the two known OpenCV-dependent modules failed import because this local
  runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `5a833a4701784b00660f81820adfa84621e7ff43`,
  `3c8491ae315cbf04f797ac6d9f6cb13039f0bb74`, and
  `c844fe1d0844c558b24da886bfaba9bcf1f20a49`;
- [integration run 39926025570](https://github.com/wecreates/content-control/actions/runs/39926025570),
  job `120322490673`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39926025569](https://github.com/wecreates/content-control/actions/runs/39926025569),
  job `120322490813`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 156](https://github.com/wecreates/Money-factory/pull/156)
pinned cross-repository verification to Content Control
`60986cf9e5543aeb6a49bc5e44041db8db9e6771`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`91195ce43682551e1a7727ba252685cf1411ae3c` passed
[cross-repository run 39926920651](https://github.com/wecreates/Money-factory/actions/runs/39926920651),
job `120325460658`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `a230f76a3e03a72f181c010d5ec0830e906ce4be`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`60986cf9e5543aeb6a49bc5e44041db8db9e6771` as deployment
`dep-dbdht4u1egvs738mk3u0`. Event
`evt-dbdht4sp5sqc73838n3g` recorded `pipeline_minutes_exhausted` at
`2026-10-23T08:45:07.857763Z`; deploy-start event
`evt-dbdht4qhv4oc73bplcag` bound the exact merge at
`2026-10-23T08:45:07.864811Z`; and deploy-end event
`evt-dbdht54ii53c73dsv810` recorded failure at
`2026-10-23T08:45:08.303142Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one local filesystem
manifest-durability gap only; it is not an independent backup, multi-file
transaction, retention policy or production recovery drill. Merged code plus
hosted CI are not live acceptance. Production restricted
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
