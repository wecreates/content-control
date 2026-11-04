# POD run receipt R461

Date: 2026-11-04 UTC (2026-11-04 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `17196e27b3205580f9fc3f6ed6b9f63698a2d3b3`,
  the verified R460 bounded shared-key allocation repair.
- Content Control `main` was `386dce1eb27e9d276375807bc6dc38545a0630fb`,
  the R460 report-only receipt. Concurrent health evidence was preserved without
  modification.
- No open POD/KDP pull request or duplicate R461 job existed. Existing unrelated
  pull requests and concurrent work were preserved. Excluded Etsy work was not
  touched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. They continue to require attributable live
  evidence and keep all 24 acceptance areas open.

## Confirmed defect and repair

Money Factory used the common UTF-8 shared-key validator for both HMAC-only keys
and the POD authority's bearer credential. A bearer key containing a line feed,
carriage return, DEL or non-ASCII text could therefore pass construction even
though Node's HTTP `Authorization` field cannot safely transport all of those
values unchanged. A syntactically accepted configuration could leave the
authority unable to authenticate real clients. This was a fail-closed authority
configuration and publishing-safeguard defect, not evidence of a live authority,
database, marketplace account or accepted product.

The expected-red suite ran 14 focused tests on the prior implementation. Thirteen
passed and the new transport regression failed because a 32-byte bearer key ending
in a line feed was accepted.

Money Factory now applies a dedicated bearer-key contract after the existing
32-to-4,096-byte exact UTF-8 shared-key checks. The transport credential must
consist only of visible ASCII bytes from `0x20` through `0x7e`. HMAC signing and
event keys retain the existing valid Unicode behavior because they do not cross an
HTTP header. The authority still requires distinct authentication and signing key
bytes.

Money Factory PR 416 contained only:

- `integrations/pod/key-contract.mjs`: the bounded transport-specific validator;
- `integrations/pod/authority-handler.mjs`: authority auth-key enforcement; and
- `integrations/pod/key-bounds.test.mjs`: control, DEL, Unicode and positive
  Unicode-signing regressions.

All three remote blob SHAs exactly matched the locally tested blobs. The exact PR
head was `c14f265882d037c773437203228e6bcfa470f534`, based on exact R460 Money
Factory main. PR 416 was squash-merged under the standing authorization as
`7ee25e77a6ee5642da4ab0a233cae9fd08ef0d6b`.

## Verification evidence

Local verification against the current compatible Content Control contract:

- expected-red bearer-transport suite: 14 total, 13 passed and the single new
  transport regression failed for the reason above;
- repaired focused authority and configuration suites: 80 passed, 0 failed;
- full Money Factory POD Node suite: 258 total, 257 passed, 1 PostgreSQL-only test
  skipped because no disposable local database URL was supplied, 0 failed;
- Money Factory POD Python suite: 81 passed, 0 failed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41934203967` (run number 418), job `126938472472`, completed successfully. Every
reported step succeeded. The hosted logs recorded all 825 pinned Content Control
Node tests passed with no failures or skips; the eight pinned Python/KDP evidence
groups and 23 editorial-bound KDP tests passed; all 258 Money Factory
Node/PostgreSQL tests passed with no failures or skips, including the disposable
PostgreSQL bridge and new bearer-key regression; and all 81 Money Factory bridge
Python tests passed.

The hosted environment repeatedly recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. The merged Money Factory workflow retains both
values as literal `false`.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dblpira5s2ss73a5s3f0` remained `live` on Content Control revision
`886ce90d28391723bd44a77f71d9b1e9aaef84d2`. The R460 receipt used
`[skip render]` and correctly created no replacement deploy.

That confirms rollout liveness for the older Content Control runtime bytes only.
The current report-only `state/live-deployment-health.json` remains `FAIL`: its
probe was not completed and every recorded readiness check is false. The live
deploy therefore does not establish accepted evidence readiness, deploy the
separate Money Factory bearer repair, or constitute POD database, end-to-end or
publication acceptance. This allowlisted R461 receipt also uses `[skip render]`
and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a code-level
authority transport-key contract only. It does not create or validate the dedicated
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
