# POD run receipt R452

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `9e91db96a4e0fdc75697e209b238ce902e17e96d`.
- Content Control `main` was `be5f3a4d8d64323ff744f57e37e951b65875b5ce`.
- No open POD/KDP pull request or duplicate R452 work existed in either
  repository. Unrelated draft Content Control PR 378 and concurrent work were
  preserved without modification. Excluded Etsy work was not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` continue to require attributable live evidence and
  keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory bounded authority text using raw UTF-8 byte length before JSON
serialization and HMAC. JSON string encoding expands quotes, backslashes, control
characters and lone surrogates; most control characters expand from one byte to six.
A claim containing 43,700 U+0001 characters used only about 44 KiB of the raw text
budget but expanded past the intended 256 KiB serialized-text ceiling and was still
signed. This was a pre-HMAC resource-bound defect; it was not evidence of a live
authority deployment, grant, database, marketplace account or accepted product.

One expected-red regression extended nine passing direct-signer evidence cases.
Before the repair, 9 of 10 cases passed and the new case failed because the escaped
claim was signed instead of rejected. The authority copier now counts exact bytes
that JSON will place between string quotes without allocating the escaped string.
It handles short escapes, six-byte control and lone-surrogate escapes, UTF-8 BMP
characters and four-byte surrogate pairs, failing as soon as the aggregate ceiling
is exceeded. A positive regression proves a 40,000-character escaped claim below
the ceiling remains unchanged after signing and parsing.

Money Factory PR 407 contained only:

- `integrations/pod/authority-evidence.mjs`: bounded exact JSON text accounting;
- `integrations/pod/sign-grant-evidence.test.mjs`: escaped-text rejection and
  below-limit retention regressions.

The exact PR head was `54d5ef366af768c48d6910c55cf758ae3cd199c4`.
It was two commits ahead of the unchanged base, with 26 additions and 2 deletions
across those two files. PR 407 was squash-merged under the standing authorization
as `8b9ace4f63fb0d00d3d8c591ff130265798a50d0`.

## Verification evidence

Local verification against Content Control
`be5f3a4d8d64323ff744f57e37e951b65875b5ce`:

- expected-red direct-signer suite: 10 total, 9 passed and the new amplification
  regression failed because the prior implementation signed the escaped claim;
- repaired focused authority suites: 38 passed, 0 failed;
- full Money Factory POD Node suite: 233 total, 232 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed;
- Node syntax checks and `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41851875625` (run number 409), job `126650029946`, completed successfully. Every
reported step succeeded, including all pinned Content Control review, rights,
template, KDP metadata/interior/cover and editorial-bound checks. The hosted logs
recorded all 233 Money Factory Node/PostgreSQL tests passed with 0 failures and
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
`60a85600f60646c7335d285c1abeabdf73d8f860`. R452 changes only Money Factory
authority code and this allowlisted receipt; it does not alter the Render
application's runtime bytes or constitute deployment acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair is code-level authority
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
