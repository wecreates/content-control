# POD run receipt r210 — descriptor-bound task workspace cleanup

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `102f006f61d1fd655c20f6871d54a0f26a1cd746`
- Money Factory: `e51d873873bdfce02f4b5247566921c8e242c9ae`
- No open POD/KDP pull request overlapped this repair in either repository.
- The authorized Render service remained the existing free Docker service on
  `main`, with automatic commit deployment enabled.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 512](https://github.com/wecreates/content-control/pull/512)
merged exact tested head `9e75f390531e0e6b9591ace84923187a9d98db41`
as `33c2affb1eb387d1bb998545052df63e3a2d4c1b`. The stored-task
resolver now holds the temporary workspace directory descriptor from creation,
clears nested generated output only through held descriptors, refuses final
symlink traversal, rechecks directory identities and uses non-recursive final
removals. Cleanup no longer recursively follows a workspace pathname that a
same-user concurrent process can replace.

Regression-first verification replaced the workspace immediately before its
final removal and installed a nonempty marker. Before the repair, recursive
`rm` deleted that replacement and the marker. After the repair, descriptor-bound
cleanup cleared only the original workspace and preserved the replacement.
Another regression verified nested generated output cleanup without following
a symlink to an outside directory. Verification evidence:

- focused stored-task resolver suite: 17/17 passed;
- related production, current-authority, template and worker suites: 114/114
  passed;
- broad local POD Node discovery: 671 tests, with 662 passes and two expected
  skips; six PostgreSQL-backed files could not import the locally absent `pg`
  dependency, and one load-sensitive process test passed immediately in
  isolation. These unavailable dependency-backed cases were not counted as
  local passes;
- Node syntax and whitespace checks: passed;
- remote changed blobs exactly matched the locally tested files:
  `27aa7401bc7fea5f9a552fc6b3770cf4a6ddabbf` and
  `7c8bf3b2046ab6790ba2b0164d3569e10740e7c2`;
- [integration run 39973910724](https://github.com/wecreates/content-control/actions/runs/39973910724),
  job `120483427281`: passed on the exact PR head, including complete Node and
  PostgreSQL coverage, Python/OpenCV gates, production E2E and workflow control;
- [production-container run 39973910881](https://github.com/wecreates/content-control/actions/runs/39973910881),
  job `120483428068`: passed on the exact PR head, including production image
  construction, non-root dependencies, full Python QA/rendering,
  Node/PostgreSQL tests, real print/review generation and publication-disabled
  startup.

[Money Factory PR 164](https://github.com/wecreates/Money-factory/pull/164)
pinned cross-repository verification to Content Control
`33c2affb1eb387d1bb998545052df63e3a2d4c1b`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`bec5163e16007a5cb2ca9c4e14ff3cc412d5bef0` passed
[cross-repository run 39975022487](https://github.com/wecreates/Money-factory/actions/runs/39975022487),
job `120487242667`, including pinned review/export, evidence, recovery,
binary-output, raster/layout, KDP PDF and pairing, font rights, retained official
templates, metadata/editorial and Money Factory integration stages. It merged
as `5e53803fd240d2181610dd8dde61c1610ee04804`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`33c2affb1eb387d1bb998545052df63e3a2d4c1b` as deployment
`dep-dbdne6142hec739dr3tg`. Event `evt-dbdne6cii53c73e1nhq0` recorded
`pipeline_minutes_exhausted` at `2026-10-23T15:02:49.472828Z`; deploy-start
event `evt-dbdne6da7kgc73dsep6g` bound the exact merge at
`2026-10-23T15:02:49.540156Z`; and deploy-end event
`evt-dbdne6ihv4oc73buhdc0` recorded failure at
`2026-10-23T15:02:50.038722Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one temporary task
workspace cleanup race only; it is not a production recovery drill, independent
backup, retention guarantee or live service verification. Merged code plus
hosted CI are not live acceptance. Production restricted database/schema and
migrations, retained off-host recovery evidence, deployed hybrid dependencies,
mounted Money Factory authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform adapters,
actual economics/reconciliation, owner-phone acceptance, monitoring/recovery
drills, measured capacity and a real authorized end-to-end launch remain
unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
