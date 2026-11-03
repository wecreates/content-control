# POD run receipt R417 — final publishing guard query evidence (2026-11-03 UTC)

## Scope and outcome

This run repaired the final local pre-submit query boundary in the existing POD publisher. `assertPublishable()` previously read the authoritative publishing row and live lease through ordinary `rows` property access. Accessor-backed query results could therefore manufacture valid durable-snapshot and lease evidence, execute code during a release-critical check, and make the guard return `true`. It now:

- accepts only an exact empty or one-row dense inert query result;
- rejects accessor-backed or Proxy-backed results, rows, records and nested manifest/QA evidence without invoking application-data traps;
- rejects sparse, oversized, extra-field, route-mismatched and malformed SHA evidence;
- snapshots the manifest and QA envelope before validating them against the claimed release;
- preserves the existing `LOCAL_RELEASE_BLOCKED` result for legitimate missing, expired or changed durable state.

Publication and production activation were not enabled. Etsy remained excluded.

## Content Control verification and merge

- PR: #970.
- Expected-red regression: `node --test tests/pod-publish-guard-query.test.mjs` initially produced zero passes and two failures. Both failures were `Missing expected rejection`: accessor-backed durable-snapshot and lease results made `assertPublishable()` return success.
- Exact tested head: `f8edd42fbf58c92fd46816cfebcbd5c40cdb0407`.
- POD integration gates run `41581253975`, job `125736383145`: success.
- POD container runtime gates run `41581253860`, job `125736382927`: success, including dependency-backed Python, Node/PostgreSQL, real print/review generation and disabled-startup checks.
- Guarded merge: `915c063fe2fb9155d68324af6b9c8466ec2d1a19`.
- Both final remote changed blobs exactly matched the locally tested files.
- Focused publisher/KDP/clock/settlement/worker checks passed 106 tests with zero failures.
- The full local Node POD suite passed 1,062 of 1,071 tests with zero failures and nine environment-gated skips.
- `node --check pod-db-bridge.js` and `git diff --check` passed.

## Money Factory authority pin

- PR: #372.
- Exact head: `f0bf43e195ac323ef9f85b8676e2900ee8c80b0c`.
- The branch preserved unrelated main commit `30a6ecfdad0ac09351965fa5974971c6cb4b76d9` (`free monitor cadence tick`).
- The cross-repository workflow pins Content Control merge `915c063fe2fb9155d68324af6b9c8466ec2d1a19`, includes the final publishing-guard query regression, and retains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.
- POD cross-repository review verification run `41581918869`, job `125738476133`: success.
- Guarded merge: `54b2b122747b76277bbbc8152f3d38eb424839fc`.

## Authorized Render verification

The authorized free Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) automatically created deployment `dep-dbkmned9el5s73en8ol0` for exact Content Control merge `915c063fe2fb9155d68324af6b9c8466ec2d1a19`. It reached `live` at `2026-11-03T05:07:13.76011Z`. No manual redeploy, cache clear, plan change, purchase, secret access or network widening was used.

A live process is not live acceptance. The canonical review artifact remains unaccepted, the saved deployment-health evidence remains fail-closed, and no marketplace submission was attempted.

## Acceptance truth and execution limits

All 24 acceptance areas remain OPEN. This code and its synthetic/PostgreSQL/container evidence do not supply current owner-authorized marketplace accounts, live authority/grant and revocation acceptance, official regional rights/template evidence, substantive KDP editorial and preview acceptance, calibrated independent QA, authorized submission/readback for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or statement reconciliation, accepted owner-phone operations, independent backup retention, measured 100/day or 1,000/day capacity, a real end-to-end accepted job, or controlled launch approval.

The previously failed database-administration connector/browser path was not retried because no credible changed access path was observed. This scheduled run used only its actually available tools and permissions and does not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. The recurring automation remains enabled because verified completion has not been reached.
