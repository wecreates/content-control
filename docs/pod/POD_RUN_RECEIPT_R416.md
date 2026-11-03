# POD run receipt R416 — publishing claim mutation evidence (2026-11-03 UTC)

## Scope and outcome

This run repaired the next unverified durable mutation boundary in the existing POD publishing claim transaction. `claimPublish()` previously accepted an unchecked queue-transition result, ignored the quota-reservation result, ignored the account-cooldown result, and could therefore commit while reporting success without exact proof for all three mutations. It now:

- accepts only one exact, dense, inert publishing-claim result row with an explicit return projection;
- snapshots the bounded `brief`, `manifest` and `qa_envelope` JSON without accessors, Proxies, sparse arrays or executable prototypes;
- validates the job, account, platform, idempotency key, publishing state, positive attempt and PostgreSQL bigint fencing token;
- requires exact quota-reservation and account-cooldown receipts inside the same transaction;
- rolls the whole transaction back on missing, malformed, extra or mismatched mutation evidence.

Publication and production activation were not enabled. Etsy remained excluded.

## Content Control verification and merge

- PR: #968.
- Expected-red regression: `node --test tests/pod-publish-claim-mutation.test.mjs` initially produced one pass and three failures, each `Missing expected rejection`, proving malformed queue-transition, quota-reservation and cooldown results could pass.
- Exact tested head: `68e0dead19820de69a93fba8900389e338fca9eb`.
- POD integration gates run `41573389571`, job `125711242496`: success.
- POD container runtime gates run `41573389443`, job `125711242594`: success, including dependency-backed Python, Node/PostgreSQL, real print/review generation and disabled-startup checks.
- Guarded merge: `11a662bb8c57e55e925d44bf855fcd2ca4d3cef5`.
- All four final remote changed blobs exactly matched the locally tested files.
- Focused claim/KDP/clock/publisher/settlement/worker checks passed 98 tests with zero failures.
- Claim and storage-checkpoint compatibility checks passed 12 tests with zero failures.
- The full local Node POD suite passed 1,058 of 1,067 tests with zero failures and nine environment-gated skips.
- `node --check pod-db-bridge.js` and `git diff --check` passed.

## Money Factory authority pin

- PR: #371.
- Exact head: `d156d9e24197fa163feb3cc8474baaf132d77ff4`.
- The cross-repository workflow pins Content Control merge `11a662bb8c57e55e925d44bf855fcd2ca4d3cef5`, includes the publishing-claim mutation regression, and retains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.
- POD cross-repository review verification run `41574063802`, job `125713392844`: success.
- Guarded merge: `2ea611aea02475e6871885adcd468e3a2e0b0573`.

## Authorized Render verification

The authorized free Render service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) automatically created deployment `dep-dbklhem7bikc73942nag` for exact Content Control merge `11a662bb8c57e55e925d44bf855fcd2ca4d3cef5`. It reached `live` at `2026-11-03T03:46:08.898459Z`. No manual redeploy, cache clear, plan change, purchase, secret access or network widening was used.

A live process is not live acceptance. The canonical review artifact remains unaccepted, the saved deployment-health evidence remains fail-closed, and no marketplace submission was attempted.

## Acceptance truth and execution limits

All 24 acceptance areas remain OPEN. This code and its synthetic/PostgreSQL/container evidence do not supply current owner-authorized marketplace accounts, live authority/grant and revocation acceptance, official regional rights/template evidence, substantive KDP editorial and preview acceptance, calibrated independent QA, authorized submission/readback for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, actual economics or statement reconciliation, accepted owner-phone operations, independent backup retention, measured 100/day or 1,000/day capacity, a real end-to-end accepted job, or controlled launch approval.

The previously failed database-administration connector/browser path was not retried because no credible changed access path was observed. This scheduled run used only its actually available tools and permissions and does not claim a continuously running self-hosted worker.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. The recurring automation remains enabled because verified completion has not been reached.
