# POD run receipt r254 — exact repair retry target binding

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`d654c680a12b0ee5f4974e1efc8517fcb0181516`; Money Factory started from
`7cb40300ac9347cef697d9bd5f1fd8adc6b4c6b0`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open POD pull requests. The previously failed
database-administration route had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state
was created or changed.

## Repair and regression evidence

The repair-retry bridge authenticated a current grant before entering a
transaction, but it did not bind the route `jobId` to the signed grant's exact
`job_id` before database acquisition. A valid grant for one job could therefore
cause a select and row lock attempt for a different or malformed route identity
before the later brief-scope check rejected it. This was a database-admission
and current-authority gap; no unauthorized live repair, database mutation or
publication is claimed.

[Content Control PR 608](https://github.com/wecreates/content-control/pull/608)
requires both identities to be bounded, nonblank, NUL-free primitive text that
round-trips through UTF-8 exactly, and requires exact equality before acquiring
a database connection. Signature authentication still precedes this comparison,
so malformed targets cannot mask an invalid signature and valid grants cannot
probe or lock another repair target.

The regression-first focused suite ran 13 tests: two existing signature/exact-
target cases passed and 11 invalid or cross-job targets failed because they
reached the transaction hook. After repair, all 13 passed without database
access for invalid scope. The complete local POD Node suite ran 784 tests: 775
passed, nine intentional environment-gated tests skipped and zero failed; the
production end-to-end command retained its one intentional environment skip.
JavaScript syntax, workflow control, four free-review guards and diff checks
also passed. Exact-head
[integration run 40185890365](https://github.com/wecreates/content-control/actions/runs/40185890365),
job `121146460545`, and
[production-container run 40185890418](https://github.com/wecreates/content-control/actions/runs/40185890418),
job `121146460755`, completed successfully.

The exact Content Control head was
`35a2e2182e9d16ff51f2ba4b762a1dc79a9cb58b`; its tree
`963d2c4e6c8bbbb6e0c27cd13647f5415b65ec0f` matched the locally tested tree.
PR 608 merged as `faa88e82fd706bcd1745097ec6ba42a8c5189386`, whose merge tree remained
exactly `963d2c4e6c8bbbb6e0c27cd13647f5415b65ec0f`.

[Money Factory PR 210](https://github.com/wecreates/Money-factory/pull/210)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification ran 117 Node tests: 116 passed, one intentional PostgreSQL
environment skip and zero failed; its Python suite passed 81/81. Exact tested
head `25eb30a0a8390de7d41ee0353ebf0960f88d79a7` and tree
`3c4c71704229429c93c4ecb3a855c0b375e5644d` passed
[cross-repository run 40186513651](https://github.com/wecreates/Money-factory/actions/runs/40186513651),
job `121148323436`, including all pinned contracts, recovery, rights,
templates, KDP/editorial, Node, Python and bridge stages. PR 210 merged as
`1706a1f266ddf9af2266449317820f6e12fe91b5`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbetteh5efls73bce0m0`. Deploy-start event
`evt-dbetter4qb4c73a12qrg` bound exact commit
`faa88e82fd706bcd1745097ec6ba42a8c5189386`. Event
`evt-dbetter8vfls738s2np0` reported `pipeline_minutes_exhausted`, and event
`evt-dbetteos76nc739eom6g` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one repair-admission
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
