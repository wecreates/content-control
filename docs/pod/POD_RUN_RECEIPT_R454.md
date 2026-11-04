# POD run receipt R454

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `41751c7a661d2f65067145ff3518323ae4973e3a`.
- Content Control `main` was `398d0f95a3978c35d9a49e941112e39fe5f03cad`.
- No duplicate R454 work existed. Existing unrelated open pull requests and
  concurrent work were preserved without modification. Excluded Etsy work was
  not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` continue to require attributable live evidence and
  keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory's bounded authority snapshot loader passed a synchronous,
server-owned snapshot through Promise resolution before the snapshot was copied
and validated. A snapshot with an own executable `then` field was therefore
treated as a thenable. Promise assimilation read an accessor repeatedly, and a
callable `then` field could replace the returned snapshot with different valid
authority data. The replacement case incorrectly produced HTTP 200 before the
repair. This was an authority-boundary security defect; it was not evidence of a
live authority deployment, grant, database, marketplace account or accepted
product.

Two expected-red regressions covered an own top-level `then` accessor and an own
top-level callable `then` field. Before the repair, 8 of 10 focused cases passed:
the accessor was read five times, and the callable field substituted a valid
snapshot and returned HTTP 200 instead of fail-closed HTTP 409.

`loadBoundedSnapshot` now wraps a synchronous loader result without Promise
resolution. A genuine native Promise remains supported through
`Promise.prototype.then.call`, without reading caller-owned `then` or `bind`
fields. The handler unwraps the inert result holder only after the bounded race,
then applies the existing executable-evidence rejection before signing.

Money Factory PR 409 contained only:

- `integrations/pod/authority-handler.mjs`: inert synchronous result wrapping
  and native Promise handling;
- `integrations/pod/authority-snapshot-evidence.test.mjs`: accessor and callable
  `then` regressions.

The exact PR head was `a1231d529958828a334b86fd36d8deb3f8f72515`.
It was two commits ahead of the unchanged base, with 13 additions and 2 deletions
across those two files. PR 409 was squash-merged under the standing authorization
as `8a8ee3aa7a92354196c6f6a5971d862a4011a245`.

## Verification evidence

Local verification against Content Control's current POD contract:

- expected-red focused suite: 10 total, 8 passed and only the two new thenable
  regressions failed for the reasons above;
- repaired focused authority suites: 32 passed, 0 failed;
- full Money Factory POD Node suite: 238 total, 237 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41869088567` (run number 411), job `126710912576`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips, all pinned Python/KDP review stages
passed, all 238 Money Factory Node/PostgreSQL tests passed with no failures or
skips, including the disposable PostgreSQL bridge and the two new regressions,
and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

Before the receipt merge, the authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg` remained an unsuspended, one-instance, free-plan Docker
web service with auto-deploy enabled. Deploy `dep-dblhj6tq3nlc73dvs4b0` remained
`live` on Content Control runtime revision
`60a85600f60646c7335d285c1abeabdf73d8f860`. R454 changes only Money Factory
authority code and this allowlisted `[skip render]` receipt; it does not alter the
Render application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level authority
input protection only. It does not create or validate the dedicated live database,
prove durable storage and independent recovery, mount and authenticate the live
Money Factory authority, provide current grants/revocation or marketplace account
records, supply authorized intelligence and regional rights, establish accepted
generation, official templates, KDP editorial/preview evidence, independent QA or
verified remediation, demonstrate authorized submission and readback on KDP,
Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual economics or
financial statements, demonstrate mobile operations and monitoring in production,
measure production capacity, complete an authorized end-to-end job, or grant
controlled launch approval. Publication remains held for explicit approval after
every acceptance requirement is satisfied. Etsy remains excluded.

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
