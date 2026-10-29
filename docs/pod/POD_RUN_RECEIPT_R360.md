# POD run receipt r360

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Three unrelated Content Control commits were preserved before this branch: `2f0be9f2f756cd40d8651f3c547cc011595485e0`, `edabfe274a9107d0841a03f73c324320ccdf70b9`, and `e4f5e22fa6f7efb177cf7592d43d1ac84845d6d6`.

## Repaired contract

The production worker read `task.cleanup` twice after job settlement. An accessor-backed lifecycle capability could therefore run caller code outside the worker's snapshotted task contract, including after durable production state had already been decided.

Regression-first evidence:

- Content Control branch base: `e4f5e22fa6f7efb177cf7592d43d1ac84845d6d6`.
- Regression-only commit: `dab3458f7db30d878b029551ea527885ad2c2ae2`.
- Expected failing integration run `40938760061`, job `123676208019`: 984 tests, 983 passed, and only `executable cleanup capability is rejected without invoking accessors` failed. The getter ran twice instead of zero times.
- The first placement at `aeb9a6e1c4556ba497d241951be41b556308bf0c` correctly stopped the accessor but exposed an existing lifecycle requirement: run `40939087017`, job `123677347135` failed only because a later rights-validation failure no longer attempted its already resolved ordinary cleanup.
- Repaired PR head: `431c207a5b4d73b925602b6aaa842a8f8823abfa`.

The worker now snapshots cleanup through the existing descriptor-safe data-property boundary immediately after a non-null task resolves and before task validation or production callbacks. Accessor-backed cleanup is rejected without invocation. Ordinary cleanup remains receiver-bound, still runs after later rights-validation failure, and preserves the fixed `cleanup_failed` signal without replacing the durable job result.

## Content Control exact-head verification

PR #852 was squash-merged as `9ba570e48087665d8bed15fd5a1199d8e059afc1`.

- Integration run `40939440718`, job `123678600445`: success.
  - Node POD suite: 984/984 passed, including the new cleanup-capability regression and the existing cleanup-failure lifecycle contract.
  - Python POD suite: 385 tests passed.
  - Stored task through real Python production to durable review hold and signed QA acceptance: passed.
  - Server syntax, workflow control, and four free-review guards passed; workflow control reported `publication_enabled=false`.
- Production-container run `40939440691`, job `123679208886`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

The regression-only and superseded intermediate container runs are not counted as repaired-head evidence.

## Money Factory authority pin

PR #315 changed only the immutable Content Control checkout ref and was squash-merged as `afbbbc9506477475cdef5f602ffe042364565610`.

- Pinned Content Control ref: `9ba570e48087665d8bed15fd5a1199d8e059afc1`.
- Cross-repository run `40940683346`, job `123682951357`: success.
- Pinned review/POD contracts: 637/637 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhptgcs728c73dh9rs0`.
- Deploy started event: `evt-dbhptgkt50us739214k0`.
- Fresh failure event: `evt-dbhptgh40j4s73flit70`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhptgpiimcc73emkg70`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
