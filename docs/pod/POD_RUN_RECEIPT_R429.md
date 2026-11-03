# POD run receipt R429

Run completed at `2026-11-03T16:55:43Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R428 receipt merge
  `94fa4812c4a85426a9775f726311cacdefb73dcd`.
- Money Factory `main` began at
  `345d07c3a9589ab864b2474bc26f46ed4cf7e757`.
- Render deployment `dep-dbl04drbc2fs738et72g` was live on exact functional
  merge `3830618af6fc87f4eb4954dfd9b4fbe1cbba9128`.
- Neither repository had an open PR, so no concurrent job duplicated this
  repair.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

The migration and role-provisioning path directly consumed PostgreSQL result
arrays, rows and fields while deciding whether to create a role, accept runtime
privileges, trust the migration owner, revoke PUBLIC temporary-table access and
accept stored migration checksums. Accessor-backed or Proxy-backed results could
therefore execute while those security decisions were made.

An expected-red matrix reproduced acceptance of eight executable result shapes:
runtime-role result rows and row objects, the migration-owner field, inherited
role rows, the server-formatted TEMP revocation row, role-existence rows, the
server-formatted CREATE ROLE field and the stored-checksum row. All eight tests
failed before the repair because the migration completed instead of rejecting
the executable evidence.

The repair accepts only zero-or-one-row dense arrays and exact inert own data
fields, copies accepted fields into null-prototype snapshots and rejects Proxy,
accessor, sparse, oversized or shape-ambiguous evidence with the fixed
`POD_MIGRATION_QUERY_UNVERIFIED` error before invoking it. Runtime role flags and
inherited-elevation evidence must now be literal booleans, and the role
existence query has an explicit `present` projection. Rejected evidence rolls
back the transaction. The commit-time deployment-safety fixture was updated to
return the complete restricted-role row that production now requires.

After the repair:

- expected-red regression: eight failed before the repair for the intended
  missing rejection;
- focused migration/deployment/provisioning suites: 41 passed, four
  PostgreSQL-only skips, zero failed, 45 total;
- complete local `npm run test:pod`: 1,116 passed, nine environment-gated
  skips, zero failed, 1,125 total;
- `git diff --check` and `node --check scripts/pod_storage_init.mjs` passed.

## Hosted verification and merges

Content Control PR 994 used final exact head
`4458cfa64eae5aba71f40bac3cbdb676a4713307`. Remote blobs were:

- `scripts/pod_storage_init.mjs`:
  `09b81d6a94e9340f9cc61ec72d0b832597ff066a`;
- `tests/pod-deploy.test.mjs`:
  `8de104fa7f56d1c96df768b8732f743af3914c41`;
- `tests/pod-migration-query.test.mjs`:
  `8525c86919389224209700f07b515c55493f12f5`.

Exact-head integration run `41676838277`, job `126059633713`, and container
run `41676838284`, job `126059635395`, both completed successfully. The
integration job included the full Node POD suite, Python QA, production E2E,
workflow-control and free-review-guard checks. The container job included the
production image, non-root/dependency checks, Python QA/rendering,
Node/PostgreSQL tests, real print generation, durable review workflow and the
disabled hosted-app startup check. PR 994 merged as
`523daed598faf543efa57a95b3f448505feb6c03`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbl110c9v7es73d8ilog` for that exact functional merge. It started at
`2026-11-03T16:49:05.816596Z` and reached `live` at
`2026-11-03T16:50:24.711929Z`; the preceding deployment was deactivated. The
service remained unsuspended on the free plan with `main` auto-deploy, Docker
runtime and `/health` health check. No manual redeploy, cache clear, plan
change, purchase or secret access was used. This proves deployment liveness for
the repaired image, not canonical `/readyz`, accepted review evidence,
marketplace connectivity or end-to-end acceptance.

Money Factory PR 384 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`523daed598faf543efa57a95b3f448505feb6c03` and adding
`tests/pod-migration-query.test.mjs` to the pinned Node contract gate.
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `false`.
Exact head `7ff7b76341ee5f5378878b7553bc036ebed70c6f` and workflow blob
`9838d1a44edd8297362dded6e9b121d17014f639` passed cross-repository run
`41678159365`, job `126064285744`, including pinned Node contracts, strict
Python evidence, recovery, KDP metadata/editorial QA and both Money Factory POD
integration suites. PR 384 merged as
`0330697bd6ce6ce62818b93c29abcfb3934f3373`.

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
