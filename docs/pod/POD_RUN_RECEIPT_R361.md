# POD run receipt r361

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Four unrelated Content Control commits were preserved before this branch: `eeeb11f17e29ef13d107cc0aedd002ce227218aa`, `3c61639481ffcd9cee272a33e9b88968a67fd47d`, `50b357931573a455644e771ef7452d09b0dc85e4`, and `02f80a2d0b9c029517ae7cbe06e89a85fb99f4e3`.

## Repaired contract

After task resolution the worker still read `task.rights_verified` directly. An accessor-backed rights marker could therefore execute caller code and return true before the worker decided whether any production stage was authorized.

Regression-first evidence:

- Content Control branch base: `02f80a2d0b9c029517ae7cbe06e89a85fb99f4e3`.
- Regression-only commit: `8a68f8410f490894bf5419737f325b027132d963`.
- Expected failing integration run `40948223168`, job `123709091532`: 985 tests, 984 passed, and only `executable rights capability is rejected without invoking accessors` failed. The getter ran once instead of zero times.
- Repaired PR head: `67976c2f46664bf7eb24a56d93f1ae7385da584d`.

The worker now reads `rights_verified` through the existing descriptor-safe data-property boundary. Accessor-backed rights markers are rejected without invocation. An ordinary false or missing data value retains the existing `RIGHTS_BLOCKED` path, and the previously bound ordinary cleanup still runs for that later validation failure.

## Content Control exact-head verification

PR #854 was squash-merged as `e1ef6dc30d569ecea0069e4dff25d8b72f88da0d`.

- Integration run `40948520511`, job `123710123429`: success.
  - Node POD suite: 985/985 passed.
  - Python POD suite: 385 tests passed.
  - Stored task through real Python production to durable review hold and signed QA acceptance passed.
  - Server syntax, workflow control, and four free-review guards passed; workflow control reported `publication_enabled=false`.
- Production-container run `40948520701`, job `123710261082`: success.
  - Image build and non-root dependency checks passed.
  - Python QA/rendering and Node/PostgreSQL suites passed.
  - Real print generation and durable review flow passed.
  - Hosted startup smoke passed with publication and production disabled.

The regression-only container run was superseded after the regression was captured and is not counted as repaired-head evidence.

## Money Factory authority pin

PR #316 changed only the immutable Content Control checkout ref and was squash-merged as `2d1fa3fec8843797bb3e2d28ada9afea3333819a`.

- Pinned Content Control ref: `e1ef6dc30d569ecea0069e4dff25d8b72f88da0d`.
- Cross-repository run `40949610799`, job `123713931685`: success.
- Pinned review/POD contracts: 638/638 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial groups passed (34, 23, 40, 28, 28, 93, 5, 6, and 23 tests respectively).
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhqpjlckfvc73fsc070`.
- Deploy started event: `evt-dbhqpjn1f1fs73e45r5g`.
- Fresh failure event: `evt-dbhqpjh9q7ns73d8n6qg`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhqpjpiimcc73enh5rg`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` again returned empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`; this receipt records that evidence limitation without inferring status.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
