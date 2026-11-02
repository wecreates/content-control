# POD run receipt R409 — exact settlement mutation proof

Date: 2026-11-02 UTC

## Scope and starting truth

This scheduled run reconciled the next production-settlement integrity repair after
freshly reading both repository heads, open pull requests and hosted workflow
results. No duplicate POD/KDP repair was opened. The pre-existing dirty checkout
was preserved and implementation was tested in an isolated worktree.

All 24 live acceptance areas were still open. There was no credible changed
database-administration access path, so the previously failed connector/browser
route was not retried. This run did not access social-vault, contact a marketplace
or another person, create paid infrastructure, include Etsy, widen network access,
or enable production publication.

## Confirmed defect and repair

Production queue settlement for submitted, ambiguous and blocked outcomes accepted
a merely nonempty queue-update result and did not require exact proof of the matching
audit event. A driver stub or malformed database result could therefore make the
caller report durable settlement without proving the authorized job, derived state,
reason code and audit identity that were actually stored.

The pre-fix regression failed with `Missing expected rejection`. Content Control
PR #953 changed the queue mutations to require exact returned database identity for
the authorized job, expected state and expected reason, and changed the audit insert
to require the exact event identity, job and event kind. Missing rows, mismatches,
accessor-backed objects and Proxy-backed objects now fail closed without invoking
executable properties. No publication adapter or activation setting changed.

## Verification and merge

Local evidence on the repaired tree:

- focused production settlement suites: 106 passed, one PostgreSQL-only skip, zero
  failures;
- complete `npm run test:pod`: 1,052 tests, 1,043 passed, nine PostgreSQL-only
  skips, zero failures;
- the expected-red reproduction and `git diff --check` passed as intended.

Exact PR head `acdc6552772346c45c440c4a1908ce9845424f60` passed both hosted
gates:

- integration run `41238495640`, job `124647191996`: success;
- container run `41238495669`, job `124647192391`: success.

PR #953 merged as `e50512121de5f8f1cd54084497a3eb8af062a920`.

Money Factory PR #364 changed the pinned Content Control revision to that exact
merge while keeping `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Exact pin head
`f63f4725a6f4029bcfd2f48a3268e3fd7e3fd39f` passed cross-repository run
`41256833534`, job `124701678458`, then merged as
`f91f312a2986685ddc25676a93bd95f6a024e794`.

## Acceptance truth

This closes one database-result verification gap in code and hosted tests. It does
not prove the production database/schema, a live settlement, marketplace authority,
an external submission, revenue, recovery, capacity or end-to-end acceptance.
Existing code and synthetic tests are not live acceptance. All 24 acceptance areas
remain OPEN, both publication flags remain false, no publication was attempted and
the completion automation remains enabled.
