# POD run receipt r356 — task evaluator authority snapshot

Date: 2026-10-29  
Acceptance state: **0 of 24 areas live-accepted; 24 remain open**  
Publication state: **disabled** (`PUBLICATION_ENABLED=false`, `POD_PUBLICATION_ENABLED=false`)  
Etsy: excluded

## Change delivered

Content Control functional merge `deace941f1317a399c9e4caa0e2b274aa523e9ac` (PR #844) snapshots each production task's bounded, data-only visual and editorial evaluator allowlists before any caller-owned review callback runs. QA child arguments now use those immutable snapshots. Missing lists resolve to empty arrays; `null`, Proxy/accessor-backed, malformed, oversized, or invalid-ID lists fail closed.

This closes a concrete time-of-check/time-of-use defect: an independent review callback could previously replace `task.approvedEvaluators` or `task.approvedEditorialEvaluators` before the worker constructed QA arguments, thereby self-authorizing replacement evaluator identities.

The branch started from then-current Content Control main `3c48a96136d7e4ee20c4304368c8a14039c38e82`, preserving the concurrent commits `a30871f0610f470451b4ee4c612254f2f69221ef` and `3c48a96136d7e4ee20c4304368c8a14039c38e82`.

## Regression and exact-head verification

- Regression-only commit: `ad63b52dbda9cd21a5ddb9ceb9da0e956f82e067`.
- Expected failing integration run: `40895819679`, job `123524496305`: 980 tests, 979 passed, 1 failed. The replacement visual evaluator was observed where `trusted-visual` was required.
- Tested repaired PR head: `1952edda8bcfabf43be40727939ac0124a9b3cc1`.
- Content Control integration run `40896065164`, job `123526196077`: success; 980/980 Node tests plus 385 Python/OpenCV/rendering checks and PostgreSQL/end-to-end/workflow guards.
- Content Control container run `40896064927`, job `123525729028`: success; startup reported `publication_enabled:false`, `production_status:DISABLED`, and `outbox_status:DISABLED`.

## Money Factory authority pin

Money Factory PR #311 was exact-head verified and squash-merged as `91b5c8d7606ef657e012eb08af0e5355ff017d92`. Its workflow now pins Content Control `deace941f1317a399c9e4caa0e2b274aa523e9ac`.

Cross-repository run `40897435853`, job `123530270744`, completed successfully on pin head `40c1018ef4867663829bb49e3826c6490855d706`:

- 633/633 Node tests;
- Python suites of 34, 23, 40, 28, 28, 93, 5, 6, 23, and 81 tests;
- 121/121 Node/PostgreSQL bridge tests;
- KDP package remained `REVIEW_REQUIRED`, `marketplace_ready:false`, `production_ready:false`, and `publication_enabled:false`;
- both publication environment gates remained literal `false`.

## Render observation

Authorized service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains active, unsuspended, on the free plan, Docker runtime, one instance, and auto-deploys `main`.

Render detected functional merge `deace941f1317a399c9e4caa0e2b274aa523e9ac` as deploy `dep-dbhlvms9v7es73bh5n2g`, but the build failed before deployment because free pipeline minutes were exhausted:

- deploy started: `evt-dbhlvn19q7ns73d3k1f0`;
- pipeline minutes exhausted: `evt-dbhlvn940j4s73fh9dt0`;
- deploy ended failed: `evt-dbhlvnv1f1fs73dv32g0`.

The functional merge is therefore **not live-accepted on Render**. No paid capacity was purchased and no publication control was enabled.

## Acceptance and limitations

All 24 acceptance areas remain open because repository tests and implementation are not proof of live end-to-end acceptance. Current live gaps include dedicated production database administration, durable recovery drills, authorized marketplace account evidence, independent production QA, official platform previews, financial reconciliation using real authorized records, measured live capacity, and controlled launch approval.

The prior database-administration path still has no credible changed access path, so it was not retried. The large `POD_IMPLEMENTATION_STATUS.md` continued to return empty file content through the connector; the current checklist and deployment guide were readable and governed this run. No credentials, paid resources, messages, bot-evasion, widened network access, or fabricated approvals were used. There is no new essential user-only action identified by this run.
