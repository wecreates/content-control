# POD run receipt R420 — settlement lease query evidence (2026-11-03 UTC)

## Scope and outcome

This run repaired the shared production and publishing settlement lease query boundary in the existing POD bridge. The final pre-generation and pre-submit guards already required exact inert query evidence, but later durable production-failure, review-hold, completion and marketplace-settlement paths still read the locked job and live lease through ordinary `rows[0]` access. Accessor-backed results could therefore execute code and manufacture a current job lock or unexpired lease immediately before durable writes. The shared lease helpers now:

- accept only an exact empty or one-row dense inert locked-job result whose identity matches the requested job;
- accept only an exact empty or one-row dense inert live-clock lease result;
- reject accessor-backed, Proxy-backed, sparse, oversized, extra-field and identity-mismatched evidence before any settlement write;
- preserve `LEASE_LOST` for legitimate missing or expired rows while malformed query evidence reports `POD_QUERY_UNVERIFIED`.

Publication and production activation were not enabled. Etsy remained excluded.

## Content Control verification and merge

- Concurrent base: current main `9a22ea53706d8f5b2f9a32582d03ea85ac06aa16`, the R419 report-only receipt merge, was preserved before the repair branch was created.
- PR: #976.
- Expected-red regression: all four focused accessor-backed current-lock and lease-clock cases initially failed with `Missing expected rejection`, producing zero passes and four failures while the settlement paths proceeded.
- Exact tested head: `2ce0543a33deba469f2a2f28e3b0f0aa5bbf73a9`.
- POD integration gates run `41596408486`, job `125784696726`: success.
- POD container runtime gates run `41596408398`, job `125784695852`: success, including non-root/dependency probes, Python rendering/QA, Node/PostgreSQL, durable print/review and disabled-startup checks.
- Guarded merge: `b882dd9cd89419c410e4a1a52370a68a52c63de0`.
- All three remote changed blobs exactly matched the locally tested files.
- Focused settlement, final-guard, release, worker, production-E2E and PostgreSQL-gated checks passed 135 of 137 tests with zero failures and two environment-gated PostgreSQL skips.
- The full local Node POD suite passed 1,074 of 1,083 tests with zero failures and nine environment-gated skips.
- `node --check pod-db-bridge.js` and `git diff --check` passed.

## Money Factory authority pin

- PR: #375.
- Exact head: `d9124bd29ac07b82c4cf7f30ecfda9df400863d6`.
- The branch started from current Money Factory main `a287c675b704475a282ddc62a0499fb832341809`; no concurrent POD/KDP change was overwritten.
- The cross-repository workflow pins Content Control merge `b882dd9cd89419c410e4a1a52370a68a52c63de0`, retains production-lease coverage, adds QA-expiry coverage for the hardened settlement path, and keeps literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.
- POD cross-repository review verification run `41597357548`, job `125787715264`: success.
- Guarded merge: `ea5eba06d2e76752bf7924a1e0fcf6bfebd86558`.

## Authorized Render verification

The authorized free Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) automatically created deployment `dep-dbkot7bbc2fs7384etkg` for exact Content Control merge `b882dd9cd89419c410e4a1a52370a68a52c63de0`. It reached `live` at `2026-11-03T07:36:04.323379Z`; the preceding deployment was deactivated. No manual redeploy, cache clear, plan change, purchase, secret access or network widening was used.

A live process is not live acceptance. The canonical review artifact remains unaccepted, saved deployment-health evidence remains fail-closed, and no marketplace submission was attempted.

## Acceptance truth and execution limits

All 24 acceptance areas remain OPEN. This code and its synthetic/PostgreSQL/container evidence do not supply current owner-authorized marketplace accounts, live authority/grant and revocation acceptance, official regional rights/template evidence, substantive KDP editorial and preview acceptance, calibrated independent QA, authorized submission/readback for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or statement reconciliation, accepted owner-phone operations, independent backup retention, measured 100/day or 1,000/day capacity, a real end-to-end accepted job, or controlled launch approval.

The previously failed database-administration connector/browser path was not retried because no credible changed access path was observed. This scheduled run used only its actually available tools and permissions and does not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. The recurring automation remains enabled because verified completion has not been reached.
