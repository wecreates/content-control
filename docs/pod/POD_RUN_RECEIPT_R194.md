# POD run receipt r194 — ownership-checked review export cleanup

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `16d9b3644efa2a62e40a68ed112721d6980b9615`
- Money Factory: `9ca654cd8e374f8b3c46444a4752783bd17c0b18`
  (the r193 pin plus a newer unrelated free-monitor cadence commit)
- No open pull request overlapped this POD work. Content Control PR 378 remains
  an unrelated disabled OpenFilm candidate and explicitly contains no POD work.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 480](https://github.com/wecreates/content-control/pull/480)
merged exact tested head `cb1a66e344b98ec515e8f55afd67f60f502a8296`
as `d2b3d5a43861976adc845871476b29eae8e787ae`. Before repair, two
regressions proved that offline review export failure cleanup could recursively
delete a concurrent replacement directory and that denied cleanup could replace
the original stage exception with `PermissionError`.

The exporter now uses the existing inode-held POD output-attempt guard. Once its
new directory is open, cleanup removes it only when the current output path has
the same device/inode. Replacement paths are preserved, and cleanup denial keeps
the original failure with `REVIEW_EXPORT_OUTPUT_CLEANUP_FAILED` for manual
recovery. The CLI retains no-parent creation, directory mode `0700`, exclusive
artifact/manifest mode `0600`, no-overwrite and publication-disabled behavior.
This is bounded local cleanup hardening, not a same-account/root sandbox.

Verification after repair:

- focused new cleanup regressions: 2/2 passed;
- combined review-export/recovery suites: 40/40 passed (23 exporter and 17
  shared recovery tests);
- full local POD Node suite: 688 tests, 679 passed, nine expected
  environment-gated skips, zero failures;
- Python syntax and whitespace checks: passed;
- [integration run 39881106013](https://github.com/wecreates/content-control/actions/runs/39881106013),
  job `120178423990`: passed on the exact PR head, including the complete
  pinned Python matrix and the two new cleanup regressions;
- [production-container run 39881106083](https://github.com/wecreates/content-control/actions/runs/39881106083),
  job `120178424208`: passed on the exact PR head, including image build,
  non-root dependencies, Python/Node/PostgreSQL, real print/durable-review and
  publication-disabled startup stages.

[Money Factory PR 148](https://github.com/wecreates/Money-factory/pull/148)
preserved the newer monitor-cadence base and pinned its cross-repository gate to
Content Control `d2b3d5a43861976adc845871476b29eae8e787ae`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`c049757507164b72e34ab8fcd5a21529003fcb72` passed
[cross-repository run 39881700236](https://github.com/wecreates/Money-factory/actions/runs/39881700236),
job `120180311899`, including pinned review/export, recovery, binary-output,
rights, KDP, Money Factory Node and final Python integration stages. It merged
as `a57324232466de1c0d1dc4923df4012ac87506ca`.

## Authorized Render observation

The existing free `content-control-render-worker` remains on `main`, automatic
commit deployment and Docker runtime. Render automatically attempted exact
Content Control merge `d2b3d5a43861976adc845871476b29eae8e787ae` as
deployment `dep-dbdb41m1egvs738fr4kg`. Deploy-start event
`evt-dbdb41ifocic73a7rfn0` bound the exact merge at
`2026-10-23T01:01:58.625538Z`; event `evt-dbdb41gjr8sc738033kg`
recorded `pipeline_minutes_exhausted` at `2026-10-23T01:01:58.689441Z`;
and deploy-end event `evt-dbdb41sii53c73dogp70` recorded failure at
`2026-10-23T01:01:59.061716Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one local offline-review
failure-cleanup boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified.

Both publication flags remain false; Etsy remains excluded. No approval,
clearance, revenue, publication or continuously running self-hosted worker is
claimed. This report-only receipt uses `[skip render]`; the implementation
change itself did not skip CI or deployment.
