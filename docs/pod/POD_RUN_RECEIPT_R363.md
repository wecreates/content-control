# POD run receipt r363

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Content Control started from the r362 receipt head `a9c2e78bd50125ab7b452cfb42cef3125e40b0e8`.
- Money Factory started from the tested r362 authority pin `902ba778f41eaa53b74714194533f80290886517`.

## Repaired contract

The production worker still spread `task.templateScope` directly before signed-template validation. An accessor-backed scope could therefore execute resolver-controlled code, while nested accessors or a Proxy could supply scope fields dynamically rather than as bounded plain data.

Regression-first evidence:

- Content Control branch base: `a9c2e78bd50125ab7b452cfb42cef3125e40b0e8`.
- Regression-only commit: `dce2c8e5e43decd72d0c3cc3b4fb58e24f413da1`.
- Expected failing integration run `40961712498`, job `123755892281`: 987 tests, 986 passed, and only `executable template scope capability is rejected without invoking accessors` failed. The getter ran once instead of zero times.
- Repaired PR head: `28acba1c1b2c54507585b92a3df76059eb35c2fd`.

The worker now reads `templateScope` through the descriptor-safe data-property boundary and applies the existing bounded plain-data snapshot before reading any scope fields. Accessor- and Proxy-backed scopes are rejected without invocation; the job's platform remains authoritative.

## Content Control exact-head verification

PR #858 was squash-merged as `caad7e6d27598678a27ca4ebb1d576216e24c9e1`.

- Integration run `40961896653`, job `123756541504`: success.
  - Node POD suite: 987/987 passed.
  - Python POD suite: 385 tests passed in 172.965 seconds.
  - Stored-task PostgreSQL/Python production E2E: 1/1 passed.
  - Server syntax, workflow control, and four free-review guards passed; publication remained false.
- Production-container run `40961896586`, job `123756609494`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

## Money Factory authority pin

PR #318 changed only the immutable Content Control checkout ref and was squash-merged as `53385af06d3cdc1f7928daf670370b5eb06e4a12`.

- Pinned Content Control ref: `caad7e6d27598678a27ca4ebb1d576216e24c9e1`.
- Cross-repository run `40962898609`, job `123759975887`: success.
- Pinned review/POD contracts: 640/640 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhs5dcs728c73d45kgg`.
- Deploy started event: `evt-dbhs5dba9ulc73a6krig`.
- Fresh failure event: `evt-dbhs5dd7rh6s738kb5dg`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhs5dl2kvus73cnn5pg`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` at blob `cda5ae58cc58562d686193093c4ab812939241b3` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- `POD_FREE_DEPLOYMENT.md` remained the deployment guide at blob `1d5b989a0c73e6d528502a613d6253ce439bd271`, not live-deployment proof.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
