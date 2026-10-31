# POD run receipt R408 — verified production-completion mutations

Date: 2026-10-31 UTC

## Scope and starting state

This scheduled run resumed from Content Control
`ab9cd1f28c61e3ae500b48189206ef197521be19` and Money Factory
`35aa7a8efcf78a40aa5097371a799c888074bbd5`. Fresh repository heads, open
pull requests, exact-head workflow results and the authorized Render service were
inspected before implementation. No open POD/KDP pull request or duplicate R408
job existed. The unrelated open Content Control draft PR #378 explicitly excluded
POD work. The pre-existing dirty checkout was preserved; implementation and receipt
work used isolated clean worktrees.

The completion checklist still leaves all 24 live acceptance areas open. There was
no credible changed database-administration access path, so the previously failed
connector/browser route was not retried. This scheduled run used only the GitHub,
Render and automation access actually available to it; it did not claim or operate
a continuously running self-hosted worker. It did not access social-vault, contact a
marketplace or other person, create a paid resource, include Etsy, widen network
access, or enable production or publication.

## Confirmed defect and expected-red evidence

`completeProduction` accepted a merely nonempty queue-update result and ignored the
audit-event insert result. It could therefore report a durable QA pass or failure
without exact database proof that the authorized job reached the expected state and
that its matching completion event was stored.

The regression added to `tests/pod-production-lease.test.mjs` covers both PASS and
FAIL outcomes and both mutations. Before the repair it failed with
`Missing expected rejection`: the implementation accepted missing mutation proof
instead of throwing `POD_MUTATION_UNVERIFIED`. The regression also covers zero-row,
mismatched-identity, accessor-backed and Proxy-backed results.

## Implementation

Content Control PR #951 changed `pod-db-bridge.js` and two focused test files:

- the queue transition now uses `RETURNING id,state,reason_code` and must exactly
  match the authorized job, derived terminal state and derived reason code;
- the audit insert now uses `RETURNING id,job_id,kind` and must exactly match the
  generated event identity, authorized job and dynamic `pod.production.qa_passed`
  or `pod.production.qa_failed` kind;
- both checks use the existing inert, descriptor-based mutation verifier, so
  accessors, Proxies, missing rows and mismatched identities fail closed without
  being invoked;
- QA-expiry and production-lease fixtures now model exact PostgreSQL mutation
  results for both verdicts.

The existing transaction rolls back both writes when either proof fails. No
publication path, adapter, marketplace credential or activation setting changed.

## Verification

Local evidence on the repaired tree:

- focused completion, expiry, review, editorial and failure-reason suites: 37/37
  passed;
- full `npm run test:pod`: 1,051 tests, 1,042 passed, 9 PostgreSQL-only skips, 0
  failures;
- `git diff --check` passed.

Exact PR head `d29c9af2004b6c341968598963120d56329f8de6` passed both hosted gates:

- integration run `41231048731`, job `124625155704`: all 1,051
  Node/PostgreSQL tests, all 385 Python/OpenCV tests, stored production E2E,
  syntax, workflow-control and four review-guard tests passed;
- container run `41231048651`, job `124625155331`: the production image built,
  non-root/dependency probes passed, all 385 Python tests and all 1,051
  Node/PostgreSQL tests passed, print/review E2E passed, and startup smoke recorded
  `publication_enabled=false`, `production_status=DISABLED` and
  `outbox_status=DISABLED`.

PR #951 merged as `9003db8c64beebcb2939bcaf2911a04e84943010`.

## Money Factory pin

Money Factory PR #363 changed only `.github/workflows/pod-production.yml`, pinning
Content Control merge `9003db8c64beebcb2939bcaf2911a04e84943010` while keeping
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` literal `false`.

Exact pin head `733de04bb247eea5e1bd664b234e85328d53af8c` passed cross-repository
run `41231668504`, job `124626988691`: 683 pinned Node contracts; Python groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 bridge Node tests; and 81
bridge Python tests. PR #363 merged as
`d23d07469a5ca5cdc0d224e3718a4e4810af36f6`.

## Hosted observation and remaining acceptance

Render auto-deploy detected the functional merge and created deploy
`dep-dbj3ihh5efls73djts30`. Event `evt-dbj3ihth3lcs7385lfd0` reported exhausted
pipeline minutes, followed by failed deploy event `evt-dbj3ihud4qjc73alhsvg`.
The attempt ended before build or startup, so it is not live acceptance. No manual
retry was triggered because auto-deploy is enabled and the unchanged free quota is
the limiting condition.

This repair is code and hosted-test evidence only. It does not establish a live
database mutation, marketplace authorization, real submission, revenue or any of
the 24 live acceptance areas. Both publication flags remain false. The completion
automation remains enabled because all 24 areas are still open.
