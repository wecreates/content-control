# POD run receipt R446

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `a76098a2c9083eb2715e004d3a19ece0fb2ed4df`.
- Content Control `main` was `2a73c8ca0f6afb4fabac2e98cd4685a68a825c2a`.
- No open POD pull request or duplicate R446 work existed in either repository.
  Unrelated draft work was preserved without modification; excluded Etsy drafts were
  not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require attributable live evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

The non-strict Money Factory authority snapshot copier returned boxed primitive
objects unchanged so established field validators could reject boxed invalid values
with their precise domain errors. A caller-owned wrapper could therefore retain an
own callable `toJSON` property, which `JSON.stringify` invoked while deriving the
readiness hash. A boxed string also bypassed the aggregate snapshot text budget and
could force unbounded wrapper-property reflection before hashing. This was an
executable-evidence and authority-availability defect; it was not evidence of a
forged grant or a live authority deployment.

Three focused expected-red regressions extended the eleven-case authority evidence
suite. Before the repair, eight cases passed and the three new cases failed. Exact
base-head reproduction recorded one invocation each for readiness-level and
business-row boxed `toJSON` hooks, and confirmed that a 262,145-byte boxed string
was signed despite the 256 KiB snapshot budget.

The repaired copier extracts a boxed primitive through the matching built-in
intrinsic, accounts for boxed string text, bounds its descriptor fanout before
enumeration, verifies that the source wrapper has exactly the canonical inert own
descriptors, and returns a clean reconstructed wrapper. Noncanonical properties,
including callable `toJSON`, are rejected with
`AUTHORITY_SNAPSHOT_UNVERIFIED` without invocation. Existing boxed invalid mode
values still reach the established field validators and retain their domain errors.

Money Factory PR 401 contained only:

- `integrations/pod/authority-evidence.mjs`: canonical, bounded boxed evidence copy;
- `integrations/pod/authority-grant-evidence.test.mjs`: two boxed execution
  regressions and one boxed text-budget regression.

The exact PR head was `2a04b946cba9d318f4738d47f7b38a2d10181823`.
It was two commits ahead of the unchanged base, with 31 additions and 5 deletions
across those two files. PR 401 was squash-merged under the standing authorization as
`41f24f6e0bd7d5a6bc7972ff91f29687a4212818`.

## Verification evidence

Local verification against Content Control
`2a73c8ca0f6afb4fabac2e98cd4685a68a825c2a`:

- repaired focused authority evidence suite: 11 passed, 0 failed;
- full Money Factory POD Node suite: 216 total, 215 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41813960258` (run number 403), job `126519887068`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 216 Money Factory Node/PostgreSQL tests passed, including the disposable
PostgreSQL bridge and the three new regressions, and all 81 Money Factory bridge
Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblaboepbehc73ctnjm0` remained `live` on runtime-bearing Content Control
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. R446 changes only Money Factory
authority code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level authority
safety evidence only. It does not mount the live Money Factory authority, provide
current marketplace accounts or regional rights, import and print-verify official
templates, establish independent product acceptance, reconcile actual economics or
statements, demonstrate authorized submission/readback on all five marketplaces,
measure production capacity, complete an authorized end-to-end job, or grant launch
approval. Publication remains held for explicit approval after every acceptance
requirement is satisfied. Etsy remains excluded.

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
