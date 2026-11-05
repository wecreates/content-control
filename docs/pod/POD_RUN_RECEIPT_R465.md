# POD run receipt R465

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `4648d96f37657cb436de0eb6df325d473e52c94c`,
  the verified R464 JSON media-type repair.
- Content Control `main` was `268c17a2cc6ff235bb6c7c4a2ab4c212f1b99286`,
  the report-only live Render health refresh on top of the R464 evidence receipt.
- No open overlapping POD/KDP pull request or duplicate R465 job existed.
  Existing unrelated draft pull requests, concurrent work and excluded Etsy work
  were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The authority endpoint enforced its 4 KiB request limit only while consuming the
stream. Unlike the event receiver, it did not reject an already oversized
`Content-Length` before reading. Declared and chunked bodies over the limit also
fell into the generic authority failure path and returned 409 rather than the
bounded 413 response. An authenticated oversized request could therefore occupy
the body reader until bytes or the five-second deadline arrived, reducing the
effective capacity of the live authority boundary. This was a resource and
publishing-safeguard defect, not evidence of a live authority, database,
marketplace account or accepted product.

The expected-red authority suite ran 21 tests on the prior implementation.
Twenty passed and the new real-HTTP regression failed because a 4,097-byte body
received 409 instead of 413.

Money Factory now uses one 4 KiB request constant, rejects an oversized declared
body before invoking its iterator, and maps streamed overflow to 413 using a
module-private sentinel. A server-loaded snapshot failure cannot forge that
classification. Oversized requests never reach snapshot lookup; the existing
authentication, media-type, deadline and publication safeguards remain unchanged.

Money Factory PR 420 contained only:

- `integrations/pod/authority-handler.mjs`: early declared-size rejection and
  private streamed-overflow classification; and
- `integrations/pod/authority-handler.test.mjs`: real HTTP, pre-read and streamed
  overflow regressions plus snapshot-lookup assertions.

Remote blob SHAs `13ba276741e777c83b327269056da6e2b21ff9e2` and
`80bbf01e156b479359b0c7106fe8d9534cd49053` exactly matched the locally tested
blobs. The exact PR head was `38d67d2010af3be9fdf3cb11c249b989ac5ce980`,
based on exact R464 Money Factory main. PR 420 was squash-merged under the
standing authorization as `4bec49c1289ae3bff973577785dc05f6b806a915`.

## Verification evidence

Local verification against the compatible Content Control contract:

- expected-red authority suite: 21 total, 20 passed and the single new size
  regression failed for the reason above;
- repaired focused authority/configuration suites: 83 passed, 0 failed;
- full Money Factory POD Node suite: 261 total, 260 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- full Money Factory POD Python suite: 81 passed, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41964209700` (run number 422), job `127037328775`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Python/KDP evidence suites and
23 editorial-bound KDP tests passed; all 261 Money Factory Node/PostgreSQL tests
passed with no failures or skips, including the disposable PostgreSQL bridge and
new real-HTTP request-size regression; and all 81 Money Factory bridge Python tests
passed.

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
fresh report-only `state/live-deployment-health.json` on current main remains
`FAIL`: the probe is incomplete and every recorded readiness check is false. The
live deploy does not establish accepted evidence readiness, deploy the separate
Money Factory request-size repair, or constitute database, end-to-end or
publication acceptance. This allowlisted R465 receipt uses `[skip render]` and
must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a bounded
code-level authority HTTP request contract only. It does not create or validate
the dedicated live database, prove durable storage and independent recovery,
mount and authenticate the live Money Factory authority, provide current
grants/revocation or marketplace account records, supply authorized intelligence
and regional rights, establish accepted generation, official templates, KDP
editorial/preview evidence, independent QA or verified remediation, demonstrate
authorized submission and readback on KDP, Redbubble, TeePublic, Zazzle and
Spreadshirt, reconcile actual economics or financial statements, demonstrate
mobile operations and monitoring in production, measure production capacity,
complete an authorized end-to-end job, or grant controlled launch approval.
Publication remains held for explicit approval after every acceptance requirement
is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the previously recorded connector and browser failures. The run
used only its actually available repository, hosted workflow and authorized Render
inspection capabilities; it did not have a continuously running self-hosted
worker, database shell, marketplace session, or authority to widen network access.
It did not use or disclose credentials, contact anyone, purchase resources, access
the social vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
