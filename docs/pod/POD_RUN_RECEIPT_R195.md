# POD run receipt r195 — private generated review packages

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `0b7c2bf375a4b5d3e265786b8b66f0450db523c3`
- Money Factory: `a57324232466de1c0d1dc4923df4012ac87506ca`
- No open pull request overlapped this POD work. Content Control PR 378 remains
  an unrelated disabled OpenFilm candidate and explicitly contains no POD work.
- The previously failed database-administration path had no credible access
  change and was not retried.
- Render had ignored the r194 report-only merge exactly as requested by its
  `[skip render]` marker; the preceding application build remained blocked by
  exhausted pipeline minutes.

## Implemented and verified

[Content Control PR 482](https://github.com/wecreates/content-control/pull/482)
merged exact tested head `0e541a426e64291979e8802b856efe3a19557d64`
as `926c6b576233d5310239fc5c86be9e075add3d87`. A real KDP review-package
regression run under process umask `000` failed against the prior tree: both the
review attempt and nested asset-package directories were `0777`, while ten
unpublished PNG/PDF/JSON files were `0666`.

New review and nested asset-package directories now default to `0700`. Shared
atomic JSON writes create their temporary/replacement inode exclusively as
`0600`. The asset generator restricts completed PNG masks, print image and KDP
cover PDF to `0600`. Private parent directories prevent group/other traversal
while third-party image/PDF encoders are writing. The exact recursive mode
regression now passes independently of umask. This is local discretionary-access
hardening, not encryption or protection from the same account/root.

Verification after repair:

- focused recovery, exporter and binary-output suites: 69/69 passed;
- full local POD Node gate: 688 tests, 679 passed, nine expected
  environment-gated skips, zero failures;
- broad local Python discovery: 242 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this runner lacked `cv2`;
- Python syntax and whitespace checks: passed;
- [integration run 39888078627](https://github.com/wecreates/content-control/actions/runs/39888078627),
  job `120200897345`: passed on the exact PR head, including the complete pinned
  Python/OpenCV matrix, the new permissions regression, Node, PostgreSQL and
  production E2E stages;
- [production-container run 39888078684](https://github.com/wecreates/content-control/actions/runs/39888078684),
  job `120200897613`: passed on the exact PR head, including image build,
  non-root dependencies, full Python rendering/QA, Node/PostgreSQL, real
  print/durable-review and publication-disabled startup stages.

[Money Factory PR 149](https://github.com/wecreates/Money-factory/pull/149)
pinned its cross-repository gate to Content Control
`926c6b576233d5310239fc5c86be9e075add3d87`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`546a75a1bb58570368aa3a3a72e7bb8245f7e54e` passed
[cross-repository run 39888783195](https://github.com/wecreates/Money-factory/actions/runs/39888783195),
job `120203224524`, including pinned review/export, recovery, binary-output,
rights, KDP metadata/editorial, Money Factory Node and final Python integration
stages. It merged as `06ea34b6a7531f4b7f6b5cb6efc163e5b5172d33`.

## Authorized Render observation

The existing free `content-control-render-worker` remains on `main`, automatic
commit deployment and Docker runtime. Render automatically attempted exact
Content Control merge `926c6b576233d5310239fc5c86be9e075add3d87` as
deployment `dep-dbdc7b5bedkc73cr9vvg`. Deploy-start event
`evt-dbdc7b2focic73a8j7dg` bound the exact merge at
`2026-10-23T02:17:16.445252Z`; event `evt-dbdc7b4p5sqc73fvij5g`
recorded `pipeline_minutes_exhausted` at `2026-10-23T02:17:16.521251Z`;
and deploy-end event `evt-dbdc7b2hv4oc73blu42g` recorded failure at
`2026-10-23T02:17:16.790030Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one local generated-review
file-permission boundary only; merged code and hosted CI are not live acceptance.
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
