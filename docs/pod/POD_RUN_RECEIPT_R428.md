# POD run receipt R428

Run completed at `2026-11-03T15:53:36Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R427 receipt merge
  `16b6d05aa8146893a2fb51ddfecc4bcd13cc7fb1`.
- Money Factory `main` began at
  `5c95f4fe2fe219f3cd0bd06b7a8369d8da522dd6`.
- Render deployment `dep-dbkv60nlk1mc73eci2gg` was live on exact functional
  merge `8ee268fe0c1f3d51da69223d6e70856174524b48`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Money Factory PRs 80 and 81 are Etsy work and remain
  excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

The deployment preflight directly consumed PostgreSQL result arrays and rows
for the runtime search path, role restrictions, TLS state, table grants,
social-vault isolation and migration checksums. Accessor-backed or Proxy-backed
results could therefore execute while the preflight was deciding whether to
report `CONFIGURATION_VERIFIED`.

Expected-red work reproduced `CONFIGURATION_VERIFIED` for seven correctly
matched executable result/row variants and also found a table-query fixture
matcher that did not match the production SQL. The matcher was corrected before
the final regression matrix was accepted. The resulting eight-case matrix
covers a result accessor, a field accessor, nested and top-level array Proxies,
row Proxies and an accessor-backed vault field.

The repair accepts only bounded dense arrays and exact inert own data fields,
snapshots accepted values, and converts all executable, sparse, oversized or
shape-ambiguous query evidence into a fail-closed `DATABASE_READABLE` result
without invoking accessors. Hosted PostgreSQL then exposed a portability defect:
`current_schemas(false)` has type `name[]`, which the configured driver did not
decode as an array. The read-only query now explicitly casts that value to
`text[]`; strict array validation remains intact. CI failure reports now include
the bounded preflight report so another driver-shape regression is diagnosable
without exposing connection details.

After the repair:

- focused preflight suite: 44 passed, zero failed;
- complete local `npm run test:pod`: 1,108 passed, nine environment-gated
  skips, zero failed, 1,117 total;
- `git diff --check` and `node --check scripts/pod_preflight.mjs` passed.

## Hosted verification and merges

Content Control PR 992 used final exact head
`e68768bbea046141cf3ad8f4b9a4e9cd475ef682`. Remote blobs were:

- `scripts/pod_preflight.mjs`:
  `3cd03a22d968df9331a8ffb1144983eb5088622f`;
- `tests/pod-preflight.test.mjs`:
  `9cbc4955d58dd99a0044803a9afd317947449b0e`;
- `tests/pod-postgres.test.mjs`:
  `1c8c47ec8ded2cd9fee0412627a3508005697e1c`;
- `tests/pod-role-privileges-postgres.test.mjs`:
  `12a5c28ea046c4fb2cd93b1e863bd030d22f7dfb`.

Initial exact-head integration run `41665439845` and diagnostic run
`41665920624` failed in the PostgreSQL-backed phase and were not merged. Their
failure evidence identified the `name[]` driver-shape issue above. After the
`text[]` normalization, exact-head integration run `41666202029`, job
`126022076420`, and container run `41666202066`, job `126022827557`, both
completed successfully. The integration job included PostgreSQL, Python,
production E2E, workflow-control and free-review-guard checks. The container job
included the production image, non-root/dependency checks, Python QA/rendering,
Node/PostgreSQL tests, real print generation, durable review workflow and the
disabled hosted-app startup check. PR 992 merged as
`3830618af6fc87f4eb4954dfd9b4fbe1cbba9128`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbl04drbc2fs738et72g` for that exact functional merge. It started at
`2026-11-03T15:48:07.33014Z` and reached `live` at
`2026-11-03T15:49:11.801837Z`; the preceding deployment was deactivated. No
manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 383 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`3830618af6fc87f4eb4954dfd9b4fbe1cbba9128`. `PUBLICATION_ENABLED` and
`POD_PUBLICATION_ENABLED` remain literal `false`. Exact head
`db8dabc5fa0eab36c2d0d05d1289f598e6a3fa63` and workflow blob
`38359b2d889793fc4f6596a471de44425c84b675` passed cross-repository run
`41667715541`, job `126027422601`, including the pinned Node preflight suite,
strict Python evidence, KDP metadata/editorial QA and both Money Factory POD
integration suites. PR 383 merged as
`345d07c3a9589ab864b2474bc26f46ed4cf7e757`.

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
