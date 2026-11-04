# POD run receipt R447

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `41f24f6e0bd7d5a6bc7972ff91f29687a4212818`.
- Content Control `main` was `64663011e975ca711b74379c130a6bad6c409377`.
- No open POD pull request or duplicate R447 work existed in either repository.
  Unrelated draft PR 378 in Content Control was preserved without modification;
  excluded Etsy work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require attributable live evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

Money Factory's POD event inbox verified that pool and client database methods
were non-Proxy ordinary functions before binding them to their receivers. The
verified method was then bound with `descriptor.value.bind(target)`. That property
lookup could execute an own caller-controlled `bind` accessor on an otherwise
ordinary supplied function. The capability-verification boundary could therefore
run caller code while acquiring pool `connect`, client `query`, or client `release`
capabilities. This was a code-level capability-safety defect; it was not evidence
of a live database, marketplace connection, grant, or accepted product.

Three focused expected-red regressions extended the ten passing event-capability
cases. Before the repair, 10 of 13 cases passed and all three new cases failed;
each injected own `bind` accessor was invoked once. The repaired binder calls the
built-in binder intrinsically with `Function.prototype.bind.call`, so it never
reads a caller-owned `bind` property from the verified function.

Money Factory PR 402 contained only:

- `integrations/pod/event-inbox.mjs`: intrinsic binding for verified database
  capabilities;
- `integrations/pod/event-capability-evidence.test.mjs`: pool connect, client query
  and client release own-bind-accessor regressions.

The exact PR head was `f0f24a6726d890079cb84a39b3d3cce796175788`.
It was two commits ahead of the unchanged base, with 19 additions and 1 deletion
across those two files. PR 402 was squash-merged under the standing authorization as
`fa9ee28f9a41a732303e0af1f4817a0bda5ae105`.

## Verification evidence

Local verification against Content Control
`64663011e975ca711b74379c130a6bad6c409377`:

- repaired focused and adjacent event suites: 38 passed, 0 failed;
- full Money Factory POD Node suite: 219 total, 218 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41815048066` (run number 404), job `126523558679`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 219 Money Factory Node/PostgreSQL tests passed with 0 failures and
0 skips, including the disposable PostgreSQL bridge and all three new regressions,
and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblaboepbehc73ctnjm0` remained `live` on runtime-bearing Content Control
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. R447 changes only Money Factory
capability code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level database
capability safety evidence only. It does not create or validate the dedicated live
database, prove durable storage and recovery, mount the live Money Factory authority,
provide current grants or revocation and marketplace account records, provide
regional rights or official-template evidence, establish independently accepted
generation/editorial/QA/remediation, demonstrate authorized submission and readback
on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual economics or
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
