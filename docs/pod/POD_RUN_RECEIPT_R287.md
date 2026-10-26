# POD run receipt r287 — database-enforced read-only queries

Date: 2026-10-26

## Scope and observed heads

- Content Control work began from `09bbfb913fdd254afe0ca6fb4241063426976b00`.
- Money Factory work began from `194c60b4401b47fae50f9eb72b47be5f78f0ed03`.
- Fresh open-PR and remote-head checks found no overlapping POD repair.
- The completion checklist still leaves all 24 live acceptance areas open.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained false. Etsy was
  excluded. No marketplace publication or external provider write was made.

## Read-only transaction repair

[Content Control PR 707](https://github.com/wecreates/content-control/pull/707)
merged as `fcda4cff48cbe4d784c6cd1476d3729d94a41e3f`. Every shared
`PodDB.read` call now runs inside a PostgreSQL `BEGIN READ ONLY` transaction
with a transaction-local ten-second statement timeout. Storage retention is
rechecked after connection acquisition and each setup wait. Expiry and query
failures roll back; a client whose rollback fails is discarded while the
original read failure is preserved.

The regression-first read suite failed 5 of 10 tests on the prior code because
it issued only the business query and could not roll back. After repair, the
focused read/artifact/outbox/release/review suite and the complete serial POD
Node suite passed after a clean dependency install, together with syntax and
diff checks. The real PostgreSQL integration test additionally proves that an
`UPDATE` passed to the read helper is rejected with SQLSTATE `25006` and the
vault row remains unchanged. Hosted integration run `40393093458` and
production-container run `40393093316` both completed successfully on reviewed
head `03dca1dc` before the exact-head squash merge.

## Money Factory authority propagation

[Money Factory PR 242](https://github.com/wecreates/Money-factory/pull/242)
merged as `cec822db44039c9621861a674081b2cabfa3c594`. It pins the
cross-repository production review workflow to Content Control merge
`fcda4cff`. Local verification against that tree passed every Node integration
test and 81/81 Python integration tests; generated KDP fixtures remained
`REVIEW_REQUIRED` with publication false. Hosted cross-repository verification
run `40394380065` completed successfully before the exact-head squash merge.

## Render deployment evidence

The authorized free Render service attempted Content Control merge `fcda4cff`
as deploy `dep-dbfr9t7b9u1s739kqpb0`. Event
`evt-dbfr9t78gmes73ft316g` records pipeline-minutes exhaustion before a build
could run, and event `evt-dbfr9tcqcggc73c5dfng` records the deploy ending
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
