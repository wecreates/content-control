# POD run receipt R415 — production claim mutation evidence (2026-11-03 UTC)

## Scope and outcome

This run repaired the next unverified durable mutation boundary in the existing POD production queue. `claimProduction()` previously committed a raw-to-processing lease from unchecked driver-owned `rowCount` and `rows`, returned `RETURNING *`, and could therefore report a claimed job without exact one-or-zero mutation proof. It now:

- accepts only an exact empty receipt or one exact dense inert result row;
- uses an explicit return projection;
- validates the claimed id, account, platform, processing state, positive attempt and PostgreSQL bigint fencing token;
- snapshots the bounded JSON brief without accessors, Proxies, sparse arrays or executable prototypes;
- preserves the validated `state:'processing'` compatibility contract.

Publication and production activation were not enabled. Etsy remained excluded.

## Content Control verification and merge

- PR: #966.
- Initial tested head `86b5accd129cac9709f79626550be143e1326ede` exposed a real PostgreSQL compatibility failure in integration run `41570005445`, job `125700439030`: the new data-only result omitted the already-validated processing state expected by `verifyProductionClock`. The failure was repaired rather than waived.
- Final exact tested head: `0c51fd8662c7ce93145f6475e3a81e0cb9040da5`.
- POD integration gates run `41570169224`, job `125700946840`: success.
- POD container runtime gates run `41570169232`, job `125701364689`: success, including dependency-backed Python, Node/PostgreSQL, real print/review generation and disabled-startup checks.
- Guarded merge: `23fa07103e52566b55b60a1cbf856cac678c0c9b`.
- Both final remote changed blobs exactly matched the locally tested files.
- Focused local claim/worker checks passed 36 tests with zero failures. The earlier focused claim/worker/recovery set passed 37 tests. The full local Node POD suite passed 1,054 of 1,063 tests with zero failures and nine PostgreSQL-only skips.
- Local Python discovery passed 264 tests and had two import errors because this scheduled executor did not have OpenCV. Those imports were not counted as local passes; the hosted dependency-backed gates above supplied the complete verification.
- `node --check pod-db-bridge.js` and `git diff --check` passed.

## Money Factory authority pin

- PR: #370.
- Exact head: `498154ddcb0e39cbe6c6cab3c307b91485de3564`.
- The cross-repository workflow pins Content Control merge `23fa07103e52566b55b60a1cbf856cac678c0c9b`, includes the new claim-mutation regression, and retains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.
- POD cross-repository review verification run `41571084278`, job `125703873588`: success.
- Guarded merge: `2b22d2fa38546b1d93b2ee0d06820b5f6d01a72a`.

## Authorized Render verification

The authorized free Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) automatically created deployment `dep-dbkl3ct9el5s73elhqu0` for exact Content Control merge `23fa07103e52566b55b60a1cbf856cac678c0c9b`. It reached `live` at `2026-11-03T03:16:24.144536Z`. No manual redeploy, cache clear, plan change, purchase, secret access or network widening was used.

A live process is not live acceptance. The canonical review artifact remains unaccepted, the saved deployment-health evidence remains fail-closed, and no marketplace submission was attempted.

## Acceptance truth and execution limits

All 24 acceptance areas remain OPEN. This code and its synthetic/PostgreSQL/container evidence do not supply current owner-authorized marketplace accounts, live authority/grant and revocation acceptance, official regional rights/template evidence, substantive KDP editorial and preview acceptance, calibrated independent QA, authorized submission/readback for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or statement reconciliation, accepted owner-phone operations, independent backup retention, measured 100/day or 1,000/day capacity, a real end-to-end accepted job, or controlled launch approval.

The previously failed database-administration connector/browser path was not retried because no credible changed access path was observed. This scheduled run used only its actually available tools and permissions and does not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. The recurring automation remains enabled because verified completion has not been reached.
