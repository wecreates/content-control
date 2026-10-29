# POD run receipt r362

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Content Control started from the r361 receipt head `7be9dc7c11d5f6f69c985a6b991cbeb834077527`.
- Money Factory's unrelated monitoring commit `4b0f8f5778a432f25b9821454c691733992988d6` was preserved as the authority-pin base.

## Repaired contract

After task resolution the worker still read `task.stageWorkspace` directly when constructing child-process options and again when preparing independent QA. An accessor-backed workspace could therefore execute caller code inside the production coordinator before filesystem confinement was selected.

Regression-first evidence:

- Content Control branch base: `7be9dc7c11d5f6f69c985a6b991cbeb834077527`.
- Regression-only commit: `c56107998306ac91ff3461f4f76565b2928fc63f`.
- Expected failing integration run `40956518908`, job `123737922814`: 986 tests, 985 passed, and only `executable stage workspace capability is rejected without invoking accessors` failed. The getter ran once instead of zero times.
- Repaired PR head: `d011e4a23da8fe4a016a6d0bd9987392c9d1d557`.

The worker now reads `stageWorkspace` once through the existing descriptor-safe data-property boundary after rights validation. Accessor- and Proxy-backed capabilities are rejected without invocation, and the captured ordinary value is reused for every production and QA child stage.

## Content Control exact-head verification

PR #856 was squash-merged as `95013fa7af9e7f59fd96f95339c66adb43c6d173`.

- Integration run `40956718206`, job `123738592534`: success.
  - Node POD suite: 986/986 passed.
  - Python POD suite: 385 tests passed in 289.587 seconds.
  - Stored-task PostgreSQL/Python production E2E: 1/1 passed.
  - Server syntax, workflow control, and four free-review guards passed; publication remained false.
- Production-container run `40956718152`, job `123738727489`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

## Money Factory authority pin

PR #317 changed only the immutable Content Control checkout ref and was squash-merged as `902ba778f41eaa53b74714194533f80290886517`.

- Pin base preserved the unrelated monitoring head `4b0f8f5778a432f25b9821454c691733992988d6`.
- Pinned Content Control ref: `95013fa7af9e7f59fd96f95339c66adb43c6d173`.
- Cross-repository run `40957699875`, job `123741972306`: success.
- Pinned review/POD contracts: 639/639 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhrjfp7lnhs73dpbjeg`.
- Deploy started event: `evt-dbhrjfo4ohks738l2bgg`.
- Fresh failure event: `evt-dbhrjftro2as73bbh0j0`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhrjfo4ohks738l2big`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` at blob `cda5ae58cc58562d686193093c4ab812939241b3` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- `POD_FREE_DEPLOYMENT.md` remained the deployment guide, not live-deployment proof.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
