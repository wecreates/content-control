# POD run receipt r288 — single-statement guarded reads

Date: 2026-10-26

## Scope and observed heads

- Content Control work began from `eda97489f9acdacbc9af4d2ea31e04d917a40325`.
- Money Factory work began from `cec822db44039c9621861a674081b2cabfa3c594`.
- Fresh open-PR and remote-head checks found no overlapping POD repair.
- Concurrent report commit `988c5a4a239d312362dd3c3472fee9d60c62a655`
  changed only the runtime dependency audit and was preserved.
- The completion checklist still leaves all 24 live acceptance areas open.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained false. Etsy was
  excluded. No marketplace publication or external provider write was made.

## Extended-query repair

[Content Control PR 709](https://github.com/wecreates/content-control/pull/709)
merged as `18a1a8d96231e2557ae23f73a948350b13124423`. Every shared
`PodDB.read` business statement now uses node-postgres extended-query protocol,
including parameterless reads. PostgreSQL therefore rejects multiple commands
inside one read call instead of allowing a simple-query `COMMIT` followed by a
second statement outside the helper's read-only transaction.

The regression-first focused suite failed on the prior helper because it passed
the business statement as a plain SQL string. After repair, its 11/11 tests and
the complete serial POD Node suite passed after a clean dependency install,
together with syntax and diff checks. The real PostgreSQL integration proves
that `COMMIT; UPDATE ...` is rejected with SQLSTATE `42601` and the protected
vault row remains unchanged. Hosted integration run `40397187442` and
production-container run `40397187485` both completed successfully on reviewed
head `50922d88` before the exact-head squash merge.

## Money Factory authority propagation

[Money Factory PR 243](https://github.com/wecreates/Money-factory/pull/243)
merged as `10ea78b27dc01423b5b05fff928dc1b63bfff801`. It pins the
cross-repository production review workflow to Content Control merge
`18a1a8d9`. Local verification against that tree passed every Node integration
test and 81/81 Python integration tests; generated KDP fixtures remained
`REVIEW_REQUIRED` with publication false. Hosted cross-repository verification
run `40398472854` completed successfully before the exact-head squash merge.

## Render deployment evidence

The authorized free Render service attempted Content Control merge `18a1a8d9`
as deploy `dep-dbfrn2142hec739qlqbg`. Event
`evt-dbfrn20bpr0c73e63fug` records pipeline-minutes exhaustion before a build
could run, and event `evt-dbfrn27qgbsc73fbojb0` records the deploy ending
failed. This is not live deployment acceptance and does not establish a
code-level build failure. No redundant manual deploy was started.

## Remaining boundaries

There was no credible changed database-administration access path, so the
previously failed connector/browser database action was not repeated. Live
database migration, durable live recovery, successful Render deployment,
external account/grant/rights evidence, authorized live market observations,
platform previews, independent human review, live remediation, measured live
capacity, financial reconciliation, end-to-end acceptance and controlled
launch remain open. Existing code and hosted test success are not treated as
live acceptance. No approval, clearance, marketplace result, revenue,
completion or continuously running self-hosted worker is claimed.
