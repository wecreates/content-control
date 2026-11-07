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
Focused outbox tests pass32/32, syntax/whitespace pass. Full local/hosted, dependent
MF and rollout evidence will follow after verification.

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
