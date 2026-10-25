# POD run receipt r260 — actionable storage-cutoff reads

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`9037589e43e613789eef227afadb09fb76741fac`; Money Factory started from
`fbeb17a5a4f563dc307f6691529a4628c0ee8dd0`, including its concurrent free
monitor cadence update. Current POD acceptance, status and free-deployment
evidence, repository heads, open pull requests, workflow results and the
authorized Render service were inspected. Neither repository had an open pull
request. The failed database-administration route had no changed access path and
was not retried. No resource, credential, account, network rule or marketplace
state changed.

## Repair and regression evidence

The database layer already rejected review-package, review-artifact and owner
job-list reads at the configured storage safety cutoff. Their authenticated HTTP
routes collapsed that exact operational outage into record-level 404 or 409
responses, making an expiring/unavailable store indistinguishable from a missing
hold or invalid filter. This was an operations/monitoring fault, not evidence of
data disclosure or live storage acceptance.

[Content Control PR 626](https://github.com/wecreates/content-control/pull/626)
maps only the exact `POD_STORAGE_EXPIRING` error to sanitized HTTP 503
`POD_STORAGE_UNAVAILABLE`; all unrelated failures retain their existing redacted
404/409 responses. All three endpoint regressions failed on the baseline with
404/409 instead of 503. After repair, focused operations/read suites passed
51/51. The complete local POD Node suite ran 815 tests: 806 passed, nine
intentional environment-gated tests skipped and zero failed. The local
production end-to-end command retained its one intentional environment skip.
Syntax, workflow control, four free-review guards and diff checks passed.

Exact head `e013ea62a585dda2177516af4de402bc29273526`, tree
`1cdd153f8ca0ed5be1b5e450cadb183cd6e125ca`, passed
[integration run 40216272370](https://github.com/wecreates/content-control/actions/runs/40216272370),
job `121237963028`, and
[container run 40216272468](https://github.com/wecreates/content-control/actions/runs/40216272468),
job `121237963456`. PR 626 merged as
`efd00aac3ba9b3a815f7436564a7dc0d0d6bc35a` with the same exact tree.

[Money Factory PR 216](https://github.com/wecreates/Money-factory/pull/216)
preserves the newer monitoring-cadence head and pins that immutable merge while
retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Local verification passed 116 of 117 Node
tests with one intentional PostgreSQL environment skip and passed 81/81 Python
tests. Exact head `53341332f76a851bfe34228da0049fda855ce38a`, tree
`6a1185a44e3cc91874b1c89eef7526269a22475a`, passed
[cross-repository run 40216910346](https://github.com/wecreates/Money-factory/actions/runs/40216910346),
job `121239910058`. PR 216 merged as
`5e6ba075f92dc4594f474f2b9dd213624ed57210` with the same exact tree and both
publication flags false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`efd00aac3ba9b3a815f7436564a7dc0d0d6bc35a` as deploy
`dep-dbf3p9k9v7es73d1s94g`. Deploy-start event
`evt-dbf3p9mbs3rs73cg0oh0`, `pipeline_minutes_exhausted` event
`evt-dbf3p9g4cbqc73dqigj0` and failed deploy event
`evt-dbf3p9j8vfls7390n1ng` show that the application build did not run.
Hosted behavior remains unverified. No manual retry, purchase, plan/cache
change, replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf3tiuk1f9s73fs7q80` verifies that exact merge
`020e7cfa19dbe01bedd5fc57a2f2fdd887ed3886` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair makes one storage
cutoff observable on three authenticated read paths only; code and hosted CI are
not live storage, database, marketplace or deployment acceptance. Restricted
production database/schema/migrations, retained recovery, deployed hybrid
dependencies, mounted Money Factory authority and current grants/revocation,
real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
