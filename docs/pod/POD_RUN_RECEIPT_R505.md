# R505: explicit publication-off preflight evidence

Fresh main heads: CC dc6f4bd857ba7f02b9fb92f826c50dc17562cfe6 and
MF 332d5459d279e3bbb83e19b3e76cc338d2301362. Current checklist, implementation
status, free-deployment guide, open PRs and workflow results were reconciled.
No duplicate POD PR/job was present. Latest POD gates passed. Unrelated runtime
provenance42281580248 and review-server42278246762 fail on missing/mismatched
video caption evidence; those guards were not weakened or marked passed.

Authorized Render service remains existing free Docker/main, /health, one instance,
automatic deployment, unsuspended. Functional3a052f4f6e53386255c7dd1cfa66a91c7d846f41
is live as dep-dbn2a7942hec73fdnlb0. No configuration or credentials were changed.

## Confirmed repair

Preflight previously considered anything other than the string true proof that
publication was disabled. With otherwise valid synthetic configuration it could
return CONFIGURATION_VERIFIED with a missing flag. Both new regressions failed
against the baseline (actual CONFIGURATION_VERIFIED, expected BLOCKED).

The existing safety predicate now requires both flags to be literal false strings,
matching database-deployment and archive contracts. The same predicate is checked
before work and after owned-pool cleanup; an earlier failure cannot be cleared.
Tests cover missing/null/boolean/numeric/empty/case/whitespace/enabling/arbitrary
values for each flag at both stages, plus resource cleanup and redacted output.
No publication enablement, mutation, signing, network or storage authority added.

Focused preflight tests passed58/58 with zero skips after repair. Syntax and
whitespace passed. Full local/hosted and dependent pin results follow in the final
receipt. Source worktree lacks unrelated prior QA/ledger outputs; remote commits
are built from fresh main to preserve them. No whole-tree identity claim.

## Unfinished work

All24 live acceptance areas remain OPEN. This is fail-closed configuration
verification, not production, owner-phone, grants/rights/QA/adapters, retention,
restore, financial or throughput acceptance. Existing failed database-admin path
was not retried; no credible changed access path was found. Etsy remains excluded.
PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No paid resource,
purchase, secret disclosure, social-vault access, network widening, fabricated
approval or continuous self-hosted-worker claim. Scheduled runs use available
per-run tools only. Completion condition is unmet; automation remains enabled.
