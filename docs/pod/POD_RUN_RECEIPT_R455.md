# POD run receipt R455

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `8a8ee3aa7a92354196c6f6a5971d862a4011a245`.
- Content Control `main` was `9a18dac74b57339273200b5e9c733cd88bf9c84c`.
- No duplicate R455 work existed. Existing unrelated open pull requests and
  concurrent work were preserved without modification. Excluded Etsy work was
  not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` continue to require attributable live evidence and
  keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory's event inbox passed a synchronous database-pool result through
Promise resolution before verifying the returned client's `query` and `release`
capabilities. A client with an own executable `then` field was therefore treated
as a thenable. Promise assimilation read an accessor repeatedly, and a callable
`then` field could replace the returned client with a different verified client.
The replacement case committed the event before the repair. This was an
event-inbox authority-boundary security defect; it was not evidence of a live
authority deployment, database acceptance, marketplace account or accepted
product.

Two expected-red regressions covered an own synchronous-client `then` accessor and
an own callable `then` field. Before the repair, 13 of 15 focused cases passed:
the accessor was read three times, and the callable field substituted a verified
client so the event was committed instead of failing closed with
`EVENT_DATABASE_CAPABILITY_UNVERIFIED`.

The inbox now wraps a synchronous connection result as inert data without Promise
resolution. An ordinary native Promise pool remains supported through
`Promise.prototype.then.call`, without reading caller-owned `then` or `bind`
fields. The returned client is unwrapped only after the bounded acquisition settles
and is then subjected to the existing non-executable `query` and `release`
capability verification before any transaction begins.

Money Factory PR 410 contained only:

- `integrations/pod/event-inbox.mjs`: inert synchronous client wrapping and native
  Promise pool handling;
- `integrations/pod/event-capability-evidence.test.mjs`: accessor and callable
  synchronous-client `then` regressions.

The exact PR head was `0c5550ae62dd1d3df0029e8a1d24df83b9f25125`.
It was two commits ahead of the unchanged base, with 30 additions and 2 deletions
across those two files. PR 410 was squash-merged under the standing authorization
as `7bfd831e2edbb53d75a363edbb4c07f8c66cc12e`.

## Verification evidence

Local verification against Content Control's current POD contract:

- expected-red focused suite: 15 total, 13 passed and only the two new thenable
  regressions failed for the reasons above;
- repaired event capability, timeout, admission, transaction, handler and query
  evidence suites: 61 passed, 0 failed;
- full Money Factory POD Node suite: 240 total, 239 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41879373054` (run number 412), job `126747606388`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips, all pinned Python/KDP review stages
passed, all 240 Money Factory Node/PostgreSQL tests passed with no failures or
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
`60a85600f60646c7335d285c1abeabdf73d8f860`. R455 changes only Money Factory
event-inbox code and this allowlisted `[skip render]` receipt; it does not alter the
Render application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level event-inbox
capability protection only. It does not create or validate the dedicated live
database, prove durable storage and independent recovery, mount and authenticate
the live Money Factory authority, provide current grants/revocation or marketplace
account records, supply authorized intelligence and regional rights, establish
accepted generation, official templates, KDP editorial/preview evidence,
independent QA or verified remediation, demonstrate authorized submission and
readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual
economics or financial statements, demonstrate mobile operations and monitoring
in production, measure production capacity, complete an authorized end-to-end job,
or grant controlled launch approval. Publication remains held for explicit approval
after every acceptance requirement is satisfied. Etsy remains excluded.

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
