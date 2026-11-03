# POD run receipt R426

Run completed at `2026-11-03T14:12:10Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R425 receipt merge
  `7e117c27802e7c4d5312a4d5c90c8d28753bc59f`.
- Money Factory `main` began at
  `b37f95d27dc26b3f05ead5e201ce0835d7fc0297`.
- Render deployment `dep-dbktibe7bikc739dj6kg` was live on exact functional
  merge `6fc91d3ed5ba916e15ab14eaa7f1ff62ae20c81a`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Money Factory PRs 80 and 81 are Etsy work and remain
  excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

The publish-claim path still consumed database-owned account-lock, account,
busy-state, quota, publish-candidate, prior-KDP-submission and weekly-count
query values directly. Accessor-backed result arrays, row fields and nested
manifest or QA evidence could therefore execute before queue, quota or cooldown
mutations.

Seven expected-red regressions covered executable account-lock rows, account
platform evidence, busy rows, daily count evidence, candidate manifest
evidence, KDP prior-submission evidence and KDP weekly-count evidence. Before
the repair, all five common publish-claim regressions failed with
`Missing expected rejection`; the two new KDP regressions failed the same way
while the four pre-existing weekly-submission cases passed. The repair uses
exact projections and inert bounded snapshots for every decision value,
validates account/platform identity and copied manifest/QA envelopes, preserves
the established package and QA semantic errors, and rejects executable query
evidence as `POD_QUERY_UNVERIFIED` without invoking its accessors or performing
mutations.

After the repair:

- focused publish-claim, KDP weekly, account-platform, mutation,
  storage-checkpoint and release-admission suites: 84 passed, zero failed;
- complete local `npm run test:pod`: 1,096 passed, nine environment-gated
  skips, zero failed, 1,105 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 988 used exact head
`075ffe029f2537e88871412b182f551d7b01709e`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `c8514ff2810e750f7c31fd23731fa1fa412e2658`;
- `tests/pod-account-platform-claim.test.mjs`:
  `98aa106fa30e0675818493148f41261846d3beab`;
- `tests/pod-kdp-weekly-submission.test.mjs`:
  `55ab9ed5c57bf6297712b91aee6900af0a9fb6e8`;
- `tests/pod-publish-claim-mutation.test.mjs`:
  `219269e47f1c52f202864205b94524275818d08c`;
- `tests/pod-publish-storage-checkpoints.test.mjs`:
  `b8f4f36c247694f5f963ade86a142e2c9471a3b4`;
- `tests/pod-release-admission.test.mjs`:
  `4b419fc81942295c76635b8c13862828aa45673b`;
- `tests/pod-publish-claim-query.test.mjs`:
  `cb86569de3e009c6ebeba49f3d93c11214ca0c66`.

Exact-head integration run `41649033560`, job `125961976705`, and container
run `41649033477`, job `125961977602`, both completed successfully. PR 988
merged as `36a18f38ab82d61faab672cd2f6ce281931a1128`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbkuk1u7bikc739fd6sg` for that exact functional merge. It started at
`2026-11-03T14:04:55.243989Z` and reached `live` at
`2026-11-03T14:06:07.210704Z`; the preceding deployment was deactivated. No
manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 381 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`36a18f38ab82d61faab672cd2f6ce281931a1128` and adding
`tests/pod-publish-claim-query.test.mjs` to the cross-repository gate.
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `false`.
Exact head `643e9361132a561ae522f3852f7e04ce3b531806` and workflow blob
`2271a4fa595a32f3f88e1080a248ad720da49680` passed cross-repository run
`41650450178`, job `125966863881`, including the final metadata/editorial QA,
Node POD integration suite and Python POD suite. PR 381 merged as
`2fefcdce4e7dac2d35909e599e4b511141568178`.

## Boundaries and unfinished work

- No marketplace adapter was contacted and no KDP, Redbubble, TeePublic,
  Zazzle, Spreadshirt or Etsy submission occurred.
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
