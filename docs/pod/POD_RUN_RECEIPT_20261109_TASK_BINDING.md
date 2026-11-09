# November 9, 2026 — preserve POD task approval scope

Reviewed the 24-area checklist, implementation status, free deployment runbook,
open PRs, workflow results and the authorized Render worker. Starting revisions:
Content Control `d9a683b29b1289bca150e4ffc1e4ef8358078ec2`, Money Factory
`e2637186adbc945a61a8bf1f343d48c93eea9dc9`. Render was live on
`dep-dbp35p7ctcqc73ai0fb0` at the starting Content Control revision. The prior
shared-commit repair and its Money Factory pin were already merged; no duplicate
run or PR was opened for them.

The issuer previously accepted a task-scoped approval when the loaded job omitted
the task digest; the consumer likewise accepted an already scoped grant with a
brief that omitted the digest. The new regression failed on each original path.
This consumer change rejects missing, mismatched or noncanonical task digests if
either side supplies one. When both omit it, existing unscoped compatibility is
unchanged. This does not extend approval, change grant lifetimes, mount a live
issuer, or authorize a marketplace submission.

Local: 82 focused Content Control Node tests passed. Hosted exact-head tests,
merge and rollout evidence are recorded in the implementation PR. The dependent
Money Factory change applies the symmetric check to the approval and loaded job
and verifies the actual signed grant against the pinned consumer.

No credible changed production database-admin path was identified or retried.
No production configuration, marketplace account, paid resource or publication
switch was changed. All 24 live acceptance areas remain open; hosted fixtures and
Render process liveness do not establish live authority or always-on execution.
