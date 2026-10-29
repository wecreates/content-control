# POD run receipt r358

Recorded: 2026-10-29 UTC

## Scope and safety

- Lane: Amazon KDP/POD integration across `wecreates/content-control` and `wecreates/Money-factory`; Etsy excluded.
- `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained fail-closed.
- No publication, purchase, paid infrastructure, message, credential disclosure, network widening, or database administration was attempted.
- The prior database-administration access path had not changed, so it was not retried.

## Repaired contract

The independent `reviewPackage` result previously reached QA without a data-only boundary. A Proxy or accessor-backed `rights`, `competitive`, or `editorial` field could execute caller code and supply a late value to QA.

Regression-first evidence:

- Content Control branch head before the repair: `13a8577f327144acdcf96f60dff749ed744467af`.
- Regression-only commit: `beeeecf2f65e61f5575f89e9ba3ac8984adb5034`.
- Expected failing integration run `40911603632`, job `123580741349`: 982 tests, 981 passed, and only `executable reviewer attestation is rejected without invoking accessors` failed because the getter ran.
- Repaired PR head: `95699d6388e2632c079c19a9e8cfb44b17d3f992`.

The worker now snapshots the reviewer response through the existing data-only snapshot boundary, admits only plain bounded `rights`, `competitive`, and optional `editorial` strings, freezes the result, and returns fixed `REVIEW_ATTESTATION_INVALID` handling for executable or malformed shapes. QA receives only that immutable snapshot. Live stop checks remain in place.

## Content Control exact-head verification

PR #848 was squash-merged as `1ce5eccef2d92cbae4d97ce23cb9f834d0a560fc`.

- Integration run `40911846754`, job `123581602623`: success.
  - Node POD suite: 982/982 passed, including the new accessor isolation regression.
  - Python POD suite: 385 tests passed.
  - Stored task through real Python production to durable review hold and signed QA acceptance: passed.
  - Server syntax, workflow control, and free-review guards: passed; workflow control reported `publication_enabled=false`.
- Production-container run `40911846129`, job `123582379185`: success.
  - Image build and non-root dependency checks: passed.
  - Python QA/rendering and Node/PostgreSQL suites: passed; Node 982/982.
  - Real print generation and durable review flow: passed.
  - Hosted startup smoke reported `publication_enabled=false`, `production_status=DISABLED`, and `outbox_status=DISABLED`.

## Money Factory authority pin

PR #313 changed only the immutable Content Control checkout ref and was squash-merged as `cf3f42533a8d4be15bd93c02f0e284155a2afe96`.

- Pinned Content Control ref: `1ce5eccef2d92cbae4d97ce23cb9f834d0a560fc`.
- Cross-repository run `40913231141`, job `123586518710`: success.
- Pinned review/POD contracts: 635/635 passed.
- Strict evidence, review export, recovery, binary I/O, raster, book bounds, font rights, official template, and KDP metadata/editorial suites: passed.
- Money Factory bridge: 121/121 passed.
- Final Python adapter suite: 81 tests passed.
- Logs repeatedly confirmed `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; generated packages remained `REVIEW_REQUIRED` and not marketplace-ready.

## Authorized Render workspace

Workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`):

- Active, not suspended, free Docker service, one instance, auto-deploying from `main`.
- Exact functional commit deploy: `dep-dbhnbuavcj2c738cifv0`.
- Deploy started event: `evt-dbhnbuprl4tc739mrnu0`.
- Fresh failure event: `evt-dbhnbupiimcc73ejrs8g`, `pipeline_minutes_exhausted`.
- Deploy ended event: `evt-dbhnbv1iimcc73ejrsfg`; status `build_failed`.
- The functional commit therefore did not reach a build or live acceptance. This is deployment evidence, not proof of runtime completion.

## Acceptance and limitations

- `POD_COMPLETION_CHECKLIST.md` still contains 24 acceptance rows and all 24 remain open pending live evidence.
- Existing code and passing repository tests are not counted as live acceptance.
- `POD_IMPLEMENTATION_STATUS.md` was again unreadable through the GitHub connector (empty content at blob `cce7888...`); this receipt records that evidence limitation without inferring status.
- No changed database-administration path appeared.
- Render remains blocked before build by exhausted free pipeline minutes.
- Publication remains disabled and controlled launch is not ready.
