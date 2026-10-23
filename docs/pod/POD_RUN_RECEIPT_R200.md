# POD run receipt r200 — late KDP cover-file revalidation

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `dc0b52a7f380352b8ac6ee00c0b83451ef073c15`
- Money Factory: `212ffe6a4f313019f59a41bfe8584148b07321fd`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main`
  with automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 492](https://github.com/wecreates/content-control/pull/492)
merged exact tested head `8734b7929366337fa45a201b5c1231daee5b73fa`
as `fc34ead844b4cd3b2d11423b9c6191453bceb68d`. KDP interior
assembly now hash-verifies every member declared by the original cover manifest
through the held package descriptor both before rendering and immediately before
committing the new interior manifest. A cover member replaced during rendering
fails with `FILE_HASH_MISMATCH`; newly linked interior outputs are removed, the
original manifest is retained, and the concurrent replacement is preserved for
investigation.

Regression-first verification replaced `print.png` exactly at the manifest
commit boundary. Before the repair the assembly returned success while the
resulting package no longer matched its declared hashes. After the repair the
same regression failed closed and recovered the original manifest. Local
verification included:

- recovery, KDP book-boundary and binary-I/O suites: 147/147 passed;
- broad POD Python discovery: 250 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files;
- [integration run 39914331005](https://github.com/wecreates/content-control/actions/runs/39914331005),
  job `120284324483`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39914330838](https://github.com/wecreates/content-control/actions/runs/39914330838),
  job `120284323721`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 154](https://github.com/wecreates/Money-factory/pull/154)
pinned cross-repository verification to Content Control
`fc34ead844b4cd3b2d11423b9c6191453bceb68d`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`53b053b94ad0e467cd8ceb0cae6b9844f851468c` passed
[cross-repository run 39915083913](https://github.com/wecreates/Money-factory/actions/runs/39915083913),
job `120286729471`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `a3f2d926566eed866a8064aaeea22a4a60eec0b8`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`fc34ead844b4cd3b2d11423b9c6191453bceb68d` as deployment
`dep-dbdgc5e1egvs738kvo60`. Event `evt-dbdgc5ahv4oc73bol2hg`
recorded `pipeline_minutes_exhausted` at
`2026-10-23T07:00:37.541516Z`; deploy-start event
`evt-dbdgc59tqros738kaq0g` bound the exact merge at
`2026-10-23T07:00:37.553977Z`; and deploy-end event
`evt-dbdgc5ahv4oc73bol2j0` recorded failure at
`2026-10-23T07:00:37.936989Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one late KDP cover-file
integrity boundary only; the package is not claimed to be an atomic multi-file
object, and merged code plus hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
