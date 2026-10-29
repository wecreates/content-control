# POD run receipt r364

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Content Control started from the r363 receipt head `eabf3cddc7f5ec9d4c549a5011e126a0be609830`.
- Money Factory started from the tested r363 authority pin `53385af06d3cdc1f7928daf670370b5eb06e4a12`.

## Repaired contract

The production worker verified `task.source`, `task.assetRights`, and `task.textLayers`, then re-read those mutable task fields (and `task.assetRoot`) after grant and database callbacks. A callback could therefore replace the verified paths before the asset generator or independent QA consumed them.

Regression-first evidence:

- Content Control branch base: `eabf3cddc7f5ec9d4c549a5011e126a0be609830`.
- Regression-only commit: `b992f3dab84a3d9bdd2f58bc2d696a6f9fd5d415`.
- Expected failing integration run `40969460869`, job `123782253180`: 988 tests, 987 passed, and only `production binds verified generation inputs before authority callbacks` failed because a replacement source path reached the child argv.
- Initial repair commit: `f8327845e0e18e67891e92b18a44b041ae25d52f`.
- The first repaired integration run `40969631800`, job `123782835450`, exposed one obsolete test that expected an executable source getter to run. The contract was tightened instead: accessor-backed source capability is now rejected without invocation.
- Final test-contract commit and PR head: `ce69b5a70ea52e3f41eb5226d5f218ef31f0d835`.

The worker now binds source, rights, text-layer, and asset-root values through the descriptor-safe data-property boundary before source-evidence verification and reuses those exact values for generation and QA. Invalid or executable capabilities fail closed as `TASK_GENERATION_INPUTS_INVALID`.

## Content Control exact-head verification

PR #860 was squash-merged as `16a08581900666f0fb1ae74c5576598d1b4272ba`.

- Integration run `40969828769`, job `123783508616`: success.
  - Node POD suite: 988/988 passed.
  - Python POD suite: 385 tests passed in 177.624 seconds.
  - Stored-task PostgreSQL/Python production E2E: 1/1 passed.
  - Server syntax, workflow control, and four free-review guards passed; publication remained false.
- Production-container run `40969828775`, job `123784048075`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

## Money Factory authority pin

PR #319 changed only the immutable Content Control checkout ref and was squash-merged as `92e534f078a86ca8768d921768e5cf270f85337d`.

- Pinned Content Control ref: `16a08581900666f0fb1ae74c5576598d1b4272ba`.
- Cross-repository run `40970856667`, job `123786931192`: success.
- Pinned review/POD contracts: 641/641 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbht316q1p3s73fpu100`.
- Deploy started event: `evt-dbht31ba9ulc73a7bgqg`.
- Fresh failure event: `evt-dbht31cqrhkc73b3rkgg`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbht31gllq2s73dnqafg`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` at blob `cda5ae58cc58562d686193093c4ab812939241b3` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- `POD_FREE_DEPLOYMENT.md` remained the deployment guide at blob `1d5b989a0c73e6d528502a613d6253ce439bd271`, not live-deployment proof.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
