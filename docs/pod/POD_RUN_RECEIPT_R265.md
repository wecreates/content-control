# POD run receipt r265 — state restore asynchronous interlock

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from current main
`d4e8b2d42cbf0cf6b2b2b67758c19ce9eec2c6d1`; Money Factory had advanced from
the prior POD merge to `508a5f5844662c3cbc48ded9e4f49beff35f89fd` through an
unrelated free-monitor cadence commit. The current completion, implementation
and free-deployment records, repository heads, relevant open pull requests,
workflow results and the authorized Render service were inspected. No open pull
request duplicated this POD repair. The Money Factory monitor changes were
preserved. The failed database-administration route had no credible changed
access path and was not retried. No resource, credential, account, network rule
or marketplace state changed.

## Repair and regression evidence

The POD state restore path rechecked its four required disabled flags after the
initial table lock, at callback completion, and after transaction completion.
If any of `PUBLICATION_ENABLED`, `POD_PUBLICATION_ENABLED`,
`POD_PRODUCTION_ENABLED` or `POD_OUTBOX_ENABLED` changed during the first row
insert, the prior implementation still inserted the next restored row, applied
safety-state updates and inserted the recovery event before its final rejection
rolled the transaction back. Four new regressions reproduced that delayed stop:
each flag mutation allowed three inserts before rejection.

Content Control PR 642 adds a shared cancellation and disabled-state checkpoint
after every asynchronous archive and transaction boundary: archive open and
verification, transaction admission and lock, schema and empty-target inspection,
each authenticated record read and insert, source identity, every safety-state
update, recovery-event insertion and transaction completion. A flag change during
the first insert now stops after that insert and before any later row or safety
mutation, allowing prompt rollback. Opened archive handles remain closed when an
early checkpoint rejects.

The exact tested Content Control tree was
`881a30680109b047994069d9d444ef799f1654a3`. Focused state archive checks
passed 45/45. The full local POD Node suite passed 825 tests with 9 intentional
environment-gated skips and zero failures. Local Python discovery executed 266
tests but had two collection errors because this executor lacked `cv2`; that is
not recorded as a pass. Exact-head hosted integration run 40236209114, job
121298229640, and production-container run 40236209079, job 121298229868, both
passed with the pinned Python/OpenCV runtime, full Node/PostgreSQL checks,
durable review E2E and disabled-startup probe. Syntax and whitespace checks also
passed.

PR 642 merged as `477219600f7857893644c68db6f8af3463d84ab8` from the exact
tested PR head. Money Factory PR 221 advanced only the immutable cross-repository
pin to that merge while retaining the unrelated monitor commit. Local Money
Factory verification passed 116 Node tests with one explicit PostgreSQL-environment
skip and 81 Python tests. Cross-repository run 40236786707, job 121299957175,
passed. PR 221 merged as `4faa26b54a993790087b6b3a64b3a8e07d237f8c`
from exact tested tree `e93d23bed2349904b91136630d4d63eef8d08e46`;
publication remained disabled.

## Deployment and acceptance state

Render automatically attempted exact Content Control merge
`477219600f7857893644c68db6f8af3463d84ab8` as deploy
`dep-dbf7f4g473hc739pfmag`. Deploy-start event
`evt-dbf7f4r8vfls7393jc3g`, `pipeline_minutes_exhausted` event
`evt-dbf7f4r8vfls7393jc50` and failed deploy event
`evt-dbf7f4ta647c73eposlg` show that the application build did not run. Hosted
behavior remains unverified. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbf7ihss728c73d8s280` verifies that exact merge
`3353aa1a4f005b8742399ed43d36b75ad6cacdd6` was ignored rather than deployed.

All 24 live acceptance areas remain **OPEN**. This repair closes one state
recovery interruption boundary; code and hosted CI are not live storage,
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
