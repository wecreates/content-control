# POD run receipt R407 — verified repair requeue mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`a15805f360995ea1fbc4b39c370aef1e67bec90a` and Money Factory
`71f05acc01ec9d5ab388fe1ec586c1a88a070eb1`. Fresh repository heads, open
pull requests, workflow results and the authorized Render service were inspected
before implementation. No open POD/KDP pull request or duplicate R407 job existed.
The pre-existing dirty checkout was preserved; implementation and receipt work used
isolated clean worktrees.

The completion checklist still leaves all 24 live acceptance areas open. There was
no credible changed database-administration access path, so the previously failed
connector/browser route was not retried. This run did not access social-vault,
contact a marketplace, create a paid resource, include Etsy, widen network access,
or enable production or publication.

## Confirmed defect and expected-red evidence

`requeueRepair` correctly limited recovery to the exact authorized job and eligible
remediation states, but trusted both its archive-event insert and queue-reset update
without verifying either database result. A missing, malformed, mismatched,
accessor-backed or Proxy-backed driver response could therefore let the method
report remediation success without exact durable proof that the prior attempt was
archived and the job returned to `raw`.

The regression added to `tests/pod-repair-admission.test.mjs` failed before the
repair with `Missing expected rejection`. The existing implementation accepted an
undefined mutation receipt instead of throwing `POD_MUTATION_UNVERIFIED`.

## Implementation

Content Control PR #949 changed only `pod-db-bridge.js` and two focused tests:

- the `pod.repair.archived` insert now uses `RETURNING id,job_id,kind` and must
  exactly match the generated event identity, authorized job and fixed event kind;
- the queue reset now uses `RETURNING id,state,reason_code` and must exactly match
  the requested job, `raw` state and cleared reason;
- both checks use the existing inert, descriptor-based mutation verifier, so
  accessors, Proxies, missing rows, extra fields and mismatched identities fail
  closed without being invoked;
- authority-expiry fixtures now model both exact PostgreSQL mutation results.

The existing transaction rolls back both writes when either proof fails. No
publication path, adapter, marketplace credential or activation setting changed.

## Verification

Local evidence on the repaired tree:

- focused repair, authority-expiry, failure-reason and production-recovery suites:
  31/31 passed;
- full `npm run test:pod`: 1,050 tests, 1,041 passed, 9 PostgreSQL-only skips, 0
  failures;
- `git diff --check` passed.

Exact PR head `3e4ea8540df70f38e732699083e64dafb91f2999` passed both hosted gates:

- integration run `41224779995`, job `124606555851`: all 1,050
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored production E2E,
  syntax, workflow-control and four review-guard tests passed;
- container run `41224779915`, job `124606555694`: the production image built,
  non-root/dependency probes passed, all 385 Python tests and all 1,050
  Node/PostgreSQL tests passed, print/review E2E passed, and startup smoke recorded
  `publication_enabled=false`, `production_status=DISABLED` and
  `outbox_status=DISABLED`.

PR #949 merged as `0b187f139c3c640500516831e1f74d39bb987ac3`.

## Money Factory pin

Money Factory PR #362 changed only `.github/workflows/pod-production.yml`, pinning
Content Control merge `0b187f139c3c640500516831e1f74d39bb987ac3` while keeping
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` literal `false`.

Exact pin head `6687c5e51922fcb87bb4da350170f023cfef40d1` passed cross-repository
run `41225376706`, job `124608309265`: 682 pinned Node contracts; Python groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 bridge Node tests; and 81
bridge Python tests. PR #362 merged as
`d3391225d1aa10f4c73e455e67e15c3556912d5b`.

## Hosted observation and remaining acceptance

Render auto-deploy detected the functional merge and created deploy
`dep-dbj2e6mq1p3s73aa8vn0`. Event `evt-dbj2e6h2tl4s73e7v10g` reported exhausted
pipeline minutes, followed by failed deploy event `evt-dbj2e6ril8vc73a4e88g`.
The attempt ended before build or startup, so it is not live acceptance. No manual
retry was triggered because auto-deploy is enabled and the unchanged free quota is
the limiting condition.

This repair is code and hosted-test evidence only. It does not establish a live
database mutation, marketplace authorization, real submission, revenue or any of
the 24 live acceptance areas. Both publication flags remain false. The completion
automation remains enabled because all 24 areas are still open.
