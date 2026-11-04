# POD run receipt R458

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `9c95c7d86241367bddaa25bbe4d233e46775a89c`,
  the verified R457 receiver failure-classification repair.
- Content Control `main` was `948ab3466a3e37dd7c3a8790f108af095cf5798e`,
  including the concurrent watchdog, zero-credit QA and rollback-ledger work
  preserved by the R457 receipt.
- No duplicate R458 branch or pull request existed. Existing unrelated open pull
  requests and concurrent work were preserved without modification. Excluded Etsy
  work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. They continue to require attributable live
  evidence and keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory's POD authority, event receiver, direct inbox and grant-signing paths
required at least 32 encoded key bytes but imposed no project-owned upper bound.
Oversized configured shared secrets could therefore reach HTTP authentication,
Buffer allocation and HMAC processing. This was a bounded-resource security and
publishing-safeguard defect; it was not evidence of a live authority deployment,
database acceptance, marketplace account or accepted product.

Five expected-red regressions covered grant signing, event-handler construction,
both authority keys and direct event-inbox authentication with a 4,097-byte key.
All five failed before the repair: each construction or signing path accepted the
oversized key, and the direct inbox proceeded to signature verification instead of
rejecting the key contract first.

Money Factory now has one shared-key contract requiring a primitive string encoded
to between 32 and 4,096 bytes inclusive before any Buffer or crypto operation. The
same validator is used by grant signing, authority construction, event-handler
construction and direct inbox authentication. A separate regression confirms that
the 4,096-byte boundary remains valid and that the upper bound counts encoded bytes,
not JavaScript code units.

Money Factory PR 413 contained only:

- `integrations/pod/key-contract.mjs`: the shared encoded-byte contract;
- `integrations/pod/key-bounds.test.mjs`: five entry-point regressions plus the
  inclusive and multibyte boundary checks;
- `integrations/pod/authority-handler.mjs`, `event-handler.mjs`,
  `event-inbox.mjs` and `sign-grant.mjs`: adoption of the shared contract.

The exact PR head was `8fcef62258bf986a564fce314f03f473a258fb00`.
It was six contents-API commits ahead of the exact R457 base, with 51 additions and
4 deletions across the six intended files. PR 413 was squash-merged under the
standing authorization as `fa4b4d21fa932d922e2c4120be6ebce5af044744`.

## Verification evidence

Local verification against the current compatible Content Control contract:

- expected-red key-bound suite: 5 total, 0 passed and all five new entry-point
  regressions failed for the reasons above;
- repaired focused authority, event and signing suites: 61 passed, 0 failed before
  adding the inclusive/multibyte boundary regression;
- full Money Factory POD Node suite: 250 total, 249 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- modified-module syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41906929238` (run number 415), job `126843974791`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips, all pinned Python/KDP review stages
passed, all 250 Money Factory Node/PostgreSQL tests passed with no failures or
skips, including the disposable PostgreSQL bridge and new key-bound regressions,
and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblo0cc6odus73ars530` remained `live` on Content Control runtime
revision `416cd282fd59cba2b0a2afa019b6356da1261447`. That confirms rollout liveness
for those Content Control bytes only; it does not deploy the separate Money Factory
key-bound repair or constitute POD readiness, database, end-to-end or publication
acceptance. This allowlisted R458 receipt uses `[skip render]` and does not trigger
another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level shared-key
resource protection only. It does not create or validate the dedicated live
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
