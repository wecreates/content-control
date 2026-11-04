# POD run receipt R445

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `52f2b4d974d226659f9489f251aec7f2b4a24ba2`.
- Content Control `main` was `c25613c5e925d8bb078f9f0555743b5681856a2a`.
- No open POD pull request or duplicate R445 work existed in either repository.
  Unrelated draft Content Control pull requests were preserved without modification.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require attributable live evidence and keep all
  24 acceptance areas open.

## Confirmed defect and repair

The non-strict Money Factory authority snapshot copier preserved ordinary function
values so established field validators could reject coercible invalid evidence with
their precise domain errors. That preservation also copied an own callable `toJSON`
property. `issuePodGrant` subsequently used `JSON.stringify` to derive the readiness
hash, which invoked a caller-owned `toJSON` hook before the grant was signed. This
was an executable-evidence and authority-integrity defect; it was not evidence of a
forged grant or a live authority deployment.

Two focused expected-red regressions supplied a callable `toJSON` on the readiness
object and on its business row. Before the repair, the eight-case focused suite had
six passes and two failures because both hooks were invoked once and no rejection
occurred.

The repaired copier rejects an own callable `toJSON` data property with
`AUTHORITY_SNAPSHOT_UNVERIFIED` before copying, serialization, hashing or signing.
Accessors, Proxies and other executable evidence remain rejected without invocation.
Other inert invalid function values still reach the existing field validators, so
validation precedence and domain errors are preserved.

Money Factory PR 400 contained only:

- `integrations/pod/authority-evidence.mjs`: reject callable own `toJSON` evidence;
- `integrations/pod/authority-grant-evidence.test.mjs`: cover readiness and business
  serialization hooks.

The exact PR head was `b04fe3a32da98cc749c671ca2106986b27b01e74`.
It was two commits ahead of the unchanged base, with six additions and no deletions
across those two files. PR 400 was squash-merged under the standing authorization as
`a76098a2c9083eb2715e004d3a19ece0fb2ed4df`.

## Verification evidence

Local verification against Content Control
`c25613c5e925d8bb078f9f0555743b5681856a2a`:

- repaired adjacent authority suites: 32 passed, 0 failed;
- full Money Factory POD Node suite: 213 total, 212 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41801889496` (run number 402), job `126479405823`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 213 Money Factory Node/PostgreSQL tests passed, including the disposable
PostgreSQL bridge and the two new regressions, and all 81 Money Factory bridge Python
tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblaboepbehc73ctnjm0` remained `live` on runtime-bearing Content Control
revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`. R445 changes only Money Factory
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
