# POD run receipt r198 — descriptor-anchored KDP private staging

Date: 2026-10-23 UTC

## Reconstructed starting state

- Content Control: `20aabda6d09f0e1c6e017faaeee955388c5dfb0b`
- Money Factory: `76d1c3f0c5a3ae43d5326a8c1781b982be67f37e`
- No open POD/KDP pull request overlapped this work in either repository.
- The existing Render service remained a free Docker web service on `main` with
  automatic commit deployment and no suspension.
- The previously failed database-administration path had no credible access
  change and was not retried.

## Implemented and verified

[Content Control PR 488](https://github.com/wecreates/content-control/pull/488)
merged exact tested head `bba9ff8fb0c291c1a3482cf8e2fae53deea2a8d2`
as `37083916ddd224ea7a20aebf0a6db261ad3ee363`. KDP interior
assembly now checks the package identity immediately before staging and creates
the private stage relative to the already-held package descriptor. Rendering,
receipt writes, hashing and manifest creation use the verified Linux
`/proc/self/fd` alias for that descriptor instead of resolving the
caller-visible path again. A replacement already visible before staging fails
with `PACKAGE_REPLACED` before rendering. A later path handoff can write only to
the held original package; the concurrent replacement remains untouched.
Unsupported runtimes fail with `BOOK_STAGING_PATH_UNAVAILABLE` rather than
falling back to an unbound path.

Regression-first verification reproduced the prior redirected render before the
repair. Two new regressions cover a swap before staging and a swap during stage
creation. Local verification after the repair included:

- recovery, KDP book-boundary and binary-I/O suites: 145/145 passed;
- broad POD Python discovery: 248 runnable tests passed; only the two known
  OpenCV-dependent modules failed import because this local runner lacked
  `cv2`;
- Python syntax and whitespace checks: passed;
- [integration run 39900608045](https://github.com/wecreates/content-control/actions/runs/39900608045),
  job `120241085985`: passed on the exact PR head, including the full Node,
  pinned Python/OpenCV, PostgreSQL, production E2E and workflow-control stages;
- [production-container run 39900607995](https://github.com/wecreates/content-control/actions/runs/39900607995),
  job `120241086022`: passed on the exact PR head, including the real Linux
  descriptor alias in the production image, full Python QA/rendering,
  Node/PostgreSQL, print/durable-review and publication-disabled startup.

[Money Factory PR 152](https://github.com/wecreates/Money-factory/pull/152)
pinned cross-repository verification to Content Control
`37083916ddd224ea7a20aebf0a6db261ad3ee363`, retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact head
`c6f6f0487ead3f9f3e97adde1cbe0d50fd71bffd` passed
[cross-repository run 39901257420](https://github.com/wecreates/Money-factory/actions/runs/39901257420),
job `120243126023`, including pinned review/export, recovery, binary-output,
rights, KDP metadata/editorial, Money Factory Node and final Python integration
stages. It merged as `01380615172cc0ee576bae4dfbedf41091224bcf`.

## Authorized Render observation

Render automatically attempted exact Content Control merge
`37083916ddd224ea7a20aebf0a6db261ad3ee363` as deployment
`dep-dbde87gu01pc73cjllkg`. Deploy-start event
`evt-dbde87qfocic73a9u0b0` bound the exact merge at
`2026-10-23T04:35:43.255094Z`; event `evt-dbde87qhv4oc73bn87q0`
recorded `pipeline_minutes_exhausted` at
`2026-10-23T04:35:43.287684Z`; and deploy-end event
`evt-dbde87ptqros738iv1vg` recorded failure at
`2026-10-23T04:35:43.607312Z`. No application build ran, so this change is not
verified in the hosted runtime. No manual retry, paid workaround, replacement
service, credential access or network widening occurred.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This closes one KDP private-staging
path-integrity boundary only; merged code and hosted CI are not live acceptance.
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
