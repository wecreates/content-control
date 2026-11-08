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

Focused operational-health suite initially passed24/24 after repair. A further
invalid-signal regression verifies cancellation validation precedes owned-timer
allocation; the final focused suite passed25/25. Syntax/whitespace pass.
Final full local Node passed1,217 with nine expected environment skips (1,226
total), zero failures. Superseded initial CI runs42295320042/42295320095 were
automatically cancelled when the timer-validation follow-up advanced the same PR;
only the final head is eligible for merge. No duplicate PR was created.
Full local/hosted, dependent consumer pin and rollout results follow below.
Full local Python passed385/385 in302.967 seconds. MF local POD bridge passed
279 Node tests with one expected database skip (280 total), and81/81 Python.
The final standalone child-process stalled-factory probe emitted only the fixed
POD_DIAGNOSTIC_TIMEOUT code after40,010ms; no other handle kept that child alive.
This is a measured cancellation receipt, not proof underlying remote I/O stops.
Remote commits use current main; local source lacks only unrelated prior QA/ledger
outputs, so no whole-tree equivalence is claimed. Changed blobs are checked exactly.

## Hosted verification and dependent pin

[CC PR1134](https://github.com/wecreates/content-control/pull/1134), final exact
head a195dcaebc482b7f9c9909b29308d99bf036c2eb, passed integration
[42295449806](https://github.com/wecreates/content-control/actions/runs/42295449806),
job128159515025, and container
[42295449789](https://github.com/wecreates/content-control/actions/runs/42295449789),
job128159518556. Both passed all1,226 Node/PostgreSQL tests with zero skips and
all385 Python tests, plus durable E2E; container startup also passed. Fresh
unchanged main/head and mergeability checks preceded guarded squash merge
3900103fc3642ef0fa0cb5058eaa9ffc75f7df4d.

[MF PR463](https://github.com/wecreates/Money-factory/pull/463) pins that tested
consumer and adds the operational-health lifecycle suite to its existing workflow.
Old remote workflow hash was checked before editing; fresh remote main preserved
all concurrent browser-fleet/monitor code and output changes. New workflow blob
ea941a578722cb79dd389ba3101e81f1ad7236a4 matches local; both publication flags
remain literal false. Local MF testing was limited to the POD bridge, not unrelated
concurrent monitor/browser changes.
Exact head1ed81bb66778832b6150c16c88e68e5a6b88c25e passed cross-repository
[42297128764](https://github.com/wecreates/Money-factory/actions/runs/42297128764),
job128165186752: 898 selected CC Node tests,25 operational-health tests,280 MF
Node/PostgreSQL tests, all selected CC Python stages and81 MF Python tests, with
zero failures/skips. Fresh unchanged base/head and mergeability checks preceded
guarded squash merge0f4fd6397861924f69c95adaaca5134667afd807.

## Live deployment evidence

Automatic deploy dep-dbn4d3gae00c739lf1og of exact functional merge
3900103fc3642ef0fa0cb5058eaa9ffc75f7df4d reached live at
2026-11-06T21:30:00.343524Z. No duplicate deployment or setting change was made.
Fresh independent public cloud-browser /api/print/status showed service,
production and outbox DISABLED, publication_enabled=false,
publication_requested=false, adapters_verified=false, configured December1
cutoff and storage acceptance_verified=false. /health showed alive=true,
production_approved=false and publication=false, with evidence readiness separate.
No operations key was entered and no protected database, snapshot, job, grant or
marketplace was accessed. This is public deployment evidence, not a live manual
snapshot execution, accepted evidence readiness or actual owner-phone acceptance.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Monitoring fixtures and process liveness
do not prove real authority, owner-phone use, grants, rights, QA, adapters, economics,
recovery or measured capacity. There is no changed database-admin access path, so
that failed path was not retried. Etsy is excluded. Both publication flags remain
false; no paid resource, purchase, secret disclosure, social-vault access, widened
network, invented approval or continuous self-hosted-worker claim. Available tools
are per-run only. Completion condition is unmet; automation remains enabled.
