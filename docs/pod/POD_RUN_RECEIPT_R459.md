# POD run receipt R459

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `fa4b4d21fa932d922e2c4120be6ebce5af044744`,
  the verified R458 shared-key resource-bound repair.
- Content Control `main` was `886ce90d28391723bd44a77f71d9b1e9aaef84d2`.
  The post-R458 zero-credit QA proof and accepted-candidate rollback-ledger commits
  were preserved in that exact base without modification.
- No open POD/KDP pull request or duplicate R459 job existed. Existing unrelated
  pull requests and concurrent work were preserved. Excluded Etsy work was not
  touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. They continue to require attributable live
  evidence and keep all 24 acceptance areas open.

## Confirmed defect and repair

The centralized Money Factory POD shared-key contract bounded encoded key length,
but still admitted NUL and lone UTF-16 surrogate code units. NUL cannot traverse
HTTP header authentication unchanged. Node replaces lone surrogates while encoding
UTF-8, so distinct JavaScript strings could collapse to the same HMAC bytes. This
was a protocol-identity and publishing-safeguard defect; it was not evidence of a
live authority deployment, database acceptance, marketplace account or accepted
product.

The expected-red suite ran 12 focused tests on the prior implementation. Six
existing cases passed and all six new boundary regressions failed: the shared
validator, grant signer, event-handler constructor, both authority-key constructor
paths and direct inbox authentication admitted the non-portable text. The inbox
reached signature verification instead of rejecting the key contract first.

Money Factory now requires shared-key text to contain no NUL and to round-trip
through UTF-8 exactly before the existing 32-to-4,096 encoded-byte bound is applied.
Valid supplementary-plane Unicode remains accepted. The centralized validator is
still used before HTTP authentication, Buffer comparison, HMAC work, authority and
event-handler construction, and direct inbox authentication.

Money Factory PR 414 contained only:

- `integrations/pod/key-contract.mjs`: exact portable UTF-8 key identity; and
- `integrations/pod/key-bounds.test.mjs`: entry-point regressions for NUL, lone
  high and lone low surrogates plus a valid supplementary-plane boundary case.

The two remote blob SHAs exactly matched the locally tested commit. The exact PR
head was `26e09e2763a6797c63d35e29b34d50c98f0faff1`, based on the exact R458
Money Factory main. PR 414 was squash-merged under the standing authorization as
`38a6f24e59b06e6644683d76e407671db94d712b`.

## Verification evidence

Local verification against the current compatible Content Control contract:

- expected-red key-identity suite: 12 total, 6 passed and all six new boundary
  regressions failed for the reasons above;
- repaired focused authority, event, signing and key-contract suites: 49 passed,
  0 failed;
- full Money Factory POD Node suite: 256 total, 255 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed; and
- modified-module syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41917922303` (run number 416), job `126882425047`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips; the eight pinned Python/KDP evidence
groups and 23 editorial-bound KDP tests passed; all 256 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and new key-identity regressions; and all 81 Money Factory bridge
Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblpira5s2ss73a5s3f0` was `live` on Content Control revision
`886ce90d28391723bd44a77f71d9b1e9aaef84d2`. That confirms rollout liveness for
those Content Control bytes only. It does not deploy the separate Money Factory
key-identity repair or constitute POD readiness, database, end-to-end or publication
acceptance. This allowlisted R459 receipt uses `[skip render]` and must not trigger
another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level shared-key
identity protection only. It does not create or validate the dedicated live
database, prove durable storage and independent recovery, mount and authenticate
the live Money Factory authority, provide current grants/revocation or marketplace
account records, supply authorized intelligence and regional rights, establish
accepted generation, official templates, KDP editorial/preview evidence,
independent QA or verified remediation, demonstrate authorized submission and
readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual
economics or financial statements, demonstrate mobile operations and monitoring in
production, measure production capacity, complete an authorized end-to-end job, or
grant controlled launch approval. Publication remains held for explicit approval
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
