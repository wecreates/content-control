# POD run receipt R414 — bounded lease-recovery mutation proof

Date: 2026-11-03 UTC

## Scope and starting truth

This scheduled run reconciled the current completion checklist, implementation
status, free-deployment record, repository heads, open pull requests, exact-head
workflows and the authorized Render service before implementation. Content Control
started at `77052c61e1611487254d707001260284a190c241`; Money Factory
started at `d4f14ca6eceeb62d5ab2d08ce0426eca4f2a380e`. No open POD/KDP
repair or duplicate R414 job existed. Content Control draft PR #378 explicitly said
it contained no POD changes. Existing unrelated work and the dirty base checkout's
untracked dependencies and caches were left untouched; implementation used isolated
worktrees and connector-created branches.

All 24 live acceptance areas were open. The previously failed database-administration
route had no credible changed access path available to this run, so it was not
retried. The run did not access social-vault, contact a marketplace or another
person, create paid infrastructure, include Etsy, widen network access, or enable
publication.

## Confirmed defect and expected-red evidence

`PodDB.recover()` committed the publishing and processing lease-expiry updates
without inspecting their database results. A missing, malformed, executable or
driver-stubbed mutation response could therefore be reported as a successful
recovery sweep without exact proof of the durable identities, states and reason
codes that changed.

The regression covers missing and mismatched row counts, sparse and extended row
arrays, oversized results, invalid and duplicate identities, unexpected fields,
wrong transitions, accessors, Proxy-backed results, Proxy-backed row arrays and
Proxy-backed rows. Before the repair it reproduced the fail-open behavior with
`Missing expected rejection`.

## Implementation

Content Control PR #964 made the recovery repair:

- each publishing and processing sweep selects at most 100 expired candidates with
  `FOR UPDATE SKIP LOCKED`, so proof rows are bounded and later worker cycles drain
  any backlog;
- both updates return the exact queue identity, resulting state and reason code;
- the verifier requires a nonnegative bounded safe row count, an exact dense row
  array, exact non-executable row fields, valid unique identities, the expected
  state/reason pair and no identity appearing in both transitions;
- malformed or mismatched evidence throws `POD_MUTATION_UNVERIFIED` and rolls the
  transaction back.

No adapter, marketplace credential, publication route or activation setting changed.

## Local and hosted verification

Local evidence on the repaired tree:

- focused recovery, production-lease and worker suites: 60/60 passed;
- complete `npm run test:pod`: 1,060 tests, 1,051 passed, nine
  PostgreSQL-only skips, zero failures;
- syntax and `git diff --check` passed.

The isolated worktree initially lacked its own dependency directory, so one local
full-suite invocation failed eight import-only cases because `pg` was unavailable.
The run reused the already installed repository dependency tree through a temporary
worktree symlink, reran the complete suite successfully as recorded above and
removed the symlink. No dependency was purchased or newly downloaded.

Both remote blobs at exact PR head
`9f846c75cfd36e2100c750e0b7a210b52bf30a83` matched the locally tested files.
The exact head passed:

- POD integration run `41560339046`, job `125669173563`, including the changed
  SQL against PostgreSQL 18;
- POD container runtime run `41560339010`, job `125669172904`, including the
  production image build, non-root/dependency probes, Python and Node/PostgreSQL
  suites, real print/review flow, and disabled production/publication startup.

PR #964 merged as `135c455bf7ab39ffd996066128e59007797ba967`.

## Money Factory dependent pin

Money Factory PR #369 changed only `.github/workflows/pod-production.yml`, pinning
the exact Content Control merge above while retaining
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.

Exact pin head `d30b49e91e4c5540b5d7349f206dd9e9438b3b40` passed
cross-repository run `41561242254`, job `125672088444`, including pinned POD
contracts, strict evidence/JSON bounds, review and KDP recovery, art/interior safety,
original-art identity, independent layout and PDF pairing, current font-rights and
retained-template checks, KDP metadata/editorial bounds, and both Money Factory
bridge suites. PR #369 merged as
`2e04e464772577e6056eb539eb2933788b8c4a49`.

## Authorized Render verification

The existing free-plan, one-instance Docker service auto-deployed exact Content
Control merge `135c455bf7ab39ffd996066128e59007797ba967` as
`dep-dbkjmmm7bikc73927e3g`. The deploy started at
`2026-11-03T01:39:38.623835Z`, finished at
`2026-11-03T01:40:47.464394Z` and reached `live`. Render logs independently showed
checkout of the exact merge, the worker listening on port 10000 and Render reporting
the service live.

The same logs reported `Review artifact exists but is not accepted by canonical
health state`. The checked-in live deployment health receipt remains `FAIL` with an
incomplete readiness probe. Rollout liveness is therefore not accepted evidence
readiness and does not prove a live recovery mutation or marketplace action.

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
