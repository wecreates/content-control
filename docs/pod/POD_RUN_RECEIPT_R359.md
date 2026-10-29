# POD run receipt r359

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.
- Two concurrent non-POD Content Control commits were preserved before this branch: `87b470adb3859968128b92a14917c84286513452` and `2e0701f529feeed52367b210aeb0956955cb25f2`.

## Repaired contract

The production worker validated the independent reviewer response but still read the resolver-provided `reviewPackage` capability directly after package persistence. An accessor-backed capability therefore executed caller code before the worker decided between independent QA and a durable review hold.

Regression-first evidence:

- Content Control branch base: `2e0701f529feeed52367b210aeb0956955cb25f2`.
- Regression-only commit: `57f8720a96e3228963838f57b750ec7d569d923d`.
- Expected failing integration run `40927426921`, job `123636560888`: 983 tests, 982 passed, and only `executable reviewer capability is rejected without invoking accessors` failed because the getter ran once instead of zero times.
- Repaired PR head: `adb4f46ed8d01fe7cecfcdbb2da9e405604ffb13`.

The worker now reads `reviewPackage` through the existing descriptor-safe capability boundary. Proxy- or accessor-backed descriptors are rejected without invocation. An absent or ordinary non-function data value retains the existing durable review-hold path; an ordinary function remains receiver-bound to the task. Publication controls are unchanged.

## Content Control exact-head verification

PR #850 was squash-merged as `36a8f84335251e9e51e9d9c76827d5bec84a3fd4`.

- Integration run `40927653563`, job `123637344712`: success.
  - Node POD suite: 983/983 passed, including the new reviewer-capability accessor regression.
  - Python POD suite: 385 tests passed.
  - Stored task through real Python production to durable review hold and signed QA acceptance: passed.
  - Server syntax, workflow control, and free-review guards: passed; workflow control reported `publication_enabled=false`.
- Production-container run `40927653701`, job `123638141406`: success.
  - Image build and non-root dependency checks: passed.
  - Python QA/rendering and Node/PostgreSQL suites: passed.
  - Real print generation and durable review flow: passed.
  - Hosted startup smoke passed with publication and production disabled.

The regression-only container run `40927426857` was superseded and cancelled after the regression was captured; it is not counted as repaired-head evidence.

## Money Factory authority pin

PR #314 changed only the immutable Content Control checkout ref and was squash-merged as `cc0fe193ea6a429b14e8ebe8ef97059e53141284`.

- Pinned Content Control ref: `36a8f84335251e9e51e9d9c76827d5bec84a3fd4`.
- Cross-repository run `40928704180`, job `123641063689`: success.
- Pinned review/POD contracts: 636/636 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial suites: passed.
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; generated packages remained `REVIEW_REQUIRED` and not marketplace-ready.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhop9lckfvc73fovg10`.
- Deploy started event: `evt-dbhop9hbgsac73bhb9gg`.
- Fresh failure event: `evt-dbhop9kt50us7390rbug`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhop9p9q7ns73d6m9o0`; status `build_failed`.
- The functional commit did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` was again unreadable through the GitHub connector (empty content at blob `cce7888a8ea54ff5d4c06429371978be8a379914`); this receipt records that evidence limitation without inferring status.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
