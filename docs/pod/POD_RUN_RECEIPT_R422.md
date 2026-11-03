# POD run receipt R422

Run completed at `2026-11-03T10:33:37Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at receipt merge
  `0065e0656f1e3c7250308df8639903f11bfdf819`.
- Money Factory `main` began at
  `342a0da66ed7b20a192d2fe68aec0403e403dc6d`.
- Render deployment `dep-dbkq4dqvcj2c739p1qfg` was live on exact functional
  merge `76af695f2599ac86d6fa0e815b58ad55106d74f0`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Etsy remains excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

`requeueRepair` selected `q.*`, trusted `result.rows[0]`, and then read the
returned brief, attempt, manifest, QA envelope and reason before archiving the
failed attempt and resetting the queue row. Accessor-backed database evidence
could therefore execute and authorize remediation writes.

Two expected-red regressions covered executable `rows` and `brief` evidence.
Before the repair, the focused file ran 16 tests: 14 passed and both new cases
failed with `Missing expected rejection`. The repair replaces the broad
projection with the exact six required fields, requires an inert exact row and
job identity, bounds the attempt, and snapshots structured JSON before any
write. Both accessors are rejected without invocation or writes.

The first clean hosted PostgreSQL run then found that the initial validator also
rejected a legitimate legacy `qa_failed` row whose `reason_code` was SQL
`NULL`. Integration run `41618047569`, job `125856342959`, failed one of
1,087 tests with `POD_QUERY_UNVERIFIED` instead of the expected
`ENVELOPE_EXPIRED_OR_INVALID`; its paired container run `41618047608` was
cancelled after the head was superseded. The validator was narrowed to accept
only `NULL` or a valid inert reason string. A regression proves `NULL`
archives as the pre-existing fixed `PRODUCTION_BLOCKED` fallback.

After the correction:

- affected repair-admission and authority-expiry suites: 32 passed, zero failed;
- complete local `npm run test:pod`: 1,079 passed, nine environment-gated
  skips, zero failed, 1,088 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 980 used exact head
`845f077b5ea6e485d2e9ec673959251c64290015`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `a4f7f36f49230ac7d28b38d6550fec6c3336783b`;
- `tests/pod-authority-expiry.test.mjs`:
  `6ed2b943e65853a110c373dc72c5b0749000de18`;
- `tests/pod-repair-admission.test.mjs`:
  `867218b7212d4b6a0e15c21f8b56a402157b4ae6`.

Exact-head integration run `41618558234`, job `125858065731`, and container
run `41618558197`, job `125858268106`, both completed successfully. The
clean PostgreSQL-backed Node stage exercised the legacy-null case. The container
gate also verified the non-root image, PostgreSQL/Node and Python suites, durable
print review path, and startup with publication and production disabled. PR 980
merged as `9e31ad9c1372d9b61e350e61a182aed21992e9b8`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbkre8rbc2fs7387fomg` for that exact functional merge. It reached `live`
at `2026-11-03T10:28:58.467155Z`, and the prior deployment was deactivated.
No manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 377 changed only
`.github/workflows/pod-production.yml`, pinning the exact Content Control merge
above and adding `tests/pod-repair-admission.test.mjs` and
`tests/pod-authority-expiry.test.mjs` to the cross-repository gate.
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `false`.
Exact head `6085c623c258b3433ba5e98e0cd407ba22dfa50d` passed cross-repository
run `41619509739`, job `125861334952`, and PR 377 merged as
`a4fbdc1e5b70b54700e08ccba87482c0af736008`.

## Boundaries and unfinished work

- No marketplace adapter was contacted and no KDP, Redbubble, TeePublic, Zazzle,
  Spreadshirt or Etsy submission occurred.
- No purchase, paid resource, message, secret disclosure, social-vault access,
  bot-detection evasion or network widening occurred.
- Database administration was not retried because no credible changed access
  path appeared. The prior connector/browser limitation remains unchanged.
- Scheduled execution used only the tools and permissions actually present for
  this run; it is not evidence of a continuously running self-hosted worker.
- Existing code, CI and deployment liveness do not close live acceptance. The
  canonical review artifact remains unaccepted and the saved deployment-health
  receipt remains fail-closed.
- All 24 acceptance areas remain OPEN. Publication remains disabled pending the
  owner's explicit approval only after every criterion has verifiable live
  evidence.
- The completion automation therefore remains enabled.
