# POD run receipt R421

Run completed at `2026-11-03T09:03:49Z` using only the repositories' existing
GitHub Actions workflows and the owner's existing free Render service. This receipt
records code and deployment evidence; it does not claim live marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at receipt merge
  `c9573d6eff6a8021ac6fba122335ccd4a19e431d`.
- Money Factory `main` began at
  `ea5eba06d2e76752bf7924a1e0fcf6bfebd86558`.
- Render deployment `dep-dbkot7bbc2fs7384etkg` was live on exact functional
  merge `b882dd9cd89419c410e4a1a52370a68a52c63de0`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Etsy PRs 80 and 81 remain excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of the
  24 acceptance areas.

## Confirmed defect and repair

`holdProduction` and the passing path of `completeProduction` acquired the current
lease and rights locks, then read the regional-rights result through ordinary
`result.rows[0]` access. An accessor-backed database result could therefore execute
and supply `PASS` evidence immediately before durable review-hold or completion
writes.

Two regression cases exercised those exact transitions. Before the repair, the
focused file ran 29 tests: 27 passed and both new cases failed with
`Missing expected rejection`, proving the getter-backed result was accepted. The
repair routes both queries through the existing exact inert-row snapshot boundary,
requires exactly `rights_state` and `permanently_unpublished`, validates the rights
enum and boolean tombstone, and rejects executable, malformed, missing or oversized
query evidence before any write. Fixtures were narrowed to the actual SQL projection.

After repair:

- affected production-lease and QA-expiry suites: 40 passed, zero failed;
- complete local `npm run test:pod`: 1,076 passed, nine environment-gated skips,
  zero failed, 1,085 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 978 used exact head
`fd837a6f616cc6cbbcb1af4095344877505c2bbc`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `eee36f5e71cebf9b64bd6d5e7878dea67df6e53b`;
- `tests/pod-production-lease.test.mjs`:
  `602c8a0d9aea2e814ac9d2dbef0bc54fe1a170a5`.

Exact-head integration run `41606424797`, job `125817274393`, and container run
`41606424742`, job `125817274022`, both completed successfully. The container gate
also verified the non-root image, PostgreSQL/Node and Python suites, durable print
review path, and startup with publication and production disabled. PR 978 merged as
`76af695f2599ac86d6fa0e815b58ad55106d74f0`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) created deployment
`dep-dbkq4dqvcj2c739p1qfg` for that exact functional merge. It reached `live` at
`2026-11-03T09:00:25.650781Z`, and the prior deployment was deactivated. This proves
deployment liveness for the repaired image, not canonical `/readyz`, accepted review
evidence, marketplace connectivity or end-to-end acceptance.

Money Factory PR 376 changed only `.github/workflows/pod-production.yml`, pinning
the exact Content Control merge above. The pinned workflow already includes
`tests/pod-production-lease.test.mjs`; `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remain literal `false`. Exact head
`77cf5fc80e2943d5264ed80cff1bf44932490fbd` passed cross-repository run
`41607376941`, job `125820491356`, and PR 376 merged as
`342a0da66ed7b20a192d2fe68aec0403e403dc6d`.

## Boundaries and unfinished work

- No marketplace adapter was contacted and no KDP, Redbubble, TeePublic, Zazzle,
  Spreadshirt or Etsy submission occurred.
- No purchase, paid resource, message, secret disclosure, social-vault access,
  bot-detection evasion or network widening occurred.
- Database administration was not retried because no credible changed access path
  appeared. The prior connector/browser limitation remains unchanged.
- Scheduled execution used only the tools and permissions actually present for this
  run; it is not evidence of a continuously running self-hosted worker.
- Existing code, CI and deployment liveness do not close live acceptance. The
  canonical review artifact remains unaccepted and the saved deployment-health
  receipt remains fail-closed.
- All 24 acceptance areas remain OPEN. Publication remains disabled pending the
  owner's explicit approval only after all criteria have verifiable live evidence.
- The completion automation therefore remains enabled.
