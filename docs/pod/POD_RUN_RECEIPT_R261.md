# POD run receipt r261 — actionable storage-cutoff mutations

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`d1a04035e9245932f8dc348dc8efdb3be10d10fe`; Money Factory started from
`5e6ba075f92dc4594f474f2b9dd213624ed57210`. The current completion,
implementation and free-deployment records, repository heads, relevant open pull
requests, workflow results and the authorized Render service were inspected. No
open pull request duplicated this POD lane; unrelated legacy/draft work remained
untouched. The failed database-administration route had no credible changed
access path and was not retried. No resource, credential, account, network rule
or marketplace state changed.

## Repair and regression evidence

The prior repair exposed the exact storage safety cutoff on authenticated owner
reads, but the eight authenticated mutation routes still collapsed
`POD_STORAGE_EXPIRING` into record-level HTTP 409 responses. The regression
reproduced artifact upload as HTTP 409 before the repair. Content Control PR 630
maps only that exact error to sanitized HTTP 503
`POD_STORAGE_UNAVAILABLE` for artifact upload, repair, review acceptance,
market/listing/financial evidence, concept intake and queue creation. Signature,
scope, validation, budget and record-state failures keep their existing redacted
HTTP 409 responses.

The exact tested Content Control tree was
`42589b298d5aa5d55c34838fa3843af891363fe6`. Local verification passed the
focused endpoint suite 21/21, the POD Node suite with 807 passed and 9 intentional
environment skips, router syntax, diff checks and workflow control. The local
Python discovery executed 266 tests but had two collection errors because this
executor lacked `cv2`; that is not recorded as a pass. Exact-head hosted
integration run 40218168882, job 121243740634, and production-container run
40218168898, job 121243740832, both passed with their pinned Python/OpenCV
runtime. The local production E2E had one explicit database-environment skip.

PR 630 merged as `cee750f1809927bb70355e6a4ef336a4ff4287a7` with the
same exact tested tree. Money Factory PR 217 advanced only the immutable
cross-repository pin to that merge. Local Money Factory verification passed 116
Node tests with one explicit PostgreSQL-environment skip and 81 Python tests.
Cross-repository run 40218867946, job 121245859760, passed. PR 217 merged as
`fb93ed8006c5a7781740108170d96a26b3ddc096` with exact tree
`ed55afbd9793817bfe398f63b18e14ec7db2143d`; both publication flags remained
false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`cee750f1809927bb70355e6a4ef336a4ff4287a7` as deploy
`dep-dbf44iajnfac73ec32g0`. Deploy-start event
`evt-dbf44i84cbqc73dqrbn0`, `pipeline_minutes_exhausted` event
`evt-dbf44ibsp5es73ch3vb0` and failed deploy event
`evt-dbf44imbs3rs73cga5p0` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf4880473hc739lqrq0` verifies that exact merge
`d8c499c4d13f1cc1255dca2f4a76b18fed455361` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair makes one configured
storage outage actionable at the authenticated HTTP mutation boundary; code and
hosted CI are not live storage, database, marketplace or deployment acceptance.
Restricted production database/schema/migrations, retained recovery, deployed
hybrid dependencies, mounted Money Factory authority and current
grants/revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
