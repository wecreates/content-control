# POD run receipt R413 — exact new-concept admission proof

Date: 2026-11-03 UTC

## Scope and starting truth

This scheduled run reconciled the current completion checklist, implementation
status, free-deployment record, repository heads, open pull requests, exact-head
workflows and the authorized Render service before implementation. Content Control
started at `b2a7f188513fc06238d7411ba5223cd0ba41f4c4`; Money Factory
started at `471f7a4819f80728be2b7c1972242e77cec8f9d5`. No open POD/KDP
repair or duplicate R413 job existed. Content Control draft PR #378 explicitly said
it contained no POD changes. Existing unrelated work and the dirty base checkout's
untracked dependencies/caches were left untouched; implementation used isolated
worktrees and connector-created branches.

All 24 live acceptance areas were open. The previously failed database-administration
route had no credible changed access path available to this run, so it was not
retried. The run did not access social-vault, contact a marketplace or another
person, create paid infrastructure, include Etsy, widen network access, or enable
publication.

## Confirmed defect and expected-red evidence

The new-concept branch of `PodDB.registerIntake` treated any nonempty daily-budget
result as proof that the correct business and UTC day were charged. It then ignored
the concept insert result entirely. A malformed, executable, mismatched or
driver-stubbed database response could therefore report a concept as admitted
without exact durable budget and immutable concept-row proof.

The regression exercises missing row counts, unverified empty results, mismatched
identity, extra fields, accessors, Proxy-backed row arrays and Proxy-backed rows for
both the budget update and concept insert. Before the repair it failed with
`Missing expected rejection: budget missing row count`.

## Implementation

Content Control PR #962 made the bounded intake repair:

- the budget mutation now returns the exact business identity, UTC day and a bounded
  post-increment predicate, and all three fields must match the authorized intake;
- `DAILY_CONCEPT_LIMIT` is preserved only for an exact inert zero-row mutation
  result;
- the concept insert now returns and must exactly match its ID, business,
  fingerprint, rights state and permanent-unpublication state;
- malformed, executable, mismatched or extra database evidence throws
  `POD_MUTATION_UNVERIFIED` and rolls the transaction back;
- authority-expiry and concept-budget fixtures now model the verified database
  contract explicitly.

No adapter, marketplace credential, publication route or activation setting changed.

## Local and hosted verification

Local evidence on the repaired tree:

- focused concept-budget and authority-expiry suites: 20/20 passed;
- complete `npm run test:pod`: 1,056 tests, 1,047 passed, nine
  PostgreSQL-only skips, zero failures;
- `git diff --check` passed.

All three remote blobs at exact PR head
`eb1823902440ec376cfee5616d0a047a5392f34e` matched the locally tested
files. The exact head passed:

- POD integration run `41553554914`, job `125646796075`;
- POD container runtime run `41553554893`, job `125646796296`, including the
  production image build, non-root/dependency probes, Python and Node/PostgreSQL
  suites, real print/review flow, and disabled production/publication startup.

PR #962 merged as `6cd1a5d191b7126cb10e83b9882b59fb1ac63394`.

## Money Factory dependent pin

Money Factory PR #368 changed only `.github/workflows/pod-production.yml`, pinning
the exact Content Control merge above while retaining
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

Exact pin head `3fc58dc8933c7697eac50c5b604dbf7b6f722a7d` passed
cross-repository run `41554396747`, job `125649620045`, including pinned POD
contracts, strict evidence/JSON bounds, review and KDP recovery, art/interior safety,
original-art identity, independent layout and PDF pairing, current font-rights and
retained-template checks, KDP metadata/editorial bounds, and both Money Factory
bridge suites. PR #368 merged as
`d4f14ca6eceeb62d5ab2d08ce0426eca4f2a380e`.

## Authorized Render verification

The existing free-plan, one-instance Docker service auto-deployed exact Content
Control merge `6cd1a5d191b7126cb10e83b9882b59fb1ac63394` as
`dep-dbkiqaqvcj2c739h3q10`. The deploy started at
`2026-11-03T00:39:07.322498Z`, finished at
`2026-11-03T00:40:08.767718Z` and reached `live`. Render logs independently showed
checkout of the exact merge, the worker listening on port 10000 and Render reporting
the service live.

The same logs reported `Review artifact exists but is not accepted by canonical
health state`. The checked-in live deployment health receipt remains `FAIL` with an
incomplete readiness probe. Rollout liveness is therefore not accepted evidence
readiness and does not prove a live production mutation or marketplace action.

## Acceptance truth and execution limits

This run closes one code-level database-result verification gap. Existing code,
synthetic/local tests, hosted CI and deployment liveness do not prove the dedicated
production database is mounted by this service, durable live recovery, current live
Money Factory grants, real account authority, marketplace submissions, economics,
financial reconciliation, measured capacity, end-to-end acceptance or controlled
launch readiness.

The scheduled run used only its actually available GitHub, Render and local execution
access; it did not claim a continuously running self-hosted worker. All 24 acceptance
areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory, no publication was attempted and
the completion automation remains enabled.
