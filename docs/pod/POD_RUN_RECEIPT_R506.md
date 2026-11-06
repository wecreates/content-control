# R506: bound the complete manual operations snapshot lifecycle

Fresh CC main060e14c2542567307aa45b499e6893f21afdf90d and MF
main9b3b32b33cf91249d2f48f9f82375ca63126db99, current checklist/status/free
deployment guides, open PRs and workflow results were reconciled. No duplicate
POD job/PR exists. Latest POD gates passed; unrelated video acceptance and MF
browser/free-monitor failures were not weakened or falsely marked passed.
MF concurrent browser-fleet/monitor source and state changes must be preserved.

Authorized existing free Docker/main Render service remains unsuspended, one
instance, /health and automatic commit deployment. Latest live functional revision
is37769f83dada4874c99dfeffa72e7e3ea106dd04, deploy dep-dbn2usc9v7es739vubk0.
No configuration, network, account, credential or activation setting was changed.

## Confirmed defect and repair

Manual operationsSnapshot bounded its metrics queries but not pool factory or
owned-pool shutdown. Four new regressions fail baseline: pre-cancelled work still
starts; two late-factory cases stall; completed metrics can hang awaiting shutdown.
The command now shares one40-second deadline across factory, metrics and shutdown.
A referenced timer keeps standalone execution alive to print its redacted failure.
Already-cancelled calls start no work; late pools are shut down with throw/rejection
consumed. Shutdown is initiated after cancellation but awaited only within the
remaining deadline. Every normal/error path clears the owned timer. Query reads
remain read-only; no workers, migrations, approvals or publication are started.

Focused operational-health suite passed24/24 after repair; syntax/whitespace pass.
Full local/hosted, dependent consumer pin and rollout results follow below.
Remote commits use current main; local source lacks only unrelated prior QA/ledger
outputs, so no whole-tree equivalence is claimed. Changed blobs are checked exactly.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Monitoring fixtures and process liveness
do not prove real authority, owner-phone use, grants, rights, QA, adapters, economics,
recovery or measured capacity. There is no changed database-admin access path, so
that failed path was not retried. Etsy is excluded. Both publication flags remain
false; no paid resource, purchase, secret disclosure, social-vault access, widened
network, invented approval or continuous self-hosted-worker claim. Available tools
are per-run only. Completion condition is unmet; automation remains enabled.
