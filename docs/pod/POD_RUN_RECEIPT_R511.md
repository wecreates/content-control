# R511: snapshot outbox Date instants before signing

Reconciled current checklist/status/free-deployment docs, open PRs, workflows and
authorized Render service. CC main 64104c8b0f0eddfad71b1910598e792dd8491645,
MF main b9f6f50aca234c705275c3a317600d7eedd42976. No duplicate POD PR/job.
Latest POD push42320967972 and MF42321029046 passed. Unrelated open PRs remain
untouched, including Etsy exclusions. Render remains the existing free Docker/main
service, unsuspended, one instance, /health, auto deploy. Existing live deployment
dep-dbn7d57b9u1s73f3ks3g runs f50b95e3b61c32acb4bb88f791c38821d73270d0.

## Reproduced security boundary defect

Outbox validation called returned Date methods; JSON serialization subsequently
called toJSON on that same object. Three new regression tests all failed against
baseline: executable getters, substituted signed timestamp, proxy prototype trap.
This demonstrates an adapter-result trust-boundary defect, not a proven live attack.

The row snapshot now converts genuine native Dates to inert UTC text using the
intrinsic getTime before freezing/signing. Overridden getters/toJSON are never
called; proxy/invalid/forged Dates fail closed. Strings retain existing exact UTC
calendar validation. PostgreSQL microsecond cursor text remains separate/unchanged.
Focused outbox tests pass 33/33, syntax/whitespace pass. A fourth regression also
preserves authorized per-event continuation for invalid timestamps; normalization
occurs inside that failure boundary, not during batch selection. Full local/hosted,
dependent MF and rollout evidence is recorded below.
Full local Node passed1,242 with nine expected database-environment skips (1,251
total before the final continuation regression). Local Python attempted266 tests but failed two module imports because this
run lacks cv2; this is not a full Python pass. Hosted image/integration QA remains
required. MF bridge Node passed279 with one expected database skip (280 total).
All81 local MF Python tests passed.
Final local Node rerun passed1,243 with nine expected skips (1,252 total).
Superseded first-head hosted runs were cancelled by existing concurrency policy;
only the final-head runs may authorize a merge. No duplicate manual jobs launched.

## Hosted gates and consumer

[CC PR1144](https://github.com/wecreates/content-control/pull/1144), final head
e9be415819cedd256f7767cb2846a1ae2bdd563c, passed integration
[42326291117](https://github.com/wecreates/content-control/actions/runs/42326291117),
job128262309323, and container
[42326291204](https://github.com/wecreates/content-control/actions/runs/42326291204),
job128262307652. Each passed all1,252 Node/PostgreSQL without skips, all385 Python
and durable E2E; image non-root/dependency and disabled startup checks passed.
Fresh unchanged main/head, exact successful gates and mergeability preceded guarded
squash merge cca116e003f7252210900ab862c3fb0ff9e87372. Source/test blob hashes were
checked against local; no unrelated source or output changes were included.

[MF PR468](https://github.com/wecreates/Money-factory/pull/468) pins that consumer
and adds four timestamp tests to the existing core step. Old workflow blob
e3677259c1af09338d42a0943f9c45070ac4b94a was checked; new blob
e06c7c2ccb07db1eb4f57bea32bd93df884f07ab matches local. Both publication flags stay
literal false. Fresh remote base b9f6f50aca234c705275c3a317600d7eedd42976 preserves
concurrent work; no whole-tree overwrite or duplicate job.
Exact head 1c1b02228c1a407cf7f222d6538564a2321c5435 passed cross-repository
[42326848862](https://github.com/wecreates/Money-factory/actions/runs/42326848862),
job128264011648: 902 CC core Node, 40 health, 14 capacity and 280 MF Node/PostgreSQL
tests, selected CC Python and 81 MF Python passed without failures/skips.
Fresh unchanged base/head/mergeability and exact successful run
preceded guarded squash merge 463691beea1707312e86f8b989bc8f410efb5db0. Both publication flags stay false.

## Live rollout evidence

Automatic deploy dep-dbn8bcks728c73901070 of exact functional merge
cca116e003f7252210900ab862c3fb0ff9e87372 reached live at
2026-11-07T01:59:21.773893Z. No manual duplicate rollout or environment change.
The browser extension returned Unknown tool; independent public cloud-browser
checks showed service/production/outbox DISABLED, publication_enabled=false,
publication_requested=false, adapters_verified=false, storage acceptance=false.
Configured December1 cutoff remains configuration only, not recovery evidence.
/health showed alive=true, production_approved=false, publication=false and
evidence_ready=null. No operations key was entered and no protected database,
grant, event or marketplace was accessed. This is rollout/public safety evidence,
not live authenticated outbox acceptance or proof of an actual exploit.

## Limits and unfinished work

All24 live acceptance areas remain OPEN. Publication flags remain false. No live
authority/account/rights/QA/adapter/recovery/capacity/owner-phone acceptance claimed.
No credible changed database-admin access path; no retry. No purchases, new paid
resources, messages to others, secrets, social vault, widened network or fabricated
approvals. Existing dependency audit warnings remain unremediated, not waived by
these tests. Scheduled tools do not imply a continuous self-hosted worker.
Completion condition unmet; automation remains enabled.

The prior r510 scratch worktree was unavailable in this run. A safe git fetch of
current main succeeded using the existing repository; an isolated worktree now
matches current source. Remote commits still start from freshly read main trees.
The large status document returned empty via file endpoint; its exact blob was
read instead, without substituting an old status claim.
