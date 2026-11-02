# POD run receipt R411 — exact production failure and review-hold proof

Date: 2026-11-02 UTC

## Scope and starting truth

This scheduled run resumed from Content Control
`80e13c74b5709855d7bfe9953c68eca49fb697e1` and Money Factory
`09f62765c72b629fbb866814070a4a6c6438edee`. Fresh repository heads, open
pull requests, exact-head workflow results and the authorized Render service were
inspected before implementation. No open POD/KDP repair or duplicate R411 job
existed. Content Control draft PR #378 explicitly excluded POD work. The existing
dirty checkout and its untracked dependencies/caches were preserved; implementation
and receipt work used isolated clean worktrees.

All 24 live acceptance areas remained open. There was no credible changed
database-administration access path, so the previously failed connector/browser
route was not retried. The run did not access social-vault, contact a marketplace or
another person, create paid infrastructure, include Etsy, widen network access, or
enable production publication.

## Confirmed defect and expected-red evidence

`failProduction` and `holdProduction` accepted any nonempty queue mutation result.
The review-hold audit insert was not checked at all. A driver stub, malformed result
or unexpected database response could therefore let a transaction advertise a
durable QA failure or owner-review package without exact proof of the authorized job,
derived state, fixed reason code and matching audit identity.

The focused regression covers missing row counts, zero rows, empty rows, mismatched
identity, accessor-backed results and Proxy-backed rows. Before the repair it failed
with `Missing expected rejection`: the implementation committed instead of throwing
`POD_MUTATION_UNVERIFIED`.

## Implementation

Content Control PR #958 made the following bounded changes:

- `failProduction` now uses `RETURNING id,state,reason_code` and requires exact
  equality with the authorized job, `qa_failed` state and sanitized fixed reason;
- `holdProduction` requires the same exact queue proof with
  `reason_code=REVIEW_REQUIRED`;
- the review-hold event now uses `RETURNING id,job_id,kind` and must exactly match
  the generated event identity, authorized job and
  `pod.production.review_required` kind;
- all checks use the existing inert descriptor-based mutation verifier, so missing,
  mismatched, accessor-backed and Proxy-backed results fail closed without invoking
  executable properties;
- the transaction rolls back when either queue or audit proof fails.

No adapter, marketplace credential, publication route or activation setting changed.

## Local and hosted verification

Local evidence on the repaired tree:

- focused lease, expiry, manifest, failure-vocabulary and review-provenance suites:
  44/44 passed;
- complete `npm run test:pod`: 1,053 tests, 1,044 passed, nine PostgreSQL-only
  skips, zero failures;
- `git diff --check` passed.

Both remote blobs at exact PR head
`50ee328602e8f9fb6a224db5f232825efa698059` matched the locally tested files.
The exact head passed:

- POD integration run `41541531508`, job `125606639887`: all Node/PostgreSQL,
  Python/OpenCV, stored-production E2E, syntax, workflow-control and review-guard
  stages succeeded;
- POD container run `41541531507`, job `125606638552`: the production image built,
  non-root/dependency probes passed, Python and Node/PostgreSQL suites passed, real
  print/review E2E passed, and startup remained production/publication disabled.

PR #958 merged as `a595846bcb01c29c95029bd70126eeb58cc83565`.

## Money Factory dependent pin

Money Factory PR #366 changed only `.github/workflows/pod-production.yml`, pinning
the exact Content Control merge above while retaining
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

Exact pin head `c550fbc1a4c5bf08f409e6efb88108a727f0f948` passed cross-repository
run `41542431321`, job `125609671037`, including the pinned Node/PostgreSQL
contracts, all Python evidence/rendering groups, KDP editorial-bound checks and both
Money Factory bridge suites. PR #366 merged as
`0e5f4f8eaf5e18fb4e259a59a77053b0cd39d82a`.

## Authorized Render verification

The existing free-plan, one-instance Docker service auto-deployed exact Content
Control merge `a595846bcb01c29c95029bd70126eeb58cc83565` as
`dep-dbkhdjm417fc73a7u11g`. The deploy started at
`2026-11-02T23:03:42.873730Z`, finished at
`2026-11-02T23:04:51.794218Z` and reached `live`. Application logs showed the new
instance listening on port 10000 and Render reporting `Your service is live`.

The same logs reported that the review artifact was not accepted by canonical health
state. That is the intended fail-closed readiness result: rollout liveness is not
accepted evidence readiness and does not prove a live production mutation.

## Acceptance truth and execution limits

This closes one database-result verification gap in code and hosted tests. Existing
code, synthetic tests and deployment liveness do not prove the production database,
durable recovery, marketplace authority, a real submission, economics,
reconciliation, measured capacity or end-to-end launch acceptance. The scheduled
run used only its actually available GitHub, Render and local execution access and
did not claim a continuously running self-hosted worker.

All 24 acceptance areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory, no publication was attempted and
the completion automation remains enabled.
