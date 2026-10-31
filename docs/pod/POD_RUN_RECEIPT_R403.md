# POD run receipt R403 — verified full-state restore mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`f6c6cb614cd1f1abd286df7d8454a1065af2d64d` and Money Factory
`9a6ef6165dd85ff081943e5459607ea421bca4ca`. The Money Factory head
included an unrelated `free monitor cadence tick` after the R402 pin; that
concurrent work was preserved. Fresh main-head, open-pull-request, workflow and
authorized Render inspection found no active POD/KDP implementation pull
request to duplicate.

The completion checklist still leaves all 24 live acceptance areas open. There
was no credible changed database-administration access path, so the previously
unsuccessful connector/browser route was not retried. This run did not access
social-vault, create a paid resource, contact a marketplace, include Etsy, or
enable production or publication.

## Confirmed defect and expected-red evidence

`restoreStateArchive` awaited every archived table insert and the final
`pod.recovery.restored` event insert but ignored their mutation results. A
zero-row, malformed, executable or mismatched database result could therefore
be reported as a successful full-state restore even though the database result
did not prove the restored row or recovery receipt.

A focused regression was added before the repair. Both subtests failed with
`Missing expected rejection`; Node reported three failing test nodes including
their parent. This is expected-red defect evidence, not live acceptance.

## Repair and verification

Content Control PR 941 restores each archived record through a single CTE that
inserts the authenticated source row and returns a bounded proof of exactly one
insert plus a typed-value equality check against that source. It separately
requires one inert recovery-event row with the generated event ID, exact
`pod.recovery.restored` kind and exact JSON payload. Zero-row, executable,
malformed or mismatched results now fail with
`STATE_ARCHIVE_QUERY_UNVERIFIED` inside the managed transaction.

After repair, the expanded focused regression passed 5/5. The full local Node
POD suite ran 1,044 tests: 1,035 passed, nine PostgreSQL-environment cases
skipped, and zero failed. `git diff --check` and the production module syntax
check also passed.

The first hosted head `3aa796f24104f0d0196c1cab6776c81d87b4fef4`
exposed one stale PostgreSQL race-test matcher. Integration run
`41208482383`, job `124558341926`, failed only because that fixture still
looked for an INSERT at the beginning of the SQL statement; the new statement
began with its verification CTE, so the intended archive corruption never
occurred and the test reported `Missing expected rejection`. Container run
`41208482351`, job `124558341942`, was cancelled after the amended head
superseded it. Neither superseded run is counted as acceptance.

The matcher was narrowed to the embedded fixed table insert without weakening
the production check. Exact amended head
`a582d5f9bcf266fe3989017cc12276de341642e2` passed:

- POD integration run `41208640507`, job `124558807900`: all 1,044
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored-task production
  E2E, syntax, workflow-control and review guards;
- container run `41208640510`, job `124558869163`: production image build,
  all 385 Python tests, all 1,044 Node/PostgreSQL tests, real print/review E2E,
  non-root/dependency probes and disabled-startup smoke.

PR 941 merged as `64b984276d7aecdf4e3b3e2ae7f360adbc6f3048`.
Post-merge System Wiring Audit run `41209163303`, job
`124560328834`, passed. Post-merge POD integration run
`41209163305`, job `124560328544`, also passed all 1,044 hosted
Node/PostgreSQL tests, all 385 Python/OpenCV tests and the remaining production
workflow guards.

## Money Factory authority pin

Money Factory PR 358 changed only the Content Control checkout pin to exact
functional merge `64b984276d7aecdf4e3b3e2ae7f360adbc6f3048`.
Both `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal
`false`; the unrelated monitor-cadence parent remained in history.

Exact pin head `555df4144cbceb017bb384c8a857a7381f09d285`
passed cross-repository run `41209228355`, job `124560525904`: all
678 pinned Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and
23 tests; all 121 bridge Node tests; and all 81 bridge Python tests. PR 358
merged as `ad870ef0a37c70aaa2c4946951b7b97fb4dd4ede`.

## Render observation and execution limits

The authorized service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected functional merge
`64b984276d7aecdf4e3b3e2ae7f360adbc6f3048` and created deploy
`dep-dbivf86q1p3s73a6n3mg`. Event `evt-dbivf8aqphnc73dlqs70`
recorded `pipeline_minutes_exhausted`; event
`evt-dbivf8ed4qjc73aic59g` recorded the failed deploy. Execution stopped
before build or startup. No manual retry was made because the free pipeline
quota was the unchanged limiting condition. Hosted CI success is not live
deployment acceptance.

This scheduled run used only the connectors and runner permissions actually
available during the run. It did not claim a continuously running self-hosted
worker, live provider credentials, marketplace submission, database
reachability, revenue, rights clearance, independent review,
official-template acceptance or launch approval.

## Remaining acceptance truth

All 24 live acceptance areas remain **OPEN**. In particular, there is still no
successful live build/startup of this revision, independently retained
production backup, completed real-authority preflight, real owner account set,
current marketplace authorization/readback for all five in-scope adapters,
representative independent QA, measured 100/1,000 concept capacity, actual
financial statement reconciliation, end-to-end permitted submission, or
controlled launch.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false.
Publication remains held for explicit owner approval only after every
acceptance criterion is verified. The scheduled automation remains enabled
because completion has not been reached.
