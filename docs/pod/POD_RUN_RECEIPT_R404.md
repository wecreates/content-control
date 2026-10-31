# POD run receipt R404 — verified recovery safety mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`0433f7fad647e5c25b7b9a18e73ecc8b71210470` and Money Factory
`ad870ef0a37c70aaa2c4946951b7b97fb4dd4ede`. Fresh main-head, open-pull-request,
workflow and authorized Render inspection found no active POD/KDP implementation
pull request to duplicate. The existing dirty Content Control checkout was not
modified; work proceeded in isolated clean worktrees.

The completion checklist still leaves all 24 live acceptance areas open. There
was no credible changed database-administration access path, so the previously
unsuccessful connector/browser route was not retried. This run did not access
social-vault, create a paid resource, contact a marketplace, include Etsy, or
enable production or publication.

## Confirmed defect and expected-red evidence

Full-state recovery disabled restored accounts and moved restored processing and
publishing jobs into safety holds, but accepted only each database response's
claimed `rowCount`. A missing or mismatched result body could therefore produce a
successful recovery receipt without proving the safety mutation or its resulting
state.

A focused regression was added before the repair. Both new subtests failed with
`Missing expected rejection`; Node reported three failing test nodes including
their parent. This is expected-red defect evidence, not live acceptance.

## Repair and verification

Content Control PR 943 converts each recovery safety update into a data-modifying
CTE with a one-row aggregate proof. The restore now requires an inert exact result,
a canonical bounded changed-row count, and a verified post-update state before it
records account, processing-job or publishing-job recovery counts. Missing,
executable, malformed, oversized or mismatched proofs fail with
`STATE_ARCHIVE_QUERY_UNVERIFIED` inside the managed transaction.

After repair, the focused regression passed 3/3 including its parent. Related
archive and transaction-completion suites passed 134 tests with one local
PostgreSQL-only skip. The full local POD suite ran 1,047 tests: 1,038 passed,
nine PostgreSQL-environment cases skipped and zero failed. The production module
syntax check and `git diff --check` also passed.

Exact PR head `25acd0cdcde5681de3900424df4774d29d3e5787` passed:

- POD integration run `41214739097`, job `124576807576`: all 1,047 hosted
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored-task production E2E,
  syntax, workflow-control and review guards;
- container run `41214739095`, job `124576807753`: production image build,
  all 385 Python tests, all 1,047 Node/PostgreSQL tests, real print/review E2E,
  non-root/dependency probes and disabled-startup smoke. The smoke receipt kept
  publication false and both production and outbox disabled.

PR 943 merged as `b01e1ea0663f5fa18a9d1c9ff67632e2b4e73469`.

## Money Factory authority pin

Money Factory PR 359 changed only the Content Control checkout pin to exact merge
`b01e1ea0663f5fa18a9d1c9ff67632e2b4e73469`. Both
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

Exact pin head `4f1e495c648da11f3622ef24283f4e46471bb6c6` passed
cross-repository run `41215209571`, job `124578196316`: all 681 pinned Node
contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; all 121
bridge Node tests; and all 81 bridge Python tests. PR 359 merged as
`e8254962a42fb94c8b81f26f6b299727fa935247`.

## Render observation and execution limits

The authorized `content-control-render-worker` service
(`srv-darsdb8u01pc73dn4i2g`) detected functional merge
`b01e1ea0663f5fa18a9d1c9ff67632e2b4e73469` and created deploy
`dep-dbj0j76417fc73adbqh0`. Event `evt-dbj0j7bil8vc73a2vtsg` recorded
`pipeline_minutes_exhausted`; event `evt-dbj0j7a9249c7386h0i0` recorded the
failed deploy. Execution stopped before build or startup. No manual retry was
made because the free pipeline quota was the unchanged limiting condition.
Hosted CI success is not live deployment acceptance.

This scheduled run used only the connectors and runner permissions actually
available during the run. It did not claim a continuously running self-hosted
worker, live provider credentials, marketplace submission, database reachability,
revenue, rights clearance, independent review, official-template acceptance or
launch approval.

## Remaining acceptance truth

All 24 live acceptance areas remain **OPEN**. In particular, there is still no
successful live build/startup of this revision, independently retained production
backup, completed real-authority preflight, real owner account set, current
marketplace authorization/readback for all five in-scope adapters, representative
independent QA, measured 100/1,000 concept capacity, actual financial statement
reconciliation, end-to-end permitted submission, or controlled launch.

`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain false. Publication
remains held for explicit owner approval only after every acceptance criterion is
verified. The scheduled automation remains enabled because completion has not been
reached.
