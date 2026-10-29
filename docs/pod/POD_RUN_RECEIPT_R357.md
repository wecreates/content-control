# POD run receipt r357 — QA task input snapshot

Date: 2026-10-29  
Acceptance state: **0 of 24 areas live-accepted; 24 remain open**  
Publication state: **disabled** (`PUBLICATION_ENABLED=false`, `POD_PUBLICATION_ENABLED=false`)  
Etsy: excluded

## Change delivered

Content Control PR #846 was squash-merged as `0a31e2b451fc823c5d97c20d0ad46a5693387748`. The production worker now binds resolver-authorized QA paths, evidence inputs, KDP review inputs, signed-output location, and QA-stage workspace before invoking the caller-owned independent reviewer. The QA subprocess consumes only that snapshot, and a changed live signed-output descriptor is rejected before its result is read.

This closes a confirmed time-of-check/time-of-use defect: `reviewPackage` could retain and mutate the resolved task, causing the QA child to receive replacement package, reference, source, rights, text-layer, or output arguments after package generation and durable persistence.

The branch started from current main `aa2ee91dc09b4966b5b0565a599d102f1d99f813`; no concurrent main change was overwritten.

## Regression and exact-head verification

- Regression-only head: `5aa7dbebe474cf985a5f333f6bd4d51fe363c035`.
- Expected failing integration run `40903156449`, job `123550632711`: 981 tests, 980 passed, 1 failed. The QA child received `replacement-package-dir`, proving the defect.
- Tested repaired head: `f3917467918f24a98c497833f833258bd37d7924`.
- Content Control integration run `40903480972`, job `123551797535`: success; 981/981 Node tests, 385/385 Python/OpenCV/rendering tests, PostgreSQL/end-to-end, syntax, workflow-control, and free-review guards.
- Content Control container run `40903480674`, job `123552328988`: success; 385 Python tests, 981 Node tests, PostgreSQL and real print/review workflow gates. Startup reported `publication_enabled:false`, `production_status:DISABLED`, and `outbox_status:DISABLED`.

## Money Factory authority pin

Money Factory PR #312 was exact-head verified and squash-merged as `be72567d9f69ae2e52ee050000bb6046a9566fb1`. Its workflow pins Content Control `0a31e2b451fc823c5d97c20d0ad46a5693387748`.

Cross-repository run `40904819818`, job `123556582041`, passed on pin head `06956e8ed7abd4a98c35989e25b9de7864f2b6f2`:

- 634/634 Node contract tests;
- Python suites of 34, 23, 40, 28, 28, 93, 5, 6, 23, and 81 tests;
- 121/121 Node/PostgreSQL bridge tests;
- KDP review remained `REVIEW_REQUIRED`, `marketplace_ready:false`, `production_ready:false`, and `publication_enabled:false`;
- both publication environment gates remained literal `false`.

## Render observation

Authorized service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains active, unsuspended, on the free plan, Docker runtime, one instance, and auto-deploys `main`.

Render detected functional merge `0a31e2b451fc823c5d97c20d0ad46a5693387748` as deploy `dep-dbhmk57avr4c73a367h0`, but failed before build because free pipeline minutes remain exhausted:

- deploy started: `evt-dbhmk5b23eus73edq0hg`;
- pipeline minutes exhausted: `evt-dbhmk59iimcc73ej0shg`;
- deploy ended failed: `evt-dbhmk5h40j4s73fi10b0`.

The functional merge is therefore **not live-accepted on Render**. No paid capacity was purchased and no publication control was enabled.

## Acceptance and limitations

All 24 acceptance areas remain open because implementation and repository tests do not prove live end-to-end acceptance. The current checklist still requires attributable deployment evidence for the production database/preflight path, independent backup and recovery, live Money Factory authority, authorized marketplace accounts and readback, official previews, real economics and reconciliation, mobile operations, monitoring, measured capacity, end-to-end execution, and controlled launch approval.

The prior database-administration path still has no credible changed access path, so it was not retried. `POD_IMPLEMENTATION_STATUS.md` again returned empty content through the connector, while `POD_COMPLETION_CHECKLIST.md` and `POD_FREE_DEPLOYMENT.md` were readable. No credentials, paid resources, messages, bot-evasion, widened network access, or fabricated approvals were used. No new essential user-only action was identified.
