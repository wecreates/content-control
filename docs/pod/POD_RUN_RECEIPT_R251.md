# POD run receipt r251 — lossless intake identities

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`4f3f27e15be585f0218beb5b0a53816cc8846112`; Money Factory started from
`265cefbab29364d559b1e0c3f54c93dcae190965`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

Signed concept intake accepted `concept_id` and `business_id` values containing
NUL or unpaired UTF-16 surrogates. PostgreSQL text cannot store NUL, and Node
UTF-8 encoding replaces unpaired surrogates, so validly signed input could fail
or change after verification at UUID, text and advisory-lock boundaries.

[Content Control PR 598](https://github.com/wecreates/content-control/pull/598)
requires both intake identities to be bounded, nonblank, NUL-free and to
round-trip through UTF-8 exactly before transaction entry. It preserves exact
valid Unicode, combining marks and whitespace without normalization or repair.

The regression-first focused run passed 16 of 17 tests and failed the new case
because malformed identity input reached the database transaction. After the
repair, the combined intake-revocation, concept-budget and authority-expiry
suites passed 33/33. The complete local POD Node suite ran 747 tests: 738
passed, nine intentional environment-gated tests skipped and zero failed.
Exact-head
[integration run 40173506454](https://github.com/wecreates/content-control/actions/runs/40173506454),
job `121109193661`, and
[production-container run 40173506440](https://github.com/wecreates/content-control/actions/runs/40173506440),
job `121109194028`, completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`f53f0f8196b430be5cbc6175a95e443af78cbaa8`; its tree
`257aeff9def0b1ec0a7440cd03352b8dd9f5232e` matched the locally tested tree.
PR 598 merged as `7920735a03efc68ba9e12115e864ed39f6b9fc30`, whose merge tree remained
exactly `257aeff9def0b1ec0a7440cd03352b8dd9f5232e`.

[Money Factory PR 207](https://github.com/wecreates/Money-factory/pull/207)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification passed 117 Node tests and 81 Python tests. Exact tested
head `1b59e08cae2a022af9b952eea285790eb9fc0ea8` and tree
`a4e14f8a1f70d15385f6c93b6dee852170ecfad9` passed
[cross-repository run 40173910170](https://github.com/wecreates/Money-factory/actions/runs/40173910170),
job `121110407814`, including pinned contracts, recovery, rights, templates,
KDP/editorial, Node, Python and bridge stages. PR 207 merged as
`cfe611529a053ae789251abc0ab88dbbddc5f7c8`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dber65u7bikc73bh8a6g`. Deploy-start event
`evt-dber65ugej5s73a21v9g` bound exact commit
`7920735a03efc68ba9e12115e864ed39f6b9fc30`. Event
`evt-dber65rsp5es73cahf5g` reported `pipeline_minutes_exhausted`, and event
`evt-dber65rsp5es73cahf70` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

The first receipt merge title did not carry the skip token from its head commit,
so Render also opened documentation-only deploy
`dep-dbera0ss728c73crt6gg` for merge
`7c5fc1d44fbf4a0a19ccc95205d8ebe68cac2562`. Events
`evt-dbera0rphbkc739vnem0`, `evt-dbera0ta647c73egiuq0` and
`evt-dbera134qb4c739vbtv0` respectively recorded deploy start, exhausted free
pipeline minutes and deploy end. No application build ran and no runtime or
configuration changed. The corrective evidence merge carries `[skip render]`
in the merge title itself. Render event `evt-dberairbc2fs738gs280` then verified
that exact corrective merge `919010ad3a89517ffb301d702ed1f67365cc0e18`
was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This closes one signed intake-
identity persistence boundary only; code and hosted CI are not live source
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
