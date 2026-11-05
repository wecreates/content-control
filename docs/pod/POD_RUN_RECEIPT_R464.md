# POD run receipt R464

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `c3bec38f0cf4d9dffe1f5f1a49e65a839e544195`,
  the verified R463 canonical Bearer-scheme repair.
- Content Control `main` was `c0719602b40759911a7a2fb14dd19d46c6dd3e2e`,
  the R463 evidence receipt on top of the latest concurrent watchdog, zero-credit
  QA and accepted-candidate ledger work.
- No open overlapping POD/KDP pull request or duplicate R464 job existed.
  Existing unrelated draft pull requests, concurrent work and excluded Etsy work
  were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The authority HTTP endpoint required the request media type to be byte-exact
lowercase `application/json`. Media types are case-insensitive, and optional
whitespace before a parameter separator is valid. Consequently, conforming
clients sending `Application/JSON` or `Application/JSON ; charset=utf-8` received
415 before snapshot lookup even though the event authority path already
normalized its media type. This was an authority interoperability and publishing-
safeguard defect, not evidence of a live authority, database, marketplace account
or accepted product.

The expected-red authority suite ran 20 tests on the prior implementation.
Nineteen passed and the new real-HTTP regression failed because
`Application/JSON` received 415 instead of 200.

Money Factory now isolates the media type before parameters, trims optional
whitespace and compares the type case-insensitively. `text/json` remains 415 and
does not reach snapshot lookup. Successful responses continue to carry a signed,
fail-closed grant with publication permission false.

Money Factory PR 419 contained only:

- `integrations/pod/authority-handler.mjs`: canonical JSON media-type parsing;
  and
- `integrations/pod/authority-handler.test.mjs`: real HTTP accepted and rejected
  media-type cases plus snapshot-lookup assertions.

Remote blob SHAs `d577ae59a59c3543a3ce094b201daa595f08ba52` and
`5df0c0324167e5eae209cf32031dee0d808032eb` exactly matched the locally tested
blobs. The exact PR head was `50e0666de108247056912ff83cf1fbf6f3ef6f60`,
based on exact R463 Money Factory main. PR 419 was squash-merged under the
standing authorization as `4648d96f37657cb436de0eb6df325d473e52c94c`.

## Verification evidence

Local verification against the compatible Content Control contract:

- expected-red authority suite: 20 total, 19 passed and the single new media-type
  regression failed for the reason above;
- repaired focused authority/configuration suites: 82 passed, 0 failed;
- full Money Factory POD Node suite: 260 total, 259 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- full Money Factory POD Python suite: 81 passed, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41958468020` (run number 421), job `127018903135`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Python/KDP evidence suites and
23 editorial-bound KDP tests passed; all 260 Money Factory Node/PostgreSQL tests
passed with no failures or skips, including the disposable PostgreSQL bridge and
new real-HTTP media-type regression; and all 81 Money Factory bridge Python tests
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
current `state/live-deployment-health.json` remains `FAIL`: the probe is incomplete
and every recorded readiness check is false. The live deploy does not establish
accepted evidence readiness, deploy the separate Money Factory media-type repair,
or constitute database, end-to-end or publication acceptance. This allowlisted
R464 receipt uses `[skip render]` and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a code-level
authority HTTP parsing contract only. It does not create or validate the dedicated
live database, prove durable storage and independent recovery, mount and
authenticate the live Money Factory authority, provide current grants/revocation
or marketplace account records, supply authorized intelligence and regional
rights, establish accepted generation, official templates, KDP editorial/preview
evidence, independent QA or verified remediation, demonstrate authorized
submission and readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt,
reconcile actual economics or financial statements, demonstrate mobile operations
and monitoring in production, measure production capacity, complete an authorized
end-to-end job, or grant controlled launch approval. Publication remains held for
explicit approval after every acceptance requirement is satisfied. Etsy remains
excluded.

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
