# POD run receipt R419 — concept authority query evidence (2026-11-03 UTC)

## Scope and outcome

This run repaired two adjacent concept-authority query boundaries in the existing POD bridge. Duplicate intake previously read fingerprint matches through ordinary `rows` access before concept-budget and identity decisions, while queue admission destructured ordinary `rows` before accepting rights and business evidence. Accessor-backed query results could therefore execute code and manufacture an existing concept identity or a queue-eligible rights record. The bridge now:

- accepts only exact empty or one-row dense inert duplicate-intake evidence with exact identity, rights and tombstone fields;
- accepts only exact one-row dense inert queue-admission evidence from an explicit three-field SQL projection;
- rejects Proxy-backed, accessor-backed, sparse, oversized, extra-field and malformed evidence without invoking application-data traps or performing downstream writes;
- returns only the snapshotted queue job identity after the exact insert mutation and fresh grant revalidation.

Publication and production activation were not enabled. Etsy remained excluded.

## Content Control verification and merge

- Concurrent base: current main `c992ec7ce614d8edad81e1ebe477e3ba901dfda0`, a report-only live-health update, was preserved before the repair branch was created.
- PR: #974.
- Expected-red regression: the two focused accessor-backed cases initially produced zero passes and two failures. Both failures were `Missing expected rejection` because duplicate intake and queue admission proceeded.
- Exact tested head: `973c96434ee92ab437ec91ab616be41be86584e9`.
- POD integration gates run `41591673358`, job `125769589608`: success.
- POD container runtime gates run `41591673250`, job `125769589650`: success, including non-root/dependency probes, Python rendering/QA, Node/PostgreSQL, durable print/review and disabled-startup checks.
- Guarded merge: `718119210615d7b53ed7427a179d3f752fe69f3b`.
- All five remote changed blobs exactly matched the locally tested files.
- Focused intake, queue, budget, authority-expiry, PostgreSQL, production-E2E and worker checks passed 98 of 99 tests with zero failures and one environment-gated PostgreSQL E2E skip.
- The full local Node POD suite passed 1,070 of 1,079 tests with zero failures and nine environment-gated skips.
- `node --check pod-db-bridge.js` and `git diff --check` passed.

## Money Factory authority pin

- PR: #374.
- Exact head: `7cfea96eab12acff73f9b3cd35828e90cd16f820`.
- The branch started from current Money Factory main `d8e992391a0e764f6b9d50d87b3ebdac02a19fd6`; no concurrent POD/KDP change was overwritten.
- The cross-repository workflow pins Content Control merge `718119210615d7b53ed7427a179d3f752fe69f3b`, includes both duplicate-intake budget and queue-admission concept-authority regressions, and retains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.
- POD cross-repository review verification run `41592605765`, job `125772541657`: success.
- Guarded merge: `a287c675b704475a282ddc62a0499fb832341809`.

## Authorized Render verification

The authorized free Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) automatically created deployment `dep-dbko8o49v7es73crqr10` for exact Content Control merge `718119210615d7b53ed7427a179d3f752fe69f3b`. It reached `live` at `2026-11-03T06:52:22.900725Z`; the preceding deployment was deactivated. No manual redeploy, cache clear, plan change, purchase, secret access or network widening was used.

A live process is not live acceptance. The canonical review artifact remains unaccepted, saved deployment-health evidence remains fail-closed, and no marketplace submission was attempted.

## Acceptance truth and execution limits

All 24 acceptance areas remain OPEN. This code and its synthetic/PostgreSQL/container evidence do not supply current owner-authorized marketplace accounts, live authority/grant and revocation acceptance, official regional rights/template evidence, substantive KDP editorial and preview acceptance, calibrated independent QA, authorized submission/readback for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or statement reconciliation, accepted owner-phone operations, independent backup retention, measured 100/day or 1,000/day capacity, a real end-to-end accepted job, or controlled launch approval.

The previously failed database-administration connector/browser path was not retried because no credible changed access path was observed. This scheduled run used only its actually available tools and permissions and does not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. The recurring automation remains enabled because verified completion has not been reached.
