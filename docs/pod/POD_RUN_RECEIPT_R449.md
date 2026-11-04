# POD run receipt R449

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `d9a9723ae2f4b467399cbfd0f0cbb29344b536b9`.
- Content Control `main` was `60a85600f60646c7335d285c1abeabdf73d8f860`.
- The Content Control base includes the concurrent zero-credit QA proof and
  accepted-candidate rollback-ledger updates. They were preserved without
  modification. Unrelated draft PR 378 was also preserved.
- No open POD pull request or duplicate R449 work existed in either repository.
  Excluded Etsy work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require attributable live evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

Money Factory used a deliberately permissive copy of the authority snapshot while
validating required readiness, approval, mode and economics fields. It then derived
`readiness_sha256` directly from that same non-strict readiness copy. JSON omits
object properties whose values are `undefined`, functions or symbols and normalizes
non-finite numbers to `null`. Distinct authority snapshots containing such otherwise
unvalidated extra readiness evidence could therefore produce the same hash. This was
an evidence-identity defect; it was not evidence of a live authority deployment,
grant, database, marketplace account or accepted product.

Four focused expected-red regressions extended the fourteen passing authority-grant
evidence cases. Before the repair, 14 of 18 cases passed and all four new cases
failed because readiness extras containing `undefined`, an inert function, a symbol
or `NaN` still produced grants. The repair retains the permissive copy through all
existing domain checks so their precise errors and precedence remain unchanged,
then creates a strict JSON-representable readiness copy solely for final hashing.
Lossy extras now fail with `AUTHORITY_SNAPSHOT_UNVERIFIED`; the exact valid readiness
hash remains unchanged.

Money Factory PR 404 contained only:

- `integrations/pod/readiness-grant.mjs`: strict final readiness hash evidence;
- `integrations/pod/authority-grant-evidence.test.mjs`: four JSON-lossiness
  regressions.

The exact PR head was `8e60cb3ca019e38cc1fc6fa86c8751404de57ffe`.
It was two commits ahead of the unchanged base, with 15 additions and 1 deletion
across those two files. PR 404 was squash-merged under the standing authorization as
`ad116ec3a39b3d43a3b7bb09b897a83c7e8066f8`.

## Verification evidence

Local verification against Content Control
`60a85600f60646c7335d285c1abeabdf73d8f860`:

- repaired focused authority, mode and economics suites: 55 passed, 0 failed;
- full Money Factory POD Node suite: 226 total, 225 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41826795523` (run number 406), job `126563471360`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 226 Money Factory Node/PostgreSQL tests passed with 0 failures and
0 skips, including the disposable PostgreSQL bridge and all four new regressions,
and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Concurrent Content Control monitoring state had advanced the live service before
this repair: deploy `dep-dblhj6tq3nlc73dvs4b0` was `live` on revision
`60a85600f60646c7335d285c1abeabdf73d8f860`. The preceding QA-proof deploy was
deactivated normally. R449 changes only Money Factory authority code and this
allowlisted receipt; it does not alter the Render application's runtime bytes or
constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level authority
evidence integrity only. It does not create or validate the dedicated live database,
prove durable storage and independent recovery, mount and authenticate the live
Money Factory authority, provide current grants/revocation or marketplace account
records, supply authorized intelligence and regional rights, establish accepted
generation, official templates, KDP editorial/preview evidence, independent QA or
verified remediation, demonstrate authorized submission and readback on KDP,
Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual economics or financial
statements, demonstrate mobile operations and monitoring in production, measure
production capacity, complete an authorized end-to-end job, or grant controlled
launch approval. Publication remains held for explicit approval after every
acceptance requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this scheduled run had no credible
changed access path after the previously recorded connector and browser failures.
The run used only its actually available repository, hosted workflow and authorized
Render inspection capabilities; it did not have a continuously running self-hosted
worker, database shell, marketplace session, or authority to widen network access.
It did not use or disclose credentials, contact anyone, purchase resources, access
the social vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
