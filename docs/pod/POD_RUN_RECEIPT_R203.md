# POD run receipt r203 — post-commit package revalidation

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `6bc840300a9495d8ce1a17847d7bb246dce56528`
- Money Factory: `a230f76a3e03a72f181c010d5ec0830e906ce4be`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main`
  with automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 498](https://github.com/wecreates/content-control/pull/498)
merged exact tested head `42776132638271cad5fe765f07c6bef87faba866`
as `fa99523fb3c5c1126c818853e434097b73ab73e8`. KDP book
assembly now revalidates every final package member after the final manifest
becomes visible. If a linked package member changes while the manifest is
committing, assembly restores the byte-exact original manifest, synchronizes
the package directory, reports the original integrity failure, and removes the
failed new files. If manifest rollback cannot be confirmed and synchronized,
assembly reports `BOOK_MANIFEST_ROLLBACK_FAILED` and preserves installed
files rather than deleting data that a possibly committed manifest references.

Regression-first verification modified `interior.pdf` from the manifest
replacement hook immediately before the manifest rename. Before the repair,
assembly incorrectly reported success, so the regression failed with
`AssertionError: ValueError not raised`. After the repair the same
interleaving was rejected and the original manifest was restored. A second
regression forced rollback failure and confirmed that installed files were
preserved. Local verification included:

- the two new targeted regressions: 2/2 passed;
- complete recovery suite: 31/31 passed;
- recovery, KDP book-boundary and binary-I/O suites: 152/152 passed;
- broad POD Python discovery: 257 tests ran, with 255 runnable tests passed;
  only the two known OpenCV-dependent modules failed import because this local
  runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `32cb618b8fb42d8d522e991ff448e59cfc7f3ec8`,
  `d1be318ebeb0b984c545558add3c6510f7df3a76`, and
  `0c9bbef5dc457b1ca9fbb8e5e9954f491596ae11`;
- [integration run 39932911200](https://github.com/wecreates/content-control/actions/runs/39932911200),
  job `120345320456`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39932911193](https://github.com/wecreates/content-control/actions/runs/39932911193),
  job `120345320631`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 157](https://github.com/wecreates/Money-factory/pull/157)
pinned cross-repository verification to Content Control
`fa99523fb3c5c1126c818853e434097b73ab73e8`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`1872b94c1df69a4ec1739d75c948ce6313ffe0b3` passed
[cross-repository run 39934096560](https://github.com/wecreates/Money-factory/actions/runs/39934096560),
job `120349260885`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `e964d450a9a97bc4f5ff39c5a947a3ec392df398`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`fa99523fb3c5c1126c818853e434097b73ab73e8` as deployment
`dep-dbdioue1egvs738ni8j0`. Deploy-start event
`evt-dbdiouj7uolc73b612hg` bound the exact merge at
`2026-10-23T09:44:26.223654Z`; event
`evt-dbdiouh8a10s738fur80` recorded `pipeline_minutes_exhausted` at
`2026-10-23T09:44:26.230227Z`; and deploy-end event
`evt-dbdiouj7uolc73b612jg` recorded failure at
`2026-10-23T09:44:26.618757Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one same-user
post-commit package-interleaving gap only; it is not an atomic multi-file
transaction, protection from a privileged local adversary, independent backup,
retention policy or production recovery drill. Merged code plus hosted CI are
not live acceptance. Production restricted database/schema/migrations,
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
