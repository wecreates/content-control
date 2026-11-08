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

Focused preflight tests passed 58/58 with zero skips after repair. Syntax and
whitespace passed. Full local Node passed 1,212 with nine expected environment
skips (1,221 total), zero failures. MF local bridge passed 279 Node tests with
one expected database skip (280 total) and all 81 Python tests. Full Python and
hosted/dependent-pin results follow below. Source worktree lacks unrelated prior QA/ledger outputs; remote commits
are built from fresh main to preserve them. No whole-tree identity claim.

Full local Python passed all 385 tests in 310.763 seconds. Expected MuPDF
warnings from hostile annotation fixtures were not test failures.

## Hosted verification and merge

[CC PR1132](https://github.com/wecreates/content-control/pull/1132), exact head
cf1713918bbe5290d49c287ea5329ff0fadfaa01, passed integration
[42282067822](https://github.com/wecreates/content-control/actions/runs/42282067822),
job128113331236, and production-container
[42282067927](https://github.com/wecreates/content-control/actions/runs/42282067927),
job128113332229. Fresh unchanged main/head and mergeability checks preceded
guarded squash merge37769f83dada4874c99dfeffa72e7e3ea106dd04. All four changed
remote blob hashes match local files. Concurrent QA/ledger outputs were preserved.
Both hosted gates passed all 1,221 Node/PostgreSQL tests without skips and all
385 Python tests, plus durable E2E checks; the container gate also verified startup.

[MF PR460](https://github.com/wecreates/Money-factory/pull/460) changes only the
consumer pin to that CC merge, preserving both literal false publication flags.
Remote workflow blob040c0c6cca16d8c967388771a16c39700a7274b0 matches local.
Exact head fd74b35e075a5be28d33ba2142f9aa9b076d2f84 passed cross-repository
[42283181099](https://github.com/wecreates/Money-factory/actions/runs/42283181099),
job128117162938: 898 selected CC Node contracts, 280 MF Node/PostgreSQL tests,
all selected CC Python stages and all 81 MF Python tests, zero failures/skips.
Fresh unchanged main/head and mergeability checks preceded guarded squash merge
f86f4d01fd9efcde5992c8576d71de722e362035. Both flags remain literal false.

## Deployment verification

Automatic Render deploy dep-dbn2usc9v7es739vubk0 of exact functional merge
37769f83dada4874c99dfeffa72e7e3ea106dd04 reached live at
2026-11-06T19:51:22.490649Z. No duplicate rollout or configuration change was made.
Independent public cloud-browser /api/print/status observation on that rollout
showed service, production and outbox DISABLED, publication_enabled=false,
publication_requested=false, adapters_verified=false and storage acceptance
unverified. The configured cutoff remains December1; this is not retention proof.
/health returned alive=true, production_approved=false and publication=false,
with readiness kept separate. No key was entered. The previous ephemeral tab was
gone, so a new public tab was used. Local-browser extension availability remains
unestablished; this is cloud-browser evidence, not owner-phone acceptance or a
live authenticated preflight. Database-admin access was not retried.

## Unfinished work

All 24 live acceptance areas remain OPEN. This is fail-closed configuration
verification, not production, owner-phone, grants/rights/QA/adapters, retention,
restore, financial or throughput acceptance. Existing failed database-admin path
was not retried; no credible changed access path was found. Etsy remains excluded.
PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No paid resource,
purchase, secret disclosure, social-vault access, network widening, fabricated
approval or continuous self-hosted-worker claim. Scheduled runs use available
per-run tools only. Completion condition is unmet; automation remains enabled.
