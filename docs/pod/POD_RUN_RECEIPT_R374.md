# POD run receipt R374 — reject executable production options

Date: 2026-10-30 America/Los_Angeles

## Scope

This run hardened the production-worker input boundary without enabling production
or publication. `produceOnce` previously destructured caller-owned options in
its function signature, so getters or proxy traps for database, resolver,
upstream-key, root, environment, or signal fields could execute before disabled
state and durable database checks.

Content Control now descriptor-checks all seven option fields — `db`,
`resolveTask`, `resolveGrant`, `upstreamKey`, `root`, `env`, and
`signal` — before reading their values. Accessor-backed or proxy-backed
options fail with `PRODUCTION_OPTIONS_UNVERIFIED` without invoking caller code.
No provider adapter, publication path, database migration, network rule,
credential, paid resource, or database administration changed.

## Regression and repair evidence

- Regression commit: `0cf494b50e95cd031505175960551449b2545181`
- Expected-red integration run/job: `41030924981` / `123980202132`
  - 998 Node tests, 997 passed
  - the only failure was the new production-options boundary regression
- Runtime repair and exact repaired branch head:
  `0c4cb2d12d8c9aeafee87e954e833342e58bd6b0`
- Passing integration run/job: `41031085063` / `123980718872`
  - 998/998 Node tests
  - 385 Python tests
  - one production E2E test
  - syntax/workflow validation and four free-resource guards
- Passing container run/job: `41031085085` / `123980763385`
  - image build, non-root and offline dependency checks
  - 385 Python and 998 Node/PostgreSQL tests
  - real print generation, durable review, and disabled hosted startup
- Content Control PR: #883
- Functional merge: `46a71a5e4fe88a698e64cf88aeddc6b06ac2c124`

## Money Factory exact-head pin

- Money Factory PR: #329
- Pin branch head: `133ec0f794c4a08fc84c8b88834c91e39a7500f7`
- Cross-repository run/job: `41031939285` / `123983484037`
  - 646/646 pinned Content Control contracts
  - all nine Python verification groups passed
  - 121/121 bridge tests
  - 81/81 adapter tests
  - `PUBLICATION_ENABLED=false`
  - `POD_PUBLICATION_ENABLED=false`
- Money Factory merge: `96edf9e93987542e92b8fb7fbd1da1225a009dac`
- Pinned Content Control commit:
  `46a71a5e4fe88a698e64cf88aeddc6b06ac2c124`

## Render observation

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected the functional merge.

- Deploy: `dep-dbi5viivcj2c73c7022g`
- Start event: `evt-dbi5viif2vlc73dumr1g`
- Pipeline event: `evt-dbi5viv23o6c73eqraug`
- End event: `evt-dbi5vioq2hqs73ac1mp0`
- Result: `build_failed` before application build because free pipeline minutes
  remain exhausted.

This is deployment-attempt evidence, not live deployment acceptance. No manual
retry, plan change, purchase, replacement service, widened access, or database
administration was attempted.

## Remaining acceptance state

All 24 live-acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain open.
`POD_IMPLEMENTATION_STATUS.md` remains intentionally empty. Existing code and
synthetic CI are not proof of production database migration, live provider
acceptance, financial reconciliation, measured live capacity, or controlled
launch readiness. Publication and POD publication remain disabled pending
explicit owner approval.
