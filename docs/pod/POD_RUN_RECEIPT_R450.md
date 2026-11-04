# POD run receipt R450

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `ad116ec3a39b3d43a3b7bb09b897a83c7e8066f8`.
- Content Control `main` was `2186d5e1bae35f165a0f633d52bc842505c83d37`.
- No open POD/KDP pull request or duplicate R450 work existed in either
  repository. Unrelated draft Content Control PR 378 and concurrent work were
  preserved without modification. Excluded Etsy work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` continue to require attributable live evidence and
  keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory's authority snapshot copier memoized shared object references in a
`WeakMap`. Its safety budgets therefore counted only the unique object graph even
though `JSON.stringify` expands each alias occurrence before the readiness evidence
is hashed. A depth-14 binary alias graph containing only 15 unique objects could
expand past the 8,192-value bound during serialization while being accepted by the
pre-serialization copy. This was a bounded-evidence integrity defect; it was not
evidence of a live authority deployment, grant, database, marketplace account or
accepted product.

The expected-red regression extended 18 passing authority-grant evidence cases.
Before the repair, 18 of 19 cases passed and the new case failed because the signer
accepted the expanding alias graph instead of throwing
`AUTHORITY_SNAPSHOT_UNVERIFIED`. The repair no longer reuses copied aliases. It
re-copies each occurrence so object, value and text budgets measure the same
expanded evidence tree that JSON will serialize. The active recursion set remains,
so cycles are still rejected. A positive regression also proves that bounded shared
aliases remain accepted and produce the exact expanded JSON hash.

Money Factory PR 405 contained only:

- `integrations/pod/authority-evidence.mjs`: expanded-tree budget accounting;
- `integrations/pod/authority-grant-evidence.test.mjs`: the bounded-expansion
  expected-red regression;
- `integrations/pod/authority-snapshot.test.mjs`: bounded-alias exact-hash proof.

The exact PR head was `cc2495aaf1917daf6dbb67bfb248d4fcc78a0da1`.
It was three commits ahead of the unchanged base, with 18 additions and 5 deletions
across those three files. PR 405 was squash-merged under the standing authorization
as `8f62f406389e6bd7b0fbdca915224e43dc69a5b8`.

## Verification evidence

Local verification against Content Control
`2186d5e1bae35f165a0f633d52bc842505c83d37`:

- expected-red authority evidence suite: 19 total, 18 passed and the new regression
  failed because the prior implementation accepted the expanding alias graph;
- repaired focused authority suites: 33 passed, 0 failed;
- full Money Factory POD Node suite: 228 total, 227 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41836084683` (run number 407), job `126595230041`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 228 Money Factory Node/PostgreSQL tests passed with 0 failures and
0 skips, including the disposable PostgreSQL bridge and the new regressions, and
all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblhj6tq3nlc73dvs4b0` remained `live` on Content Control revision
`60a85600f60646c7335d285c1abeabdf73d8f860`. R450 changes only Money Factory
authority code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

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
