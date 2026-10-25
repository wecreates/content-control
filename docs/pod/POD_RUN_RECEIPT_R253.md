# POD run receipt r253 — bounded queue admission scope

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`120db3ae2bd24112823932565ee69a72ae22de05`; Money Factory started from
`8ddd1ada9714fb72c4582e5e5aa5945853fe29ad`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

Content Control authenticated the current grant and enforced its production
brief before queueing, but passed the queue-only concept identity and revision
to PostgreSQL without local shape validation. Malformed or coercible values
could therefore reach database casts and idempotency hashing, producing a
database-dependent rejection or a different identity. This was an admission-
boundary gap; no invalid live queue record or publication is claimed.

[Content Control PR 605](https://github.com/wecreates/content-control/pull/605)
requires the concept identity to be bounded, nonblank, NUL-free primitive text
that round-trips through UTF-8 exactly, and the revision to be an exact positive
integer no larger than PostgreSQL `int4` maximum 2147483647. These checks run
after signature and grant-scope verification but before connection acquisition,
so malformed queue scope cannot mask an invalid signature or reach PostgreSQL.

The regression-first focused suite ran 22 tests: three existing-valid/order
cases passed and 19 malformed concept/revision cases failed because they reached
the transaction hook. After repair, all 22 passed with zero database access for
invalid scope. The complete local POD Node suite ran 771 tests: 762 passed, nine
intentional environment-gated tests skipped and zero failed. Exact-head
[integration run 40181390327](https://github.com/wecreates/content-control/actions/runs/40181390327),
job `121133018648`, and
[production-container run 40181390296](https://github.com/wecreates/content-control/actions/runs/40181390296),
job `121133018719`, completed successfully. The hosted gates installed the
pinned Python/OpenCV dependencies, exercised PostgreSQL, built the production
image and passed Python, Node, print/review and publication-disabled startup.

The exact Content Control head was
`e6168ff048edbd5a944aadd2bf88d2481eb8b9e4`; its tree
`ede59aaf03c1a89e022e7e7633fa9859024542e6` matched the locally tested tree.
PR 605 merged as `29f06b0c5d049c26f44e8b32615d7b39de1aa2ef`, whose merge tree remained
exactly `ede59aaf03c1a89e022e7e7633fa9859024542e6`.

[Money Factory PR 209](https://github.com/wecreates/Money-factory/pull/209)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification ran 117 Node tests: 116 passed, one intentional database
skip and zero failed; its Python suite passed 81/81. Exact tested head
`9d895b9e7cf824e761904022f27bfe57d87c6083` and tree
`231b347d0042e82a021c4e10303eb61eb196d020` passed
[cross-repository run 40181913073](https://github.com/wecreates/Money-factory/actions/runs/40181913073),
job `121134563077`, including pinned contracts, recovery, rights, templates,
KDP/editorial, Node, Python and bridge stages. PR 209 merged as
`7cb40300ac9347cef697d9bd5f1fd8adc6b4c6b0`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbesue6q1p3s73eip310`. Deploy-start event
`evt-dbesue3sp5es73cbkkdg` bound exact commit
`29f06b0c5d049c26f44e8b32615d7b39de1aa2ef`. Event
`evt-dbesue6bs3rs73caq22g` reported `pipeline_minutes_exhausted`, and event
`evt-dbesueebs3rs73caq26g` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one queue-admission
boundary only; code and hosted CI are not live source authorization, database,
marketplace or deployment acceptance. Production restricted database/schema/
migrations, retained recovery and expiry resolution, deployed hybrid
dependencies, mounted Money Factory authority and current grants/revocation,
real accounts/sources/rights/templates/reviewers, authorized KDP/Redbubble/
TeePublic/Zazzle/Spreadshirt adapters, actual economics and provider-statement
reconciliation, owner-phone acceptance, monitoring/recovery drills, measured
capacity and a real authorized end-to-end launch remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
