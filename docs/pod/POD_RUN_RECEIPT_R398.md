# POD run receipt R398 — durable Money Factory outbox delivery proof

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`65d5a97c912b5aca7d751bd732868ddab4d8f54b` and Money Factory
`8b1321b935ecca989359ad2870863262923d5b4b`. Fresh main-head, open-pull-request,
workflow and Render inspection found no active POD/KDP implementation job to
duplicate. Unrelated draft work was left unchanged. The scheduled Full Capability
Validation run `41185871195` was an intentional fail-closed plan: its twelve
planner regressions passed, it selected zero tasks and preserved all 2,500
unverified capabilities as blocked. It was not treated as a POD regression.

The checked acceptance registry still leaves all 24 live areas open. There was no
changed database-administration access path, so the previously unsuccessful
connector/browser route was not retried. This run did not access social-vault,
create a paid resource, contact a marketplace, include Etsy, or enable production
or publication.

## Confirmed defect and expected-red evidence

After Money Factory returned a valid signed event acknowledgement, the Content
Control outbox executed an `UPDATE` for `delivered_at` but ignored its database
result and incremented the delivered count unconditionally. A zero-row, malformed,
accessor-backed or Proxy-backed result could therefore be represented as durable
delivery. With `continueOnError`, the same unverified outcome could also be counted
as success instead of a failed delivery. The next polling cycle and operational
metrics would then rely on a delivery claim that this process had not proved.

The regression-only remote head
`2d60a6a39af761cfe387358c680235942c191a5e` reproduced the defect in hosted
POD integration run `41187325944`, job `124496786745`: 1,035 Node/PostgreSQL
tests ran, 1,034 passed, and only
`acknowledged events require a verified one-row durable delivery mutation` failed
with `Missing expected rejection`. The companion container run `41187325945` was
superseded by the repaired head and is not acceptance evidence. The same focused
regression failed locally as the only failure (27/28 passed).

## Repair and verification

Content Control PR 931 changes the delivery mutation to
`UPDATE ... WHERE delivered_at IS NULL RETURNING id`. Before the transaction can
commit or the event can be counted, the outbox now requires all of the following:

- an inert own-data `rowCount` equal to one;
- one ordinary, dense returned row;
- exactly one enumerable own data field, `id`;
- exact identity with the selected event.

Proxy, accessor, sparse, oversized, extra-field, mismatched-ID, zero-row and
multi-row results fail with the fixed `OUTBOX_DELIVERY_UNVERIFIED` code without
invoking their data traps. Throwing inside the managed transaction preserves its
existing rollback behavior. The receiver's stable event ID retains at-least-once
retry safety. No publication or marketplace path was enabled.

Focused local transport/outbox/storage tests passed 86/86. The first broad local
attempt lacked the `pg` package in the new worktree and produced eight import
errors; it is not acceptance evidence. Reusing the existing lockfile-matched local
dependency installation then ran 1,035 Node tests: 1,026 passed, nine
PostgreSQL-environment tests skipped, and zero failed. No local Python claim is
made.

Repaired exact remote head
`c756de7cb2be7ecc86508508b44aba0e8190ca10` passed integration run
`41187584810`, job `124497540058`: all 1,035 Node/PostgreSQL tests, all 385
Python/OpenCV tests, the real stored-task production-to-durable-review E2E,
syntax, workflow-control and review-guard stages passed. Production-container run
`41187584812`, job `124497636207`, built image
`sha256:c0217ae2fd16242a90a875852fe7005081eca54ad124e2b9c6275d1aadb115f9`,
verified the non-root/offline dependency boundary, passed all 385 Python tests,
all 1,035 Node/PostgreSQL tests and the real E2E. Its startup smoke recorded
`publication_enabled=false`, `production_status=DISABLED` and
`outbox_status=DISABLED`.

PR 931 merged as `533ad570d7bd64b6984ccaeb84959f4d5d0cdbf4`.
Post-merge System Wiring Audit run `41188029613` passed. Post-merge POD
integration run `41188029634`, job `124498826923`, also passed: 1,035/1,035
Node/PostgreSQL tests, 385/385 Python/OpenCV tests, the stored-task
production-to-durable-review E2E, syntax, workflow-control and four free-review
guard tests all completed successfully.

## Money Factory authority pin

Money Factory PR 353 changes only the Content Control checkout pin to the exact
functional merge above. Exact pin head
`e5ea72a3ecca1f8ce5f4315517aaf74e398c14f0` passed cross-repository run
`41188056052`, job `124498909987`: all 671 pinned Node contracts; Python groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 cases; all 121 bridge Node tests; and all
81 bridge Python tests passed. Both `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remained literal `false`. PR 353 merged as
`98112d03b239d8857bf8a6fa4df2c547d6eaab7b`.

## Render observation and execution limits

The authorized service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained active, auto-deploying from `main`,
unsuspended, Docker-based, one instance and on the existing free plan. Render
detected functional merge `533ad570d7bd64b6984ccaeb84959f4d5d0cdbf4` and
created deploy `dep-dbir3sqvcj2c73ea2ak0`. Events
`evt-dbir3sogbm7c73fbhkm0` (deploy started),
`evt-dbir3sud4qjc73afhn60` (pipeline minutes exhausted) and
`evt-dbir3sth3lcs73fvkvr0` (deploy ended failed) show that execution stopped
before build or startup. No manual retry was made because the free pipeline quota
was the unchanged limiting condition. The merged code and hosted tests are not
live deployment acceptance.

This scheduled run used only the connectors and runner permissions actually
available during the run. It did not claim a continuously running self-hosted
worker, live provider credentials, live marketplace submission, database reachability,
revenue, rights clearance, independent review, official-template acceptance or
launch approval.

## Remaining acceptance truth

All 24 live acceptance areas remain **OPEN**. In particular, there is still no
successful live build/startup of this revision, independently retained production
backup, completed real-authority preflight, real owner account set, current
marketplace authorization/readback for all five in-scope adapters, representative
independent QA, measured 100/1,000 concept capacity, actual financial statement
reconciliation, end-to-end permitted submission, or controlled launch. Publication
remains held for explicit owner approval only after those criteria are verified.
