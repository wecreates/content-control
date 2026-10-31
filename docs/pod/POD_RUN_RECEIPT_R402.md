# POD run receipt R402 — verified artifact-restore mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`a41ca56ff8d14b4e3cdb5564924e565294bae5a2` and Money Factory
`92801a7e15c52aa5558068ecdcff26acd733a711`. Fresh main-head,
open-pull-request, workflow and authorized Render inspection found no active
POD/KDP implementation pull request to duplicate. Unrelated work was left
unchanged.

The current completion checklist still leaves all 24 live acceptance areas
open. There was no credible changed database-administration access path, so the
previously unsuccessful connector/browser route was not retried. This run did
not access social-vault, create a paid resource, contact a marketplace, include
Etsy, or enable production or publication.

## Confirmed defect and expected-red evidence

`restoreArtifactLibrary` awaited the recovered-artifact insert but ignored its
mutation result. A zero-row, malformed, executable or identity-mismatched
result could therefore be counted as a restored artifact even though the
database result did not prove the artifact write.

A focused regression was added before the repair. The isolated test
`artifact restore rejects unverified insert mutations` failed 1/1 with
`Missing expected rejection`. This is expected-red defect evidence, not live
acceptance.

## Repair and verification

Content Control PR 939 adds an exact recovery `RETURNING` contract for SHA-256,
media type, byte count and a database-computed body digest. Before counting an
artifact as restored, recovery now requires one inert ordinary returned row,
`rowCount === 1`, and exact matches for all four values. Missing, zero-row,
executable, malformed or mismatched results fail with
`ARCHIVE_QUERY_UNVERIFIED`; the existing managed transaction rolls back.

After repair, the focused regression passed 1/1 and the complete artifact
archive/recovery suite passed 60/60. The full local Node POD suite ran 1,039
tests: 1,030 passed, nine PostgreSQL-environment cases skipped, and zero
failed. `git diff --check` also passed.

Exact PR head `dbba1d5262babe42f98b72a9e059e77f30998fce` passed:

- POD integration run `41204470235`, job `124546631657`: all 1,039
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored-task production E2E,
  syntax, workflow-control and review guards;
- container run `41204470240`, job `124546631741`: production image build,
  all 385 Python tests, all 1,039 Node/PostgreSQL tests, real print/review E2E,
  non-root/dependency probes and disabled-startup smoke.

The two remote functional/test blobs matched the locally tested Git blob
identities before the PR was opened. PR 939 merged as
`5db4a56d404aafc084ce40ecb445f2d21bd8fc26`. Post-merge System Wiring
Audit run `41205025544` passed. Post-merge POD integration run
`41205025653`, job `124548250344`, also passed all 1,039 hosted
Node/PostgreSQL tests, all 385 Python/OpenCV tests and the remaining production
workflow guards.

## Money Factory authority pin

Money Factory PR 357 changed only the Content Control checkout pin to exact
functional merge `5db4a56d404aafc084ce40ecb445f2d21bd8fc26`. Both
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal
`false`.

Exact pin head `53b682b7b0c4a6a37b9b6fd44ab4ad3df2e852cb` passed
cross-repository run `41205140382`, job `124548574484`: all 673 pinned
Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests;
all 121 bridge Node tests; and all 81 bridge Python tests. PR 357 merged as
`babad085ee40a166c571603b063ed3fcbbd4b4fe`.

## Render observation and execution limits

The authorized service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) detected functional merge
`5db4a56d404aafc084ce40ecb445f2d21bd8fc26` and created deploy
`dep-dbiulkfavr4c73bfrmgg`. Event `evt-dbiulka9249c73853mb0`
recorded `pipeline_minutes_exhausted`; event
`evt-dbiulkiqphnc73dl8ql0` recorded the failed deploy. Execution stopped
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
successful live build/startup of this revision, separately retained production
backup, completed real-authority preflight, real owner account set, current
marketplace authorization/readback for all five in-scope adapters,
representative independent QA, measured 100/1,000 concept capacity, actual
financial statement reconciliation, end-to-end permitted submission, or
controlled launch.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false.
Publication remains held for explicit owner approval only after every
acceptance criterion is verified. The scheduled automation remains enabled
because completion has not been reached.
