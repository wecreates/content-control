# POD run receipt R399 — verified artifact insert boundary

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`07fc4ebd36b603f252775aad77bc8ce835946d82` and Money Factory
`98112d03b239d8857bf8a6fa4df2c547d6eaab7b`. Fresh main-head,
open-pull-request, workflow and authorized Render inspection found no active
POD/KDP implementation job to duplicate. Unrelated draft work and concurrent
main commits were left unchanged.

The checked acceptance registry still leaves all 24 live areas open. There was
no changed database-administration access path, so the previously unsuccessful
connector/browser route was not retried. This run did not access social-vault,
create a paid resource, contact a marketplace, include Etsy, or enable
production or publication.

## Confirmed defect and expected-red evidence

`ArtifactStore.putMany` awaited each PostgreSQL artifact insert but ignored
the returned mutation result, then returned the artifact hashes as durably
stored. A zero-row, multi-row, missing, executable or malformed result, or a
returned hash, media type or body digest that did not match the requested
immutable artifact, could therefore be represented as successful durable
storage.

The regression-only remote head
`67ffbfeaf5e0af0fdffed37889e2c6094834dfd2` reproduced the defect in
hosted POD integration run `41192592613`, job `124512224232`:
1,036 Node/PostgreSQL tests ran, 1,035 passed, and only
`artifact writes require a verified exact one-row durable insert` failed with
`Missing expected rejection`. That is expected-red evidence, not acceptance.

## Repair and verification

Content Control PR 933 changes the insert to return the stored hash, media type
and PostgreSQL-computed body SHA-256. Before reporting the artifact as durable,
the store now requires:

- an inert own-data `rowCount` equal to one;
- one ordinary, dense returned row;
- exactly the three enumerable own data fields `sha256`, `media_type` and
  `body_sha256`;
- exact identity, media type and body digest agreement with the requested
  immutable artifact.

Proxy, accessor, sparse, extra-field, zero-row, multi-row and mismatched results
fail with `ARTIFACT_INSERT_UNVERIFIED` without invoking their data traps.
Throwing inside the existing managed transaction preserves rollback behavior.
No marketplace or publication path was enabled.

Focused local artifact, operations, QA-process and production fixtures passed
151/151. The full local Node gate ran 1,036 tests: 1,027 passed, nine
PostgreSQL-environment cases skipped, and zero failed. The previously observed
broad local failure was traced to test doubles that did not model PostgreSQL
`RETURNING`; those affected fixtures were updated and are not counted as live
acceptance.

Final exact PR head
`fc597b9ab8405a09f6036be8ce7d930972eb07bd` passed integration run
`41193493258`, job `124514878720`: all 1,036 Node/PostgreSQL tests,
all 385 Python/OpenCV tests, stored-task production-to-durable-review E2E,
syntax, workflow-control and review-guard stages passed. Production-container
run `41193493306`, job `124514879176`, built the production image and passed
all 385 Python tests, all 1,036 Node/PostgreSQL tests, the real print/review E2E
and disabled-startup smoke.

PR 933 merged as `535603f7571d7a4eae7de0e1aca073ee3598ce67`.
Post-merge System Wiring Audit run `41193895711` passed. Post-merge POD
integration run `41193895727`, job `124516069640`, also passed every
Node/PostgreSQL, Python/OpenCV, stored-task E2E, syntax, workflow-control and
free-review guard stage.

## Money Factory authority pin

Money Factory PR 354 changes only the Content Control checkout pin to the exact
functional merge above. Exact pin head
`f0e98b782ce73fd990ec5773bc885d470a831dc9` passed cross-repository run
`41193926112`, job `124516158173`: all 672 pinned Node contracts; Python
groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 cases; all 121 bridge Node tests;
and all 81 bridge Python tests passed. Both `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained literal `false`. PR 354 merged as
`8e1b8e96d5c222fa868beb08735b8e41bccabc9c`.

## Render observation and execution limits

The authorized service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained active, auto-deploying from `main`,
unsuspended, Docker-based, one instance and on the existing free plan. Render
detected functional merge `535603f7571d7a4eae7de0e1aca073ee3598ce67` and
created deploy `dep-dbischjm8hqs73f572d0`. Event
`evt-dbischndnq4s73djejcg` recorded `pipeline_minutes_exhausted`, and
`evt-dbischjil8vc73a057lg` recorded the failed deploy. Execution stopped
before build or startup. No manual retry was made because the free pipeline
quota was the unchanged limiting condition. The merged code and hosted tests
are not live deployment acceptance.

This scheduled run used only the connectors and runner permissions actually
available during the run. It did not claim a continuously running self-hosted
worker, live provider credentials, live marketplace submission, database
reachability, revenue, rights clearance, independent review,
official-template acceptance or launch approval.

## Remaining acceptance truth

All 24 live acceptance areas remain **OPEN**. In particular, there is still no
successful live build/startup of this revision, independently retained
production backup, completed real-authority preflight, real owner account set,
current marketplace authorization/readback for all five in-scope adapters,
representative independent QA, measured 100/1,000 concept capacity, actual
financial statement reconciliation, end-to-end permitted submission, or
controlled launch. Publication remains held for explicit owner approval only
after those criteria are verified.
