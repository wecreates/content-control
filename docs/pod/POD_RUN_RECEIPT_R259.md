# POD run receipt r259 — review validation retention cutoff

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`cfd473a16886f757d21dd46c9a29b1d7326d9f23`; Money Factory started from
`a108e9a62392a5c6fe7b9453e6a18019649b49c2`. Current POD acceptance, status
and free-deployment evidence, repository heads, open pull requests, workflow
results and the authorized Render service were inspected. Neither repository
had an open pull request. The failed database-administration route had no
changed access path and was not retried. No resource, credential, account,
network rule or marketplace state changed.

## Repair and regression evidence

Review-package and review-artifact retrieval rechecked the configured storage
lifetime immediately after their database queries, but not after validating the
stored manifest, content digest and artifact format. If validation crossed the
retention safety cutoff, the request could still return the held manifest or
bytes. This was a fail-closed retention-boundary gap, not evidence that a live
request returned expired data.

[Content Control PR 623](https://github.com/wecreates/content-control/pull/623)
adds the final post-validation lifetime checks and documents the contract. The
two regressions advance the configured lifetime from inside valid stored
manifest access. Both failed on the baseline because retrieval completed instead
of rejecting. After repair, focused review/read suites passed 54/54. The
complete local POD Node suite ran 812 tests: 803 passed, nine intentional
environment-gated tests skipped and zero failed. The local production
end-to-end command retained its one intentional environment skip. Syntax,
workflow control, four free-review guards and diff checks passed.

Exact head `99d695942b21f995472604dfe77d65029a1e7dc5`, tree
`0a013e8b797741538d44739069ea7b3327d8ccbb`, passed
[integration run 40207787027](https://github.com/wecreates/content-control/actions/runs/40207787027),
job `121212348577`, and
[container run 40207786982](https://github.com/wecreates/content-control/actions/runs/40207786982),
job `121212348555`. PR 623 merged as
`205e62467a1309a342a6c8d165a5ab7181dddd74` with the same exact tree.

[Money Factory PR 215](https://github.com/wecreates/Money-factory/pull/215)
pins that immutable merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local
verification passed 116 of 117 Node tests with one intentional PostgreSQL
environment skip and passed 81/81 Python tests. Exact head
`f380720a71c26f7e6cdcefeb08ce1af3cf69e37e`, tree
`f237e500de757e5e5136e8b08fb4dfd002f4b024`, passed
[cross-repository run 40208428183](https://github.com/wecreates/Money-factory/actions/runs/40208428183),
job `121214272475`. PR 215 merged as
`d74a88a6fe52a4e3ce32fd5ef1196ac0337e3e93` with the same exact tree and both
publication flags false.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`205e62467a1309a342a6c8d165a5ab7181dddd74` as deploy
`dep-dbf27adg1s2s739sfetg`. Deploy-start event
`evt-dbf27acegpmc73btj93g`, `pipeline_minutes_exhausted` event
`evt-dbf27acegpmc73btj94g` and failed deploy event
`evt-dbf27abphbkc73a4lia0` show that the application build did not run.
Hosted behavior remains unverified. No manual retry, purchase, plan/cache
change, replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf2a9o473hc739jhkd0` verifies that exact merge
`a6c09312eb474bde6c53b38caf7b1593489f859b` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair closes two final
review-read retention boundaries only; code and hosted CI are not live storage,
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
