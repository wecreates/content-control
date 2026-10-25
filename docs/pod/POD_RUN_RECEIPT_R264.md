# POD run receipt r264 — state export asynchronous interlock

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`af54f68e37abe9269a630cbb1405f68ae11900fc`; Money Factory started from
`0722f1f52eb495cb9341587ffc77f30334f1917e`. The current completion,
implementation and free-deployment records, repository heads, relevant open pull
requests, workflow results and the authorized Render service were inspected. No
open pull request duplicated this POD repair. The failed database-administration
route had no credible changed access path and was not retried. No resource,
credential, account, network rule or marketplace state changed.

## Repair and regression evidence

The POD state snapshot exporter checked both publication kill switches only at
admission and near completion. If either switch changed during database
connection, the prior implementation still executed transaction setup, schema
inspection and the complete table scan before rejecting. If a switch changed
after a nonempty cursor fetch, it continued fetching and writing encrypted row
files before the final rejection. Four new regressions reproduced both races for
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` on the previous
implementation.

Content Control PR 639 adds a shared cancellation and publication checkpoint
after every asynchronous database and filesystem boundary: archive-directory
creation, database connection, transaction setup, schema inspection, cursor
declaration/fetch/close, encrypted record writes, read-only commit, encrypted
catalog write, directory identity and flush, and final re-authentication. A flag
change during connection now stops before database setup; a change during the
first nonempty fetch stops after one fetch and before creating `00000.pod`.
Rollback and connection release semantics remain unchanged.

The exact tested Content Control tree was
`560484b0be817a8cdb8dd4fda2592e9ca08ff628`. Focused state archive checks
passed 41/41. The full local POD Node suite passed 821 tests with 9 intentional
environment-gated skips and zero failures. Local Python discovery executed 266
tests but had two collection errors because this executor lacked `cv2`; that is
not recorded as a pass. Exact-head hosted integration run 40233110184, job
121288870175, and production-container run 40233110181, job 121288870172, both
passed with the pinned Python/OpenCV runtime, full Node/PostgreSQL checks,
durable review E2E and disabled-startup probe. Syntax and whitespace checks also
passed.

PR 639 merged as `72600a99deb22539044f860740532f0e291fa6d8` from the exact
tested PR head. Money Factory PR 220 advanced only the immutable cross-repository
pin to that merge. Local Money Factory verification passed 116 Node tests with
one explicit PostgreSQL-environment skip and 81 Python tests. Cross-repository
run 40233732863, job 121290739937, passed. PR 220 merged as
`aa2523df3e62cdef121180da91d54d18da8868f5` from exact tested tree
`695689fd4f755cd5156c4fc4d5da40ab6b52a6c6`; both publication flags remained
false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`72600a99deb22539044f860740532f0e291fa6d8` as deploy
`dep-dbf6t4lg1s2s73a1u0ng`. Deploy-start event
`evt-dbf6t4g4cbqc73dt1a4g`, `pipeline_minutes_exhausted` event
`evt-dbf6t4j4qb4c73a868dg` and failed deploy event
`evt-dbf6t4gs76nc739ltig0` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf70hu7bikc73btnf1g` verifies that exact merge
`eba015d5749044e0eb4f8a559a1d65cffce0f238` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair closes one state
recovery publication-interlock boundary; code and hosted CI are not live storage,
database, marketplace, reconciliation or deployment acceptance. Restricted
production database/schema/migrations, retained recovery, deployed hybrid
dependencies, mounted Money Factory authority and current grants/revocation,
real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
