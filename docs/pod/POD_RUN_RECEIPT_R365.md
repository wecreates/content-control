# POD run receipt r365

Recorded: 2026-10-30 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Content Control started from the r364 receipt head `2d936aa6f5594a05ccfbd8dd359e0e3c97d6f6be`.
- Money Factory's tested r364 pin `92e534f078a86ca8768d921768e5cf270f85337d` was followed by the unrelated cadence commit `9be365e009ab5fe56a493fdad4a8574fcbd9451e`, which was preserved.

## Repaired contract

The production worker validated the signed cover at `task.template`, then re-read that mutable task field after an authority/database callback when launching the generator. A callback could therefore replace the validated template path before generation or independent QA consumed it.

Regression-first evidence:

- Content Control branch base: `2d936aa6f5594a05ccfbd8dd359e0e3c97d6f6be`.
- Regression-only commit: `34b376bf21272652683463eb3919a09e1eedd629`.
- Expected failing integration run `40979025290`, job `123814108104`: 989 tests, 988 passed, and only `production binds the verified template path before authority callbacks` failed because `replacement-template` reached the generator argv.
- Initial repair commit: `f84795f8c7baddb1bd1b254c3eda85f756235645`.
- Data-only template-capability test adjustment: `ac0c05d0b52b814972c4b6915d9b72e2d03058e0`.
- That first repaired integration run `40979160751`, job `123814576296`, exposed a diagnostic-order regression: executable template rejection masked a prior invalid rights signature.
- Final diagnostic-precedence repair and PR head: `e6778f124bf96b7bd9650835b1c4ab37da0a99cc`.

The worker now verifies source-rights evidence first, then binds the cover template path through the descriptor-safe data-property boundary before any authority callback can replace it. The same path is reused for signed-template validation, generation, and QA. Accessor-backed template capabilities are rejected without invocation, while invalid rights evidence still reports `SOURCE_RIGHTS_INVALID`.

## Concurrent work preservation

While PR #862 was testing, Content Control `main` advanced through free-watchdog and accepted-candidate evidence commits. The latest concurrent commit `03da5fe3ddb02a7d4d46aad9eecec23314cef7fa` changed only two rollback-ledger JSON files. It was inspected, found non-overlapping with the POD worker/test patch, and preserved under the squash merge.

## Content Control exact-head verification

PR #862 was squash-merged as `2192683747cf23cba91cbd780260e9a69dc87861`.

- Integration run `40979310049`, job `123815070826`: success.
  - Node POD suite: 989/989 passed.
  - Python POD suite: 385 tests passed in 221.595 seconds.
  - Stored-task PostgreSQL/Python production E2E: 1/1 passed.
  - Server syntax, workflow control, and four free-review guards passed; publication remained false.
- Production-container run `40979310065`, job `123815152475`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

## Money Factory authority pin

PR #320 changed only the immutable Content Control checkout ref and was squash-merged as `b63ecbd527a8cef67d3a88010dd052b8ddcf7b54`.

- Pinned Content Control ref: `2192683747cf23cba91cbd780260e9a69dc87861`.
- Cross-repository run `40980028595`, job `123817511241`: success.
- Pinned review/POD contracts: 642/642 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhu9o7f3r2c7385b4sg`.
- Deploy started event: `evt-dbhu9oce19vs73ddd69g`.
- Fresh failure event: `evt-dbhu9od7rh6s738lskkg`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhu9oba9ulc73a85610`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` at blob `cda5ae58cc58562d686193093c4ab812939241b3` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- `POD_FREE_DEPLOYMENT.md` remained the deployment guide at blob `1d5b989a0c73e6d528502a613d6253ce439bd271`, not live-deployment proof.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
