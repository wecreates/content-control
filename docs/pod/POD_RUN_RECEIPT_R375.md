# POD run receipt R375 — require authority before queue claims

Date: 2026-10-30 America/Los_Angeles

## Scope

This run hardened the production queue boundary without enabling production or
publication. Direct `produceOnce` execution previously validated durable
database endpoints before a claim but did not require the host grant resolver,
task resolver, or signing key until after durable queue work could be claimed.

Content Control now requires callable grant and task resolvers plus a string
signing key of at least 32 bytes after storage/database validation and before the
first queue claim. Incomplete authority fails with
`PRODUCTION_AUTHORITY_UNVERIFIED` without creating a lease. Existing disabled,
abort, storage-budget, and database error precedence remains intact. No provider
adapter, publication path, database migration, network rule, credential, paid
resource, or database administration changed.

## Regression and repair evidence

- Regression commit: `aa6df564f746e0c1931ced52f786c7ff2bb6a9f0`
- Expected-red integration run/job: `41040298026` / `124011152441`
  - 999 Node tests, 998 passed
  - the only failure was the new pre-claim authority regression
- Runtime repair commit: `0a10f567b735555677fa63581567d9f36cfd4b79`
- Repaired branch head: `a535a11637a2d8817fac9a20ba5a13594715da69`
- Passing integration run/job: `41040498415` / `124011831610`
  - 999/999 Node tests
  - 385 Python tests
  - one production E2E test
  - syntax/workflow validation and four free-resource guards
- Passing container run/job: `41040497930` / `124011809083`
  - image build, non-root and offline dependency checks
  - 385 Python and 999 Node/PostgreSQL tests
  - real print generation, durable review, and disabled hosted startup
- Content Control PR: #885
- Functional merge: `78b2a616b2c7b2fd43eb0d48c625cf072acb21e9`

## Money Factory exact-head pin

- Money Factory PR: #330
- Pin branch head: `0c5a89a3d5902f56b88585e6ca146241d84828dc`
- Cross-repository run/job: `41041224149` / `124014235657`
  - 646/646 pinned Content Control contracts
  - all nine Python verification groups passed
  - 121/121 bridge tests
  - 81/81 adapter tests
  - `PUBLICATION_ENABLED=false`
  - `POD_PUBLICATION_ENABLED=false`
- Money Factory merge: `251091004247f629c8e29e0b095828bb1068cf95`
- Pinned Content Control commit:
  `78b2a616b2c7b2fd43eb0d48c625cf072acb21e9`

## Render observation

The authorized free service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected the functional merge.

- Deploy: `dep-dbi73997lnhs73e68j0g`
- Start event: `evt-dbi739f0bdec73dsvveg`
- Pipeline event: `evt-dbi739if2vlc73dvggs0`
- End event: `evt-dbi739mh2hjs73botpf0`
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
