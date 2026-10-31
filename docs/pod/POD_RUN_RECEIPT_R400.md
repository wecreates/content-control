# POD run receipt R400 — verified listing reconciliation mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`feeffe2e2b4ad0cb30deae8a5667ba901d3710b3` and Money Factory
`8e1b8e96d5c222fa868beb08735b8e41bccabc9c`. Fresh main-head,
open-pull-request, workflow and authorized Render inspection found no active
POD/KDP implementation pull request to duplicate. Unrelated draft work was left
unchanged.

The current completion checklist still leaves all 24 live acceptance areas
open. There was no changed database-administration access path, so the
previously unsuccessful connector/browser route was not retried. This run did
not access social-vault, create a paid resource, contact a marketplace, include
Etsy, or enable production or publication.

## Confirmed defect and expected-red evidence

`reconcilePublication` awaited the PostgreSQL provider-inbox insert, queue
transition and publication-event insert, but ignored all three mutation
results. An inert zero-row or malformed result could therefore be represented
as durable observed-live evidence, a durable `published` state, or a durable
audit event even though the database result did not prove that write.

A focused regression was added before the repair. The old implementation ran
15 focused tests: 14 passed, and only
`listing reconciliation rejects unverified durable mutation results without
executing them` failed with `Missing expected rejection: INSERT INTO
pod_provider_inbox`. This is expected-red defect evidence, not live
acceptance.

## Repair and verification

Content Control PR 935 adds exact `RETURNING` contracts for each reconciliation
mutation. Before reporting success, it now requires one inert ordinary returned
row, `rowCount === 1`, exactly the expected enumerable data fields, and exact
identity/state agreement:

- provider, account, provider-event and evidence identities for the inbox row;
- job identity, `published` state, provider identity, cleared reason and
  cleared lease for the queue transition;
- generated event identity, job identity and `pod.published` kind for the
  audit event.

Proxy, accessor, missing, extra, zero-row, multi-row and mismatched results fail
with `LISTING_MUTATION_UNVERIFIED` without invoking data traps. The existing
managed transaction then rolls back the whole reconciliation.

After repair, the focused suite passed 15/15 and the affected suites passed
90/90. The full local Node POD suite ran 1,037 tests: 1,028 passed, nine
PostgreSQL-environment cases skipped, and zero failed. The local Python runner
passed 264 tests but lacked `cv2`, so its two OpenCV-dependent modules could not
be imported; that local limitation was not represented as a test pass.

Exact PR head `929d6087687623a6d50b95f7901746266d45dcfc` passed:

- POD integration run `41194840140`, job `124518823976`: all 1,037
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored-task
  production-to-durable-review E2E, syntax, workflow-control and review guards;
- container run `41194840132`, job `124518823928`: production image build,
  all 385 Python tests, all 1,037 Node/PostgreSQL tests, real print/review E2E
  and disabled-startup smoke.

All five remote functional/test blobs matched the locally tested Git blob
identities before the PR was opened. PR 935 merged as
`01cf9fa16bc3259372befda0107aceb4d0e35534`. Post-merge System Wiring
Audit run `41195331345` passed. Post-merge POD integration run
`41195331389`, job `124520242804`, also passed the complete hosted gate.

## Money Factory authority pin

Money Factory PR 355 changed only the Content Control checkout pin to exact
functional merge `01cf9fa16bc3259372befda0107aceb4d0e35534`. Both
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal
`false`.

Exact pin head `642ebce254965571378d1611ac36b90099805a5b` passed
cross-repository run `41195437867`, job `124520545582`: all 672 pinned
Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests;
all 121 bridge Node tests; and all 81 bridge Python tests. PR 355 merged as
`7aa5dc532f6e0baec5079b893b180f60901d3d30`.

## Render observation and execution limits

The authorized service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained unsuspended, Docker-based,
auto-deploying from `main`, one instance and on the existing free plan.
Render detected functional merge
`01cf9fa16bc3259372befda0107aceb4d0e35534` and created deploy
`dep-dbismg15efls73dca2ig`. Event
`evt-dbismg5h3lcs7380l0bg` recorded `pipeline_minutes_exhausted`;
`evt-dbismg0gbm7c73fciq30` recorded the failed deploy. Execution stopped
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
