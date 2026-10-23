# POD run receipt r205 — manifest byte confirmation

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `aaa32a842b2f8f2277e54d0daf66cdea14ec0475`
- Money Factory: `39185bbf732886a8cf7f8e39471a049637edfc80`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free, unsuspended Docker web service
  on `main` with automatic commit deployment.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 502](https://github.com/wecreates/content-control/pull/502)
merged exact tested head `ddad1dbdf6932bf0c34e8f1ba28cb45f95e3614c`
as `495bc4be6e721af01997900902ee1365c2f674b7`. Forward KDP
manifest installation and exact-original rollback now confirm both the staged
file identity and its complete bytes after replacement. This rejects an
attacker or concurrent same-user writer that keeps the installed inode but
modifies its contents before the confirmation snapshot. A forward mutation is
reported as `MANIFEST_CHANGED`; a rollback mutation reports
`BOOK_MANIFEST_ROLLBACK_FAILED` and preserves installed files because cleanup
cannot prove which manifest is authoritative.

Regression-first verification wrapped the rename to truncate and rewrite the
newly installed manifest through the same inode immediately after the forward
rename returned. Before the repair, assembly reported success and the
regression failed with `AssertionError: ValueError not raised`. After the
repair, the same interleaving was rejected. A second regression exercised the
same in-place mutation during rollback and confirmed fail-closed preservation.
Local verification included:

- the two new targeted regressions: 2/2 passed;
- the recovery suite: 35/35 passed;
- recovery, KDP book-boundary and binary-I/O suites: 156/156 passed;
- broad POD Python discovery: 261 tests discovered, with 259 runnable tests
  passed; only the two known OpenCV-dependent modules failed import because
  this local runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- all three remote changed blobs exactly matched the locally tested files:
  `05d98434cbdc2ffe2056e64784078c6db0bcfb7b`,
  `8fa45bad7ed7d335bb418e9547450193a41f56c3`, and
  `6b83bc1a3ad80432676e2f06dc6c8ece473f4563`;
- [integration run 39952104744](https://github.com/wecreates/content-control/actions/runs/39952104744),
  job `120408799693`: passed on the exact PR head, including full Node,
  Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39952104767](https://github.com/wecreates/content-control/actions/runs/39952104767),
  job `120408799606`: passed on the exact PR head, including the production
  image, complete Python QA/rendering, Node/PostgreSQL, real print/review
  generation and publication-disabled startup.

[Money Factory PR 159](https://github.com/wecreates/Money-factory/pull/159)
pinned cross-repository verification to Content Control
`495bc4be6e721af01997900902ee1365c2f674b7`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`52047f8ec84f8550701811655b0258a4e12defd3` passed
[cross-repository run 39953037138](https://github.com/wecreates/Money-factory/actions/runs/39953037138),
job `120411961219`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF, font-rights, retained-template,
metadata/editorial, Money Factory Node and final Python integration stages. It
merged as `4357db2cc0ff647c073bd73c18ca16e97ec8ed05`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`495bc4be6e721af01997900902ee1365c2f674b7` as deployment
`dep-dbdl3h142hec739a85m0`. Deploy-start event
`evt-dbdl3h0jr8sc73871lc0` bound the exact merge at
`2026-10-23T12:23:32.750764Z`; event
`evt-dbdl3h1tqros738nsl70` recorded `pipeline_minutes_exhausted` at
`2026-10-23T12:23:32.803455Z`; and deploy-end event
`evt-dbdl3hda7kgc73dq4890` recorded failure at
`2026-10-23T12:23:33.333241Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one same-inode
post-rename mutation gap only; the confirmation snapshot cannot prevent a
writer from changing the file again after the snapshot and is not an atomic
multi-file transaction, independent backup, retention policy or production
recovery drill. Merged code plus hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained off-host recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
