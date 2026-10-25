# POD run receipt r266 — artifact restore asynchronous interlock

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`856d5ab8bb5ed695a3fb4c45cda5c4122326684a`; Money Factory started from
`4faa26b54a993790087b6b3a64b3a8e07d237f8c`. The current completion,
implementation and free-deployment records, recent repository heads, relevant
open pull requests, workflow results and the authorized existing Render service
were inspected. The only open Content Control PR was an unrelated disabled
OpenFilm candidate; no open PR duplicated this POD repair. The failed database-
administration route had no credible changed access path and was not retried. No
resource, credential, account, network rule or marketplace state changed.

## Repair and regression evidence

Artifact-only restore checked cancellation at the start of each item, but it did
not recheck cancellation after the authenticated object or immutable-row read.
It checked the two publication kill switches before its transaction and at the
transaction boundary, but not after each asynchronous row operation. If either
switch changed during the first insert, the prior implementation inserted all
three fixture artifacts before its final rejection rolled the transaction back.
If cancellation arrived during the existing-row lookup, it still inserted that
artifact before stopping.

Three regression tests reproduced the gap on current main: 48 of 51 focused
archive tests passed and the new assertions failed because each switch transition
performed three inserts instead of one and the lookup cancellation performed one
insert instead of zero. Content Control PR 645 adds one shared cancellation and
disabled-state checkpoint after archive open, catalog/object verification,
transaction admission and lock, occupied-byte and immutable-row reads, every
artifact read and insert, archive identity and transaction completion. A switch
change during the first insert now stops before the next artifact and rolls the
transaction back. Cancellation during the immutable-row lookup stops before its
insert. The existing post-COMMIT reconciliation boundary remains explicit.

The exact tested Content Control tree was
`74e329848d59717e699eb6712ab36de78ee0d52f`. The focused archive suite passed
51/51. The full local POD Node suite passed 828 tests with nine intentional
environment-gated skips and zero failures (837 total). Syntax and whitespace
checks passed. Exact-head hosted integration run 40242205078, job 121316204433,
and production-container run 40242205086, job 121316204545, both passed with the
pinned Python/OpenCV runtime, full Node/PostgreSQL checks, durable review E2E and
publication-disabled startup probe. PR 645 merged exact head
`509ee0b61e2f8e3aa55af965d33404ef3fcc0f1f` as
`63f1b300e0986e4aea4113d3d019421b01c16cd3` after an unchanged-base and clean-
mergeability check.

Money Factory PR 222 advanced only the immutable cross-repository checkout to
that merge. Local Money Factory verification passed 116 Node tests with one
explicit PostgreSQL-environment skip and 81 Python tests. Cross-repository run
40242719131 initially failed its selected Content Control suite on the unrelated
process-start timing assertion `aborted stages are reaped even when they ignore
SIGTERM`; the same exact head had already passed that check in both Content
Control workflows and the other 564 selected tests passed. One failed-job rerun
was used without changing code or weakening the test. Rerun job 121318259053
passed every step. PR 222 then merged exact head
`cf167b3265bdda2eed5d9406b976f9da72279e17` as
`c6f64183813d185706565a6f0330d7433f7db013` after an unchanged-base and clean-
mergeability check. Publication remained disabled.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`63f1b300e0986e4aea4113d3d019421b01c16cd3` as deploy
`dep-dbf8jg6q1p3s73evklug`. Deploy-start event
`evt-dbf8jgb4qb4c73a9a9ag`, `pipeline_minutes_exhausted` event
`evt-dbf8jgbphbkc73a9inv0` and failed deploy event
`evt-dbf8jgda647c73eqgeng` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This repair closes one artifact
recovery interruption boundary; code and hosted CI are not live storage,
database, marketplace, reconciliation or deployment acceptance. Restricted
production database/schema/migrations, retained off-host recovery, deployed
hybrid dependencies, mounted Money Factory authority and current grants/
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider reconciliation, owner-phone acceptance, monitoring/recovery drills,
measured capacity and authorized end-to-end launch evidence remain unverified.
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain
mandatory; Etsy remains excluded. No approval, clearance, revenue, publication
or continuously running self-hosted worker is claimed.
