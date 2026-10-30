# POD run receipt r366

Recorded: 2026-10-30 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Content Control started from `c4e988c4b02becb8db551ce5c47f048f32bddcc3`. That concurrent commit changed only `state/live-deployment-health.json` and was preserved.
- Money Factory started from the tested r365 pin `b63ecbd527a8cef67d3a88010dd052b8ddcf7b54`.

## Repaired contract

The KDP worker authenticated the signed cover and interior templates and verified the retained template archives, but later stages repeatedly re-read resolver-owned `task.templateSource` and `task.interior` fields after authority/database callbacks. A callback could therefore replace the cover archive, interior archive/template, manuscript, font, rights, license, book-details, or regional-rights paths after validation but before guide inspection, book packaging, or QA.

Regression-first evidence:

- Regression-only commit: `f8e8c2e54b74a9f0457b6058f4528e0abb2a1a67`.
- Expected failing integration run `40984742276`, job `123833008289`: 990 tests, 989 passed, and only `production binds verified KDP inputs before authority callbacks` failed because `replacement-cover-source.bin` reached the child-stage arguments.
- Initial repair commit: `88fd84023c401b5675075aa88bce07fc9e154aa6`.
- Its integration run `40984924055`, job `123833600179`, closed the substitution regression but correctly rejected two old executable interior getters before invocation. The old tests expected those getter side effects and were updated to assert zero invocation and fixed fail-closed behavior.
- Final PR head: `503b509349432b7a50d671fcd15d8c87d675f4ed`.

The worker now binds the complete resolver-authorized KDP template-source and interior input set through descriptor-safe data properties immediately after cover validation and before any authority/database callback. The immutable snapshot is reused for retained-source verification, cover/interior guide inspection, book packaging, reviewer inputs, and independent QA. Accessor- or Proxy-backed interior capabilities are rejected without invocation.

## Content Control exact-head verification

PR #864 was squash-merged as `82b4463391e83c4deaa4c6e50b159f3ac1ee5b14`.

- Integration run `40985130514`, job `123834265259`: success.
  - Node POD suite: 990/990 passed.
  - Python POD suite: 385 tests passed in 215.939 seconds.
  - Stored-task PostgreSQL/Python production E2E: 1/1 passed.
  - Server syntax, workflow controls, and four free-review guards passed.
  - Logs repeatedly confirmed both publication flags false.
- Production-container run `40985130488`, job `123834616556`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

## Money Factory authority pin

PR #321 changed only the immutable Content Control checkout ref and was squash-merged as `9b479899361e20adc46ef4392b9c964083c355f5`.

- Pinned Content Control ref: `82b4463391e83c4deaa4c6e50b159f3ac1ee5b14`.
- Cross-repository run `40985847012`, job `123836554625`: success.
- Pinned review/POD contracts: 643/643 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhv49nf3r2c738682ag`.
- Deploy started event: `evt-dbhv49ra9ulc73a8lkr0`.
- Fresh failure event: `evt-dbhv49psrkjs738bm6fg`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhv49psrkjs738bm6ig`; status failed.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` at blob `cda5ae58cc58562d686193093c4ab812939241b3` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- `POD_FREE_DEPLOYMENT.md` remained the deployment guide at blob `1d5b989a0c73e6d528502a613d6253ce439bd271`, not live-deployment proof.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
