# POD run receipt R412 — exact queue-insert proof

Date: 2026-11-03 UTC

## Scope and starting truth

This scheduled run reconciled the current completion checklist, implementation
status, free-deployment record, repository heads, open pull requests, exact-head
workflows and the authorized Render service before implementation. Content Control
started at `d9a652af34f148cb7936b23fafc2e4e7d5fd0b68`; the Money Factory
pin PR later confirmed its then-current base as
`00e37872da30bce5f43b6f39837cd020ba2cf37b`. No open POD/KDP repair or
duplicate R412 job existed. Existing unrelated work and the dirty base checkout's
untracked dependencies/caches were left untouched; implementation used isolated
worktrees and connector-created branches.

All 24 live acceptance areas were open. The previously failed database-administration
route had no credible changed access path, so it was not retried. The run did not
access social-vault, contact a marketplace or another person, create paid
infrastructure, include Etsy, widen network access, or enable publication.

## Confirmed defect and expected-red evidence

`PodDB.enqueue` treated any nonempty `rows` value as proof that an authorized queue
insert succeeded. It did not require `rowCount`, exact row shape, or the requested job
identity. A malformed, driver-stubbed or unexpected database result could therefore
report an authorized job as enqueued without exact durable mutation proof.

The new regression exercised a missing row count, mismatched identity, extra fields,
contradictory zero-row evidence, accessors, a result Proxy, Proxy-backed row arrays and
a Proxy-backed row. Before the repair it failed with
`Missing expected rejection: missing row count`.

## Implementation

Content Control PR #960 made the bounded queue-boundary repair:

- a successful insert must have an inert own-data `rowCount` of one, an exact
  one-element non-Proxy row array and a row containing only the requested job ID;
- malformed, executable or mismatched results throw `POD_MUTATION_UNVERIFIED` and
  roll back;
- the existing `DUPLICATE_JOB` contract is preserved only for an exact inert
  `rowCount: 0` and genuinely empty non-Proxy row array returned by
  `ON CONFLICT DO NOTHING`;
- the authority-expiry fixture now models the verified insert result explicitly.

No adapter, marketplace credential, publication route or activation setting changed.

## Local and hosted verification

Local evidence on the repaired tree:

- focused enqueue and authority-expiry suites: 39/39 passed;
- complete `npm run test:pod`: 1,055 tests, 1,046 passed, nine
  PostgreSQL-only skips, zero failures;
- `git diff --check` passed.

All three remote blobs at exact PR head
`6f8fecfb3a68f74aea841106030632cf6298aa23` matched the locally tested
files. The exact head passed:

- POD integration run `41551525364`, job `125640025793`;
- POD container runtime run `41551525355`, job `125640025544`, including the
  production image build, non-root/dependency probes, Python and Node/PostgreSQL
  suites, real print/review flow, and disabled production/publication startup.

PR #960 merged as `5f80e4b28fa2a1671869486458f8c0db7ed16645`.

## Money Factory dependent pin

Money Factory PR #367 changed only `.github/workflows/pod-production.yml`, pinning
the exact Content Control merge above while retaining
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

Exact pin head `bfaf58d365c396ff9e472695f5b4fc21305b4e09` passed
cross-repository run `41552408037`, job `125642988024`, including pinned POD
contracts, strict evidence/JSON bounds, review and KDP recovery, art/interior safety,
original-art identity, independent layout and PDF pairing, current font-rights and
retained-template checks, KDP metadata/editorial bounds, and both Money Factory
bridge suites. PR #367 merged as
`471f7a4819f80728be2b7c1972242e77cec8f9d5`.

## Authorized Render verification

The existing free-plan, one-instance Docker service auto-deployed exact Content
Control merge `5f80e4b28fa2a1671869486458f8c0db7ed16645` as
`dep-dbkiigm417fc73a9f17g`. The deploy started at
`2026-11-03T00:22:26.350760Z`, finished at
`2026-11-03T00:23:37.665291Z` and reached `live`. Render logs independently showed
checkout of the exact merge, the worker listening on port 10000 and Render reporting
the service live.

The same logs reported `Review artifact exists but is not accepted by canonical
health state`. That remains the correct fail-closed readiness result. Rollout
liveness is not accepted evidence readiness and does not prove a live production
mutation or any marketplace action.

## Acceptance truth and execution limits

This run closes one code-level database-result verification gap. Existing code,
synthetic/local tests, hosted CI and deployment liveness do not prove a dedicated
production database, durable recovery under the live service, current live Money
Factory grants, real account authority, marketplace submissions, economics,
financial reconciliation, measured capacity, end-to-end acceptance or controlled
launch readiness.

The scheduled run used only its actually available GitHub, Render and local execution
access; it did not claim a continuously running self-hosted worker. All 24 acceptance
areas remain OPEN. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory, no publication was attempted and
the completion automation remains enabled.
