# POD run receipt r257 — review-package retention cutoff

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`741b4978f056ff9a4a64325b18ccc8a10a0a2997`; Money Factory started from
`05791c97665d3a0c3418d4cd40271c46c05e34e1`. Current acceptance, status and
free-deployment documents, open pull requests, workflow results and the
authorized Render service were inspected. The only open Content Control PR was
an unrelated draft video candidate; Money Factory had no open PR. The failed
database-administration route had no changed access path and was not retried.
No resource, credential, account, network rule or marketplace state changed.

## Repair and regression evidence

Review-artifact retrieval already rechecked the configured storage lifetime
after its database wait, but review-package retrieval checked it only before
the query. A request crossing the 24-hour retention safety cutoff while waiting
could therefore still return the held manifest. This was a durable-storage
cutoff gap, not evidence of live loss or unauthorized retrieval.

[Content Control PR 617](https://github.com/wecreates/content-control/pull/617)
adds the missing post-query lifetime check and documents the symmetric package
and artifact contract. The regression advances the configured lifetime during
the database wait. It failed 1/1 on baseline because the package resolved
instead of rejecting; after repair the focused review suites passed 24/24.
The complete local POD Node suite ran 808 tests: 799 passed, nine intentional
environment-gated tests skipped and zero failed. The local production
end-to-end command retained its one intentional environment skip. Syntax,
workflow control, four free-review guards and diff checks passed.

Exact head `e9569a3d9f04701c5d55839887b678c75b52f124`, tree
`29112e2f0091534ba73c5cc9a8b3f50276553756`, passed
[integration run 40197995174](https://github.com/wecreates/content-control/actions/runs/40197995174),
job `121182914122`, and
[container run 40197995116](https://github.com/wecreates/content-control/actions/runs/40197995116),
job `121182914014`. PR 617 merged as
`6685e92d534fad7c025e47cbc974c04e600b9359` with the same exact tree.

[Money Factory PR 213](https://github.com/wecreates/Money-factory/pull/213)
pins that immutable merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local
verification passed 116 of 117 Node tests with one intentional PostgreSQL
environment skip and passed 81/81 Python tests. Exact head
`d96821db160812ed2d2e11136e5028166e72eddb`, tree
`f526a291f69f680b0b1995f6e13f7bacd758e2d2`, passed
[cross-repository run 40198693237](https://github.com/wecreates/Money-factory/actions/runs/40198693237),
job `121185019795`. PR 213 merged as
`9f580b3e44228ac1f79759311e32d4ca65ae1201` with the same tree and both
publication flags false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`6685e92d534fad7c025e47cbc974c04e600b9359` as deploy
`dep-dbf0cq5g1s2s739qf170`. Deploy-start event
`evt-dbf0cqb4qb4c73a2slng`, `pipeline_minutes_exhausted` event
`evt-dbf0cqbphbkc73a35qf0` and failed deploy event
`evt-dbf0cqcegpmc73bs3a80` show that the application build did not run.
Hosted behavior remains unverified. No manual retry, purchase, plan/cache
change, replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf0h4mq1p3s73em9s20` verifies that exact merge
`3ec2a58b133c97c5cb333167b00eb3f034ac24e2` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair closes one
review-package retention boundary only; code and hosted CI are not live storage,
database, marketplace or deployment acceptance. Restricted production
database/schema/migrations, retained recovery, deployed hybrid dependencies,
mounted Money Factory authority and current grants/revocation, real
accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
