# POD run receipt R425

Run completed at `2026-11-03T12:58:41Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R424 receipt merge
  `501a40e6dfdae1daa1679319446b56b565f26f32`.
- Money Factory `main` began at
  `f7f43f69c2200865dd9cacc715eb30176533547f`.
- Render deployment `dep-dbksnbss728c73933f5g` was live on exact functional
  merge `8fdf8a39d1901432a87e8435ae67734e716dc7f7`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Money Factory PRs 80 and 81 are Etsy work and remain
  excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

The remaining release-ready and owner-operations list methods returned or
mapped `result.rows` directly. Accessor-backed result arrays, row fields and
nested manifest evidence could therefore execute during an authenticated read,
and returned release-ready rows were still caller-owned database objects rather
than bounded snapshots.

Four expected-red regressions covered executable release-ready `rows`, a
release-ready row field, operations `rows` and operations manifest evidence.
Before the repair, all four failed with `Missing expected rejection`. The
repair requires dense bounded result arrays, exact projected inert rows, valid
route/state/type evidence, copied timestamps and JSON manifests, and a fresh
storage-lifetime check after validation. Executable evidence is rejected as
`POD_QUERY_UNVERIFIED` without invoking its accessors. Existing rights-bound
listing, preview eligibility, reason redaction and result limits remain intact.

After the repair:

- focused list, operations, release-freshness and read-expiry suites: 96 passed,
  zero failed;
- complete local `npm run test:pod`: 1,089 passed, nine environment-gated
  skips, zero failed, 1,098 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 986 used exact head
`b467160bec1b28447bdd6dd924ccfa87c3bb22ce`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `f7075eead2c73c91ec7a8d57e5a3de7ad8387550`;
- `tests/pod-list-query-evidence.test.mjs`:
  `df231ee6333a5d80d531eef4daab72dd67102367`;
- `tests/pod-release-freshness.test.mjs`:
  `b705886022d950664331bf1bdb3c08495114570b`.

Exact-head integration run `41638603605`, job `125926027404`, and container
run `41638603591`, job `125926027211`, both completed successfully. PR 986
merged as `6fc91d3ed5ba916e15ab14eaa7f1ff62ae20c81a`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbktibe7bikc739dj6kg` for that exact functional merge. It started at
`2026-11-03T12:53:01.863391Z` and reached `live` at
`2026-11-03T12:54:01.307591Z`; the preceding deployment was deactivated. No
manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 380 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`6fc91d3ed5ba916e15ab14eaa7f1ff62ae20c81a` and adding
`tests/pod-list-query-evidence.test.mjs` to the cross-repository gate.
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `false`.
Exact head `4fd646f14f4d90d1c320047922bf2cacdd2aa632` passed cross-repository
run `41639578936`, job `125929367895`, including the final metadata/editorial
QA, Node POD integration suite and Python POD suite. PR 380 merged as
`b37f95d27dc26b3f05ead5e201ce0835d7fc0297`.

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
