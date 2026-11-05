# POD run receipt R463

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `ab5decc3d273f2233608ca330f04554b9c24f3dd`,
  the verified R462 Bearer-token grammar repair.
- Content Control `main` was `82686792473ab2405969951eba581db117265f32`,
  the R462 evidence receipt on top of the latest concurrent watchdog, zero-credit
  QA and accepted-candidate ledger work.
- No open POD/KDP pull request or duplicate R463 job existed. Existing unrelated
  pull requests, concurrent work and excluded Etsy work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The authority credential satisfied the R462 Bearer token grammar, but the handler
compared the public `Bearer` scheme byte-for-byte as part of the secret buffer.
HTTP authentication schemes are case-insensitive and the credentials grammar
allows one or more literal spaces between scheme and token. A conforming client or
ingress normalization could therefore receive 401 while presenting the exact
configured secret. This was an authority interoperability and publishing-
safeguard defect, not evidence of a live authority, database, marketplace account
or accepted product.

The expected-red authority suite ran 19 tests on the prior implementation.
Eighteen passed and the new real-HTTP regression failed because a lowercase
`bearer` scheme received 401 instead of 200.

Money Factory now validates the six-character scheme case-insensitively, requires
at least one literal HTTP space, accepts additional grammar-permitted spaces, and
performs timing-safe comparison only on the exact configured secret. Tab
separators and altered tokens remain 401 and never reach snapshot lookup.

Money Factory PR 418 contained only:

- `integrations/pod/authority-handler.mjs`: canonical scheme parsing and exact
  secret comparison; and
- `integrations/pod/authority-handler.test.mjs`: real HTTP accepted/rejected
  scheme and separator cases plus snapshot-lookup assertions.

Both remote blob SHAs exactly matched the locally tested blobs. The exact PR head
was `9aeb231f845b28c0d45f2ad2678d57abd040427c`, based on exact R462 Money Factory
main. PR 418 was squash-merged under the standing authorization as
`c3bec38f0cf4d9dffe1f5f1a49e65a839e544195`.

## Verification evidence

Local verification against the compatible Content Control contract:

- expected-red authority suite: 19 total, 18 passed and the single new scheme
  regression failed for the reason above;
- repaired focused authority/configuration suites: 81 passed, 0 failed;
- full Money Factory POD Node suite: 259 total, 258 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- full Money Factory POD Python suite: 81 passed, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41954554291` (run number 420), job `127006210388`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Python/KDP evidence and 23
editorial-bound KDP tests passed; all 259 Money Factory Node/PostgreSQL tests passed
with no failures or skips, including the disposable PostgreSQL bridge and new real
HTTP scheme regression; and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged workflow retains both literal false
values.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblt4f6of33c73en5f0g` remained `live` on Content Control revision
`82f5f48b924130253aa38a3731857e7cb14e4338`.

That confirms rollout liveness for those Content Control runtime bytes only. The
current `state/live-deployment-health.json` remains `FAIL`: the probe is incomplete
and every recorded readiness check is false. The live deploy does not establish
accepted evidence readiness, deploy the separate Money Factory scheme repair, or
constitute database, end-to-end or publication acceptance. This allowlisted R463
receipt uses `[skip render]` and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a code-level
authority HTTP parsing contract only. It does not create or validate the dedicated
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

Database administration was not retried because this run had no credible changed
access path after the previously recorded connector and browser failures. The run
used only its actually available repository, hosted workflow and authorized Render
inspection capabilities; it did not have a continuously running self-hosted worker,
database shell, marketplace session, or authority to widen network access. It did
not use or disclose credentials, contact anyone, purchase resources, access the
social vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
