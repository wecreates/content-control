# POD run receipt r262 — financial totals retention cutoff

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`7618235c6c3fa5c716eb69411ce0aa46124a657e`; Money Factory started from
`35efff1567a3632107ae7c0b0ced7c370df491c4`. The current completion,
implementation and free-deployment records, repository heads, relevant open pull
requests, workflow results and the authorized Render service were inspected. The
only open pull request matching POD text was unrelated Content Control draft PR
378, whose scope explicitly excludes POD changes; no open Money Factory pull
request matched this lane. The failed database-administration route had no
credible changed access path and was not retried. No resource, credential,
account, network rule or marketplace state changed.

## Repair and regression evidence

The exported `financialTotals` reader checked the configured storage lifetime
before its database query but not after the asynchronous wait. A query that
crossed the retention safety cutoff could therefore return reconciliation
aggregates after storage became unavailable. The new regression reproduced that
baseline result. Content Control PR 633 rechecks the same `PodDB.active()` cutoff
after the query and before releasing rows. The reader now fails with the existing
exact `POD_STORAGE_EXPIRING` condition instead of returning data across the
cutoff; its query and aggregate shape are otherwise unchanged.

The exact tested Content Control tree was
`41214ab91d3a7a67a9fbe2a3cc30e4496cd56699`. Focused storage, finance and
operations checks passed 28/28. The full local POD Node suite passed 808 tests
with 9 intentional environment-gated PostgreSQL skips and zero failures. The
local Python discovery executed 266 tests but had two collection errors because
this executor lacked `cv2`; that is not recorded as a pass. Exact-head hosted
integration run 40224390987, job 121262561108, and production-container run
40224390943, job 121262560731, both passed with the pinned Python/OpenCV runtime,
full Node/PostgreSQL checks, durable review E2E and disabled-startup probe.
Syntax and whitespace checks also passed.

PR 633 merged as `91b96ac8f9a6831be08d8018691af3639c52ca31`
with the same exact tested tree. Money Factory PR 218 advanced only the immutable
cross-repository pin to that merge. Local Money Factory verification passed 116
Node tests with one explicit PostgreSQL-environment skip and 81 Python tests.
Cross-repository run 40225019429, job 121264444494, passed. PR 218 merged as
`5685e4bfabd0ee8bc32b5681826dbc10455581d1` with exact tree
`e44f0da0dea14e9edfbec2877e4202dd906f11c0`; both publication flags remained
false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`91b96ac8f9a6831be08d8018691af3639c52ca31` as deploy
`dep-dbf596uk1f9s73fttnng`. Deploy-start event
`evt-dbf5973sp5es73ci2bkg`, `pipeline_minutes_exhausted` event
`evt-dbf59738vfls73920190` and failed deploy event
`evt-dbf5973phbkc73a77feg` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes one direct
financial-read retention boundary; code and hosted CI are not live storage,
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
