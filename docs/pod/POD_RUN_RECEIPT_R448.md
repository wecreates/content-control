# POD run receipt R448

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `fa9ee28f9a41a732303e0af1f4817a0bda5ae105`.
- Content Control `main` was `a30967d070065b3f143260d2e4a4a16f27579c60`.
- No open POD pull request or duplicate R448 work existed in either repository.
  Unrelated draft work was preserved without modification; excluded Etsy work was
  not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require attributable live evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

Money Factory's non-strict authority snapshot copier deliberately retained inert
function-valued invalid fields so the established domain validators could reject
them with precise errors. A JavaScript callable is nevertheless an object for JSON
serialization: `JSON.stringify` resolves its own or inherited `toJSON` property
before it decides whether to omit the function. An ordinary non-Proxy function in
readiness evidence could therefore carry a callable or accessor-backed `toJSON`
hook that executed while the authority derived `readiness_sha256`. This was an
executable-evidence defect; it was not evidence of a live authority deployment,
grant, database, marketplace account or accepted product.

Three focused expected-red regressions extended the eleven passing authority-grant
evidence cases. Before the repair, 11 of 14 cases passed and the three new cases
failed because no rejection occurred; own callable, own accessor and inherited
callable serialization hooks were reached. The repaired copier walks the callable's
`toJSON` resolution path through data descriptors only, rejects Proxy prototypes,
accessors and callable values without reading or invoking them, and bounds prototype
inspection to the existing snapshot depth. Inert function values remain available
to the existing domain validators, preserving their established error contracts.

Money Factory PR 403 contained only:

- `integrations/pod/authority-evidence.mjs`: bounded, non-executable callable
  serialization inspection;
- `integrations/pod/authority-grant-evidence.test.mjs`: own data, own accessor and
  inherited callable `toJSON` regressions.

The exact PR head was `e37bc8499c0a7b4a4f46ed3c2843eef91f2e56b1`.
It was two commits ahead of the unchanged base, with 19 additions and 1 deletion
across those two files. PR 403 was squash-merged under the standing authorization as
`d9a9723ae2f4b467399cbfd0f0cbb29344b536b9`.

## Verification evidence

Local verification against Content Control
`a30967d070065b3f143260d2e4a4a16f27579c60`:

- repaired focused authority evidence suite: 14 passed, 0 failed;
- full Money Factory POD Node suite: 222 total, 221 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41817734147` (run number 405), job `126532698981`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 222 Money Factory Node/PostgreSQL tests passed with 0 failures and
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
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. R448 changes only Money Factory
authority code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level authority
evidence safety only. It does not create or validate the dedicated live database,
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
