# POD run receipt R451

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `8f62f406389e6bd7b0fbdca915224e43dc69a5b8`.
- Content Control `main` was `2a3fd725c702a216901b2ba278ff31f628b6bb1e`.
- No open POD/KDP pull request or duplicate R451 work existed in either
  repository. Unrelated draft Content Control PR 378 and concurrent work were
  preserved without modification. Excluded Etsy work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` continue to require attributable live evidence and
  keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory's strict authority snapshot copier accepted every finite JavaScript
number. JavaScript preserves negative zero as a distinct value, but
`JSON.stringify` serializes both negative zero and zero as `0`. A server-loaded
readiness fact containing `-0` could therefore produce the same signed evidence
hash as a distinct fact containing canonical zero. Direct grant-envelope signing
had the same normalization boundary. This was an evidence-identity defect; it was
not evidence of a live authority deployment, grant, database, marketplace account
or accepted product.

Two expected-red regressions extended 26 passing authority evidence cases. Before
the repair, 26 of 28 cases passed and both new cases failed because readiness and
grant-envelope evidence containing negative zero were signed instead of rejected.
The strict copier now rejects negative zero with
`AUTHORITY_SNAPSHOT_UNVERIFIED` before serialization or signing. The permissive
copy used for precise domain validation remains unchanged, and a positive
regression proves canonical zero remains accepted and retained.

Money Factory PR 406 contained only:

- `integrations/pod/authority-evidence.mjs`: strict negative-zero rejection;
- `integrations/pod/authority-grant-evidence.test.mjs`: readiness-hash
  normalization regression;
- `integrations/pod/sign-grant-evidence.test.mjs`: direct signer rejection and
  canonical-zero retention.

The exact PR head was `a8b14dd30fe417eff0d02655983209e339e69343`.
It was three commits ahead of the unchanged base, with 20 additions and 1 deletion
across those three files. PR 406 was squash-merged under the standing authorization
as `9e91db96a4e0fdc75697e209b238ce902e17e96d`.

## Verification evidence

Local verification against Content Control
`2a3fd725c702a216901b2ba278ff31f628b6bb1e`:

- expected-red authority evidence suites: 28 total, 26 passed and both new
  regressions failed because the prior implementation signed negative zero;
- repaired focused authority suites: 36 passed, 0 failed;
- full Money Factory POD Node suite: 231 total, 230 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41839563658` (run number 408), job `126607218916`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 231 Money Factory Node/PostgreSQL tests passed with 0 failures and
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
`60a85600f60646c7335d285c1abeabdf73d8f860`. R451 changes only Money Factory
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
