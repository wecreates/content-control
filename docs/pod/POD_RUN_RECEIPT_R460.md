# POD run receipt R460

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `38a6f24e59b06e6644683d76e407671db94d712b`,
  the verified R459 shared-key text-identity repair.
- Content Control `main` was `40216802b6b91f7f8c6fc4557ba8c14c28fdcd55`.
  It included the R459 receipt and the later report-only live-deployment-health
  observation. That concurrent health evidence was preserved without modification.
- No open POD/KDP pull request or duplicate R460 job existed. Existing unrelated
  pull requests and concurrent work were preserved. Excluded Etsy work was not
  touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. They continue to require attributable live
  evidence and keep all 24 acceptance areas open.

## Confirmed defect and repair

R459 added exact UTF-8 shared-key identity checks to Money Factory's centralized
POD key validator, but performed `Buffer.from` for that check before applying the
existing 4,096 encoded-byte ceiling. An arbitrarily oversized configured key could
therefore cause a second, unbounded byte allocation before being rejected. This
regressed R458's intended resource order even though the key was ultimately denied.
It was a bounded-resource and publishing-safeguard defect, not evidence of a live
authority deployment, database acceptance, marketplace account or accepted product.

The expected-red suite ran 13 focused tests on the prior implementation. Twelve
passed and the new allocation-order regression failed after observing one
`Buffer.from` allocation for a 4,097-byte key before rejection.

Money Factory now computes encoded length without allocating the duplicate Buffer,
rejects values outside 32 to 4,096 bytes, and only then performs the bounded NUL and
exact UTF-8 round-trip identity checks. The R459 identity guarantees and valid
supplementary-plane Unicode behavior remain unchanged. Every grant, authority and
event entry point continues to use the centralized contract before authentication
or HMAC work.

Money Factory PR 415 contained only:

- `integrations/pod/key-contract.mjs`: resource-safe validation order; and
- `integrations/pod/key-bounds.test.mjs`: the Buffer-allocation-order regression.

The two remote blob SHAs exactly matched the locally tested commit. The exact PR
head was `e444c92b9bb20c37a318439db0774bf6c3c7d3dd`, based on the exact R459
Money Factory main. PR 415 was squash-merged under the standing authorization as
`17196e27b3205580f9fc3f6ed6b9f63698a2d3b3`.

## Verification evidence

Local verification against the current compatible Content Control contract:

- expected-red key-allocation suite: 13 total, 12 passed and the single new
  allocation-order regression failed for the reason above;
- repaired focused authority, event, signing and key-contract suites: 50 passed,
  0 failed;
- full Money Factory POD Node suite: 257 total, 256 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed; and
- modified-module syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41932221637` (run number 417), job `126931691738`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips; the eight pinned Python/KDP evidence
groups and 23 editorial-bound KDP tests passed; all 257 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and new allocation-order regression; and all 81 Money Factory
bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblpira5s2ss73a5s3f0` remained `live` on Content Control revision
`886ce90d28391723bd44a77f71d9b1e9aaef84d2`. The later Content Control commits
used `[skip render]` and correctly created no replacement deploy.

That confirms rollout liveness for the older Content Control runtime bytes only.
The current report-only `state/live-deployment-health.json` remains `FAIL`: its
probe was not completed and all recorded readiness checks are false. The live
deploy therefore does not establish accepted evidence readiness, deploy the
separate Money Factory allocation repair, or constitute POD database, end-to-end
or publication acceptance. This allowlisted R460 receipt also uses `[skip render]`
and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair restores a code-level
shared-key resource guarantee only. It does not create or validate the dedicated
live database, prove durable storage and independent recovery, mount and
authenticate the live Money Factory authority, provide current grants/revocation or
marketplace account records, supply authorized intelligence and regional rights,
establish accepted generation, official templates, KDP editorial/preview evidence,
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
