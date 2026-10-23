# POD run receipt r206 — post-sync package verification

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `5bf4deb2c8275e09b681f793adf3a8534e2be776`
- Money Factory: `4357db2cc0ff647c073bd73c18ca16e97ec8ed05`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free, unsuspended Docker web service
  on `main` with automatic commit deployment.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 504](https://github.com/wecreates/content-control/pull/504)
merged exact tested head `e51450b04b20a93789d172b8a5b0417fa5bec699`
as `eb9a8fd29d2e1545b26294f2218d99e616658b12`. After the final
package directory sync, KDP assembly now rechecks the exact committed manifest
identity and bytes and re-hashes every declared member through the held package
descriptor. If the manifest or a member changed during that durability step,
assembly reports `BOOK_PACKAGE_CHANGED_AFTER_COMMIT` and preserves the
possibly durable package for recovery instead of reporting success or deleting
part of it.

Regression-first verification mutated the interior PDF and, separately, rewrote
the committed manifest through the same inode while the final package
`fsync` was in progress. Before the repair both cases returned success, so
both regressions failed with `AssertionError: ValueError not raised`. After
the repair both interleavings were detected and preserved for investigation.
Local verification included:

- the two new targeted regressions: 2/2 passed;
- the recovery suite: 37/37 passed;
- recovery, KDP book-boundary and binary-I/O suites: 158/158 passed;
- broad POD Python discovery: 263 tests discovered, with 261 runnable tests
  passed; only the two known OpenCV-dependent modules failed import because
  this local runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `6bb0a6519c2b9b3f187cc4c39e059bf4ba6da280`,
  `2dfdf85db78e3c5d1f80f528253a1b68d3313a0c`, and
  `5a11148f0867835335074e90ab88aaba5af25163`;
- [integration run 39955325671](https://github.com/wecreates/content-control/actions/runs/39955325671),
  job `120419629394`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39955325613](https://github.com/wecreates/content-control/actions/runs/39955325613),
  job `120419628919`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 160](https://github.com/wecreates/Money-factory/pull/160)
pinned cross-repository verification to Content Control
`eb9a8fd29d2e1545b26294f2218d99e616658b12`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`c2b68d7c14b0fc37f1cf88dad947d390fb4fceaa` passed
[cross-repository run 39956286008](https://github.com/wecreates/Money-factory/actions/runs/39956286008),
job `120422823717`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `31496212f7d0dd126f660b7e972bd0200520557b`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`eb9a8fd29d2e1545b26294f2218d99e616658b12` as deployment
`dep-dbdlfhou01pc73crq7ug`. Deploy-start event
`evt-dbdlfi2focic73af5n60` bound the exact merge at
`2026-10-23T12:49:12.145759Z`; event
`evt-dbdlfi37uolc73b891c0` recorded `pipeline_minutes_exhausted` at
`2026-10-23T12:49:12.174134Z`; and deploy-end event
`evt-dbdlfi2focic73af5n90` recorded failure at
`2026-10-23T12:49:12.939302Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one mutation window during
the final local durability step only; the final snapshot cannot prevent a writer
from changing the package again afterwards and is not an atomic multi-file
transaction, independent backup, retention policy or production recovery drill.
Merged code plus hosted CI are not live acceptance. Production restricted
database/schema/migrations, retained off-host recovery evidence, deployed hybrid
dependencies, mounted Money Factory authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform adapters,
actual economics/reconciliation, owner-phone acceptance, monitoring/recovery
drills, measured capacity and a real authorized end-to-end launch remain
unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
