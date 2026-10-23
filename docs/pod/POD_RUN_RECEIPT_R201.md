# POD run receipt r201 — final KDP package-file revalidation

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `0e3fa13d9f6e31900b6c05a9145de3f908a4e9e7`
- Money Factory: `a3f2d926566eed866a8064aaeea22a4a60eec0b8`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main`
  with automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 494](https://github.com/wecreates/content-control/pull/494)
merged exact tested head `0c7200411359b4e0e0b3df7459084b3ca0074fe7`
as `097178e6b8c1243f9b7be752ade5a148c9e820dc`. KDP interior
assembly now hash-verifies every member of the final package manifest through
the held package descriptor immediately before manifest commit. This extends
the prior late cover-file check to the newly linked `interior.pdf` and
`interior.receipt.json` as well as all original declared cover files. A final
package member modified or replaced at that boundary fails closed; exact
installed interior inodes are removed, the original cover manifest is retained,
and unrelated concurrent replacements are preserved for investigation.

Regression-first verification truncated the installed `interior.pdf` through
a descriptor anchored at the package root exactly at the manifest commit
boundary. Before the repair the assembly returned success. After the repair the
same regression raised `FILE_HASH_MISMATCH` and recovered the original
manifest. Local verification included:

- recovery, KDP book-boundary and binary-I/O suites: 148/148 passed;
- broad POD Python discovery: 251 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `5cc259be3b392566690bc57442fc017070b211e4`,
  `1a411c1fd77b73b1545dfde1e55ecd6536e2317f`, and
  `231840df0f8d4de5ff603d0b8c247779391bdc1f`;
- [integration run 39919345629](https://github.com/wecreates/content-control/actions/runs/39919345629),
  job `120300530237`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39919345669](https://github.com/wecreates/content-control/actions/runs/39919345669),
  job `120300530094`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 155](https://github.com/wecreates/Money-factory/pull/155)
pinned cross-repository verification to Content Control
`097178e6b8c1243f9b7be752ade5a148c9e820dc`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`9b9b9c019c9b7fedd058e5a930a0f4308bd55275` passed
[cross-repository run 39920106977](https://github.com/wecreates/Money-factory/actions/runs/39920106977),
job `120303004081`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `5b04047297138fc4e5298315482bcd181c9ff728`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`097178e6b8c1243f9b7be752ade5a148c9e820dc` as deployment
`dep-dbdh1puk1f9s73f81qcg`. Deploy-start event
`evt-dbdh1pta7kgc73dn0p00` bound the exact merge at
`2026-10-23T07:46:47.443163Z`; event
`evt-dbdh1pta7kgc73dn0p10` recorded `pipeline_minutes_exhausted` at
`2026-10-23T07:46:47.466367Z`; and deploy-end event
`evt-dbdh1pol0d7c739bju1g` recorded failure at
`2026-10-23T07:46:47.773956Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one final KDP package-file
integrity boundary only; the package is still not claimed to be an atomic
multi-file object, and merged code plus hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
