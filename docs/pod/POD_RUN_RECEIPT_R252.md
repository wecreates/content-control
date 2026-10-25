# POD run receipt r252 — lossless production scope identities

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`96b694cfdf2fb4e34dc6d052505ab77afc06fdb5`; Money Factory started from
`cfe611529a053ae789251abc0ab88dbbddc5f7c8`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

Money Factory already rejected lossy job, account and business identities before
issuing a grant, but Content Control's signed grant consumer checked only
truthiness and equality. Matching malformed values could therefore authorize a
brief and later fail or change at PostgreSQL, JSON or adapter boundaries. This
was a defense-in-depth gap for authenticated data; no invalid live grant or
publication is claimed.

[Content Control PR 602](https://github.com/wecreates/content-control/pull/602)
independently requires all three production-scope identities to be bounded,
nonblank, NUL-free primitive strings that round-trip through UTF-8 exactly.
Valid Unicode, combining marks and surrounding whitespace remain exact without
normalization or repair.

The regression-first focused run passed 29 of 30 tests and failed because a
matching whitespace-only job identity was accepted. After repair, the combined
policy, claim-evidence, authority-expiry and mode-type suites passed 49/49. The
complete local POD Node suite ran 749 tests: 740 passed, nine intentional
environment-gated tests skipped and zero failed. Exact-head
[integration run 40179941131](https://github.com/wecreates/content-control/actions/runs/40179941131),
job `121128652142`, and
[production-container run 40179941091](https://github.com/wecreates/content-control/actions/runs/40179941091),
job `121128651929`, completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`291eff9f7c9c59bc26bb9b030538af423533bded`; its tree
`d3da2a99eda574fb51ccd944e32638f201ba8679` matched the locally tested tree.
PR 602 merged as `5aa9688239989183fa4c05b3150760435c2e9f7e`, whose merge tree remained
exactly `d3da2a99eda574fb51ccd944e32638f201ba8679`.

[Money Factory PR 208](https://github.com/wecreates/Money-factory/pull/208)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification ran 117 Node tests: 116 passed, one intentional skip and
zero failed; its Python suite passed 81/81. Exact tested head
`88a4d8b1fdbfd2604f50f68ab890e8eddc8ef8d4` and tree
`a84a50a5b322b6452b7091316cac5b8c6464edc3` passed
[cross-repository run 40180485044](https://github.com/wecreates/Money-factory/actions/runs/40180485044),
job `121130298370`, including pinned contracts, recovery, rights, templates,
KDP/editorial, Node, Python and bridge stages. PR 208 merged as
`8ddd1ada9714fb72c4582e5e5aa5945853fe29ad`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbeskljbc2fs738hsc00`. Deploy-start event
`evt-dbesklgs76nc739dv3ug` bound exact commit
`5aa9688239989183fa4c05b3150760435c2e9f7e`. Event
`evt-dbesklj8vfls738r8sdg` reported `pipeline_minutes_exhausted`, and event
`evt-dbeskljsp5es73cbeipg` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authenticated
production-scope identity boundary only; code and hosted CI are not live source
authorization, database, marketplace or deployment acceptance. Production
restricted database/schema/migrations, retained recovery and expiry resolution,
deployed hybrid dependencies, mounted Money Factory authority and current
grants/revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider-statement reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
