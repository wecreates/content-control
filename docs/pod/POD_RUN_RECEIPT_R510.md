# R510: exact recorded-activity observation windows

Reconciled current checklist/status/free-deployment docs, open PRs, POD workflows,
CC main d94b0e6fb5c99f86883af182c8d2aba42c44a790 and MF
main cd0d91b825a78933529eb96e1202c0133afc6350. No duplicate in-scope PR or job.
Latest CC POD push 42318894438 and MF cross-repo 42318960428 passed. Unrelated
narration 42313044842, monitor 42318234427 and browser 42315893023 failures are not
marked passed or weakened. Etsy is excluded.

Authorized free Docker/main Render service srv-darsdb8u01pc73dn4i2g in
tea-darsafojo6nc739844hg remains unsuspended, one instance, /health, auto deploy.
Existing live dep-dbn73efavr4c73dmng70 runs functional merge
dbddb961cabeb04a35b62be7ca329ead5bd5717f. No environment or infrastructure changed.

## Confirmed defect and bounded repair

The capacity report accepted arbitrary short timestamp strings. Date parsing
silently normalized February 30/31 into a valid-looking 24-hour window; date-only,
zone-less and 24:00 inputs were also ambiguous. Microseconds could be truncated,
making an inexact window look exactly 24 hours. Regression failed against baseline
(13 pass/1 fail of 14). Fixtures are synthetic, not real production activity.

String adapters now require exact UTC seconds or three-digit milliseconds with
calendar round-trip verification. Native PostgreSQL Date results remain supported
without invoking overridable methods. Non-UTC strings and sub-millisecond strings
fail closed rather than silently changing the observation interval. Focused tests
pass 14/14; syntax/whitespace checks pass. Read-only SQL/count semantics and explicit
capacity_verified=false, acceptance_verified=false, publication_enabled=false
are unchanged. All 24 live acceptance areas remain OPEN.

Local source lacks unrelated concurrent media/QA/ledger outputs, so no whole-tree
identity is claimed. Remote trees start from fresh main and replace only
the intended blobs, preserving concurrent work. Hosted/consumer/rollout evidence
is recorded below.
Local Node passed 1,239 with nine expected database-environment skips (1,248 total),
zero failures. MF bridge passed 279 Node with one expected database skip (280 total)
and all 81 Python tests. The real PostgreSQL capacity test exercises native
driver Date results, read-only transactions, exact 24-hour windows and false flags.
Parent POD source/test blobs match the local
base; only unrelated remote media/QA/ledger outputs differ.
Full local Python passed all 385 in 216.273 seconds. Expected hostile-annotation
MuPDF diagnostics were not failures. No production database was used for local tests.

## Hosted verification and dependent consumer

[CC PR1142](https://github.com/wecreates/content-control/pull/1142), exact head
ecf118130b1b30547acdc9fc85228c64a639cbc5, passed integration
[42320292676](https://github.com/wecreates/content-control/actions/runs/42320292676),
job 128242944550, and container
[42320292679](https://github.com/wecreates/content-control/actions/runs/42320292679),
job 128242944087. Both passed 1,248 Node/PostgreSQL without skips, all 385 Python and
durable review E2E; container non-root/dependency and publication-off startup checks
also passed. Fresh unchanged main/head/mergeability and exact-head gate checks
preceded guarded squash merge f50b95e3b61c32acb4bb88f791c38821d73270d0.
Changed source/test blobs match local hashes exactly. All remote unrelated work
was retained; no whole-tree local identity is claimed.

[MF PR467](https://github.com/wecreates/Money-factory/pull/467) changes only its
checkout pin to that consumer. Existing dedicated capacity/health steps remain;
both publication flags stay literal false. Original workflow blob
dea09cf52e51335623c7030aa3989acb9334ce0a was checked before editing. New blob
e3677259c1af09338d42a0943f9c45070ac4b94a matches local. Fresh base
cd0d91b825a78933529eb96e1202c0133afc6350 preserves prior concurrent work.
Exact head 9778e59d9833c6aa8710819f6a66196c2eb62f83 passed cross-repository
[42321029046](https://github.com/wecreates/Money-factory/actions/runs/42321029046),
job 128245354603: 898 selected CC Node, 40 health, 14 dedicated capacity and
280 MF Node/PostgreSQL tests, selected CC Python stages and 81 MF Python, with
zero failures/skips. Fresh unchanged main/head/mergeability and gate verification
preceded guarded squash merge b9f6f50aca234c705275c3a317600d7eedd42976.

## Live rollout evidence

Automatic deploy dep-dbn7d57b9u1s73f3ks3g of exact functional merge
f50b95e3b61c32acb4bb88f791c38821d73270d0 reached live at
2026-11-07T00:54:36.059043Z. No duplicate rollout was triggered. The local-browser
tool returned Unknown tool; public cloud-browser checks then observed
/api/print/status service/production/outbox DISABLED, publication_enabled=false,
publication_requested=false, adapters_verified=false and scoped storage
acceptance_verified=false. /health showed alive=true, production_approved=false,
publication=false and evidence_ready=null, separate from deployment liveness.
Configured cutoff remains December1, not provider-retention proof. No key entered;
no protected activity/database/grant/job/account was accessed. These are public
deployment checks, not authenticated live timestamp-fault or capacity acceptance.

## Execution limits and unfinished acceptance

No credible changed database-admin path exists; that failed path was not retried.
Hosted npm installation reports 10 audit vulnerabilities (2 moderate, 8 high);
these are not remediated or waived by passing POD gates. Security remains OPEN.
Configured December1 cutoff is not provider retention/recovery evidence. No new
live database/grant/account/rights, independent QA, adapter, economics, capacity,
recovery or owner-phone acceptance is claimed. Both publication flags stay false.
No paid resource, purchase, message to others, secret disclosure, social-vault,
network widening or fabricated approval. Per-run tools are not a continuous
self-hosted worker. Completion condition is unmet; automation remains enabled.
