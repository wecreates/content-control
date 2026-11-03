# POD run receipt R427

Run completed at `2026-11-03T14:47:58Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R426 receipt merge
  `a02736b68d6bbe5b136092f4c082afa4c6266b42`.
- Money Factory `main` began at
  `2fefcdce4e7dac2d35909e599e4b511141568178`.
- Render deployment `dep-dbkuk1u7bikc739fd6sg` was live on exact functional
  merge `36a18f38ab82d61faab672cd2f6ce281931a1128`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Money Factory PRs 80 and 81 are Etsy work and remain
  excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

The concept-admission path read the database UTC budget day through direct
`result.rows[0].budget_day` access after taking the business advisory lock.
Accessor-backed or Proxy-backed result arrays and rows could therefore execute
database-owned evidence and let admission continue into daily-budget and concept
mutations.

Four expected-red regressions covered an accessor-backed result, a rows Proxy,
an accessor-backed row field and a row Proxy. Before the repair, all four failed
with `Missing expected rejection`. The repair routes the clock result through the
existing exact inert single-row query snapshot, preserving the established
missing/invalid-clock error while rejecting executable evidence as
`POD_QUERY_UNVERIFIED` without invoking its accessors or issuing any budget or
concept write.

After the repair:

- focused concept-budget and authority-expiry suites: 24 passed, zero failed;
- complete local `npm run test:pod`: 1,100 passed, nine environment-gated
  skips, zero failed, 1,109 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 990 used exact head
`95a5bb5ba7cbcafbdb98d72ca3453df42bd25c18`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `181d499db0cbaec08ef8a7a2a1d37fdaf97a8592`;
- `tests/pod-concept-budget.test.mjs`:
  `7f3d22765bf40ef8b45f6989f1e79e8335d9ddca`.

Exact-head integration run `41655239769`, job `125983664598`, and container
run `41655239849`, job `125983665638`, both completed successfully. PR 990
merged as `8ee268fe0c1f3d51da69223d6e70856174524b48`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbkv60nlk1mc73eci2gg` for that exact functional merge. It started at
`2026-11-03T14:43:14.911507Z` and reached `live` at
`2026-11-03T14:44:17.953154Z`; the preceding deployment was deactivated. No
manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 382 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`8ee268fe0c1f3d51da69223d6e70856174524b48`. The existing
`tests/pod-concept-budget.test.mjs` cross-repository gate includes the new
regressions. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal
`false`. Exact head `8e96225ee8f160e713b01801f90231bcc8d9f859` and workflow
blob `4ca3a3b35ad2e628ce36591ad9e6d020fff46ba7` passed cross-repository run
`41656542673`, job `125988258525`, including final metadata/editorial QA, the
Node POD integration suite and the Python POD suite. PR 382 merged as
`5c95f4fe2fe219f3cd0bd06b7a8369d8da522dd6`.

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
