# POD run receipt r208 — replacement-safe book staging cleanup

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `8548a43766388a758a1f5734a7c8651c28115212`
- Money Factory: `859c2b1195f1fac07b4d3460df2a1930c5d6eeae`
- No open POD/KDP pull request overlapped this repair in either repository.
- The authorized Render service remained a free, unsuspended Docker web service
  on `main`, with automatic commit deployment enabled.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 508](https://github.com/wecreates/content-control/pull/508)
merged exact tested head `00b4bfb3f6548853ebe6b3ced0d9cc4437ed8463`
as `3550048ffa15774231f33eaf971f21e0aedee0e4`. Book-package
staging cleanup now empties only the directory reached through the already-held
staging descriptor and uses a final non-recursive `rmdir`. A same-user writer
that replaces the caller-visible staging name after the identity check can no
longer cause recursive deletion of the replacement's contents.

Regression-first verification swapped the original staging directory out after
its pathname identity was read, installed a nonempty replacement at the same
name, and returned the original identity. Before the repair, pathname-based
`rmtree` deleted the replacement and its marker. After the repair, descriptor-
bound cleanup emptied the original directory while non-recursive removal failed
safely on and preserved the replacement. Verification evidence:

- the new race regression: passed after failing on the previous implementation;
- the complete review/asset/book recovery suite: 39/39 passed;
- recovery, KDP book-boundary, raster-boundary and binary-I/O suites: 188/188
  passed;
- broad POD Python discovery: 265 tests discovered, with all 263 runnable tests
  passed; only the two known OpenCV-dependent modules failed import because
  this local runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- both remote changed blobs exactly matched the locally tested files:
  `1e912138f697500711b4c22e47d870e0e4e42b84` and
  `2fdf884177e4734aac0cdcd4550bb92ec997f60c`;
- [integration run 39967437235](https://github.com/wecreates/content-control/actions/runs/39967437235),
  job `120460885749`: passed on the exact PR head, including Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39967437194](https://github.com/wecreates/content-control/actions/runs/39967437194),
  job `120460883573`: passed on the exact PR head, including production image
  construction, full in-image QA/rendering, real print/review generation and
  publication-disabled startup.

[Money Factory PR 162](https://github.com/wecreates/Money-factory/pull/162)
pinned cross-repository verification to Content Control
`3550048ffa15774231f33eaf971f21e0aedee0e4`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`95803b06dbe71e3b20a5b9e2565f99d5dd37254a` passed
[cross-repository run 39968396453](https://github.com/wecreates/Money-factory/actions/runs/39968396453),
job `120464229457`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `3428b2c16a78ad4a2fe36640ae64e1060255c62b`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`3550048ffa15774231f33eaf971f21e0aedee0e4` as deployment
`dep-dbdmoo15efls73b2mqn0`. Event `evt-dbdmoo8l0d7c739gcgbg` recorded
`pipeline_minutes_exhausted` at `2026-10-23T14:17:05.173991Z`; deploy-start
event `evt-dbdmoocp5sqc7387d4u0` bound the exact merge at
`2026-10-23T14:17:05.187582Z`; and deploy-end event
`evt-dbdmooihv4oc73btqldg` recorded failure at
`2026-10-23T14:17:06.396077Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one staging-cleanup race
in the local KDP assembly transaction only; it is not an atomic multi-file
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
