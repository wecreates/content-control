# POD run receipt r209 — descriptor-bound shared output cleanup

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `36cf2914f4fbafe92efd83dca7c67739faf665df`
- Money Factory: `3428b2c16a78ad4a2fe36640ae64e1060255c62b`
- No open POD/KDP pull request overlapped this repair in either repository.
- The authorized Render service remained a free, unsuspended Docker web service
  on `main`, with automatic commit deployment enabled.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 510](https://github.com/wecreates/content-control/pull/510)
merged exact tested head `bce65dc72adfbdaffe07f8ae0a2ef42f9cea2734`
as `d8db8c966a05422f8cb00baa96486c7b17b806e1`. The shared
review/export/asset output-attempt helper now recursively clears failed attempts
only through already-held directory descriptors. It rechecks the top-level
output identity after cleanup and uses non-recursive final removals, preventing
a same-user writer from turning a verified cleanup target into traversal and
deletion of a nonempty replacement directory.

Regression-first verification swapped the original output directory out after
cleanup read its pathname identity, installed a nonempty replacement at the
same name, and returned the original identity. Before the repair, pathname-
based `rmtree` deleted the replacement and its marker. After the repair,
descriptor-bound cleanup affected only the original inode and preserved the
replacement. Verification evidence:

- the new race regression: passed after failing on the previous implementation;
- review-export and recovery suites: 63/63 passed;
- recovery, KDP book-boundary, raster-boundary and binary-I/O suites: 189/189
  passed;
- broad POD Python discovery: 266 tests discovered, with all 264 runnable tests
  passed; only the two known OpenCV-dependent modules failed import because
  this local runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- the three remote changed blobs exactly matched the locally tested files:
  `362c64876dd4d7841e8e807e12a153ae706a067c`,
  `faed2c379dc6727a6ec94c94e4048539699c289f` and
  `86f46293b6b0ca6f1dcc8e234da682e490983576`;
- [integration run 39970127396](https://github.com/wecreates/content-control/actions/runs/39970127396),
  job `120470293661`: passed on the exact PR head, including Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39970127434](https://github.com/wecreates/content-control/actions/runs/39970127434),
  job `120470880167`: passed on the exact PR head, including production image
  construction, full in-image QA/rendering, real print/review generation and
  publication-disabled startup.

[Money Factory PR 163](https://github.com/wecreates/Money-factory/pull/163)
pinned cross-repository verification to Content Control
`d8db8c966a05422f8cb00baa96486c7b17b806e1`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`4783d4d79b3652ebe9d86d910b7011a3bdec3e4b` passed
[cross-repository run 39971588440](https://github.com/wecreates/Money-factory/actions/runs/39971588440),
job `120475391858`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `e51d873873bdfce02f4b5247566921c8e242c9ae`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`d8db8c966a05422f8cb00baa96486c7b17b806e1` as deployment
`dep-dbdn34bm8hqs73ehtekg`. Event `evt-dbdn34htqros738pqg4g` recorded
`pipeline_minutes_exhausted` at `2026-10-23T14:39:14.192271Z`; deploy-start
event `evt-dbdn34gjr8sc7388uek0` bound the exact merge at
`2026-10-23T14:39:14.261809Z`; and deploy-end event
`evt-dbdn34ptqros738pqgcg` recorded failure at
`2026-10-23T14:39:15.001313Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one shared output-cleanup
race in local review, export and asset attempt recovery only; it is not an
atomic multi-file transaction, independent backup, retention policy or
production recovery drill. Merged code plus hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained off-host recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
