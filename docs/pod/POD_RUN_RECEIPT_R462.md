# POD run receipt R462

Date: 2026-11-05 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `008e19ae97eff7141ed447a497def5c20a3c0bd4`.
  It preserved the verified R461 bearer-key repair and a later unrelated free
  monitor cadence tick.
- Content Control `main` was `82f5f48b924130253aa38a3731857e7cb14e4338`.
  It preserved the R461 receipt plus later watchdog, zero-credit QA and accepted-
  candidate ledger updates. Those concurrent changes were used as the exact base
  and were not modified.
- No open POD/KDP pull request or duplicate R462 job existed. Existing unrelated
  pull requests and excluded Etsy work were not touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and test presence alone do not complete them.

## Confirmed defect and repair

R461 restricted the POD authority bearer credential to visible ASCII but still
accepted spaces, commas, quotes, colons and `=` in the middle of the secret. Those
characters are outside the Bearer credential grammar and can be rejected or
reinterpreted by HTTP clients, parsers and intermediaries even though Node can
represent them in a raw header value. A startup configuration could therefore pass
local validation while being unusable through a conforming HTTP path. This was a
fail-closed authority configuration and publishing-safeguard defect, not evidence
of a live authority, database, marketplace account or accepted product.

The expected-red key suite ran 14 tests on the prior implementation. Thirteen
passed and the new regression failed because a 32-byte bearer secret ending in a
space was accepted.

Money Factory now enforces the RFC 6750 `b64token` alphabet for the authority
credential. Letters, digits, `-`, `.`, `_`, `~`, `+` and `/` are accepted; `=` is
accepted only as terminal padding. Standard Base64 and Base64URL-compatible keys
remain valid. The separate UTF-8 shared-key contract and Unicode HMAC signing/event
keys remain unchanged.

Money Factory PR 417 contained only:

- `integrations/pod/key-contract.mjs`: canonical Bearer-token validation; and
- `integrations/pod/key-bounds.test.mjs`: whitespace, punctuation, embedded-
  padding and positive padded-token regressions.

Both remote blob SHAs exactly matched the locally tested blobs. The exact PR head
was `3b25c489aaafbf8fbe89abee39b8ece0b7cb755a`, based on the concurrent Money
Factory head above. PR 417 was squash-merged under the standing authorization as
`ab5decc3d273f2233608ca330f04554b9c24f3dd`.

## Verification evidence

Local verification against the compatible Content Control contract:

- expected-red key suite: 14 total, 13 passed and the single new Bearer grammar
  regression failed for the reason above;
- repaired focused authority/configuration suites: 80 passed, 0 failed;
- full Money Factory POD Node suite: 258 total, 257 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- full Money Factory POD Python suite: 81 passed, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41947558635` (run number 419), job `126983428114`, completed successfully. Every
reported step succeeded. Hosted logs recorded all 825 pinned Content Control Node
tests passed with no failures or skips; the pinned Python/KDP evidence and 23
editorial-bound KDP tests passed; all 258 Money Factory Node/PostgreSQL tests passed
with no failures or skips, including the disposable PostgreSQL bridge and new
Bearer grammar regression; and all 81 Money Factory bridge Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged workflow retains both literal false
values.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Concurrent Content Control operational commits deployed independently during this
run. Deploy `dep-dblt4f6of33c73en5f0g` reached `live` on Content Control revision
`82f5f48b924130253aa38a3731857e7cb14e4338`.

That confirms rollout liveness for those Content Control runtime bytes only. The
current `state/live-deployment-health.json` remains `FAIL`: the probe is incomplete
and every recorded readiness check is false. The live deploy does not establish
accepted evidence readiness, deploy the separate Money Factory Bearer repair, or
constitute database, end-to-end or publication acceptance. This allowlisted R462
receipt uses `[skip render]` and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a code-level
authority credential grammar only. It does not create or validate the dedicated
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
