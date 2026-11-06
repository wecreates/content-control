# R501: preflight release failures cannot verify configuration

Current heads were reconciled at Content Control
`85fae67b5bf94276f163b13f2a6560bf0fc7582f` and Money Factory
`4233997e0513c1dca6fb36eed5c4e43cba54f4c8`. The completion checklist,
implementation status, free-deployment guide, open PRs, workflow results and
authorized free Render service were inspected. No duplicate POD PR existed.
Unrelated drafts were preserved. Ordered Capability Completion run 42242552983
failed at its unresolved-capability diagnostic gate; that is not a POD regression
and its guard was not weakened.

## Confirmed defect

The preflight's finally block called client.release without catching or awaiting
its result. A throwing release escaped the redacted result and skipped pool.end;
a rejecting release returned CONFIGURATION_VERIFIED with an unhandled rejection.
The initial focused suite reproduced exactly two failed tests. The release-stall
case already blocked through the deadline, and is retained as a regression.

Release now starts even after expiry and is consumed through the shared deadline.
Failure marks DATABASE_READABLE blocked, while owned-pool shutdown still runs.
Late-acquired client release consumes both synchronous throws and rejected
promises without retrying or issuing more queries. Real pg synchronous release
behavior and all existing read-only checks remain unchanged. No credentials,
expiry, approvals, network rules or publication flags change.

The repaired initial focused suite passed 54/54. Additional late-release
regressions and full local/hosted results are recorded in the associated PR.

## Acceptance truth and execution limits

All 24 live acceptance areas remain OPEN. Repair/test evidence does not prove
live restricted database configuration, independent backup retention, mounted
Money Factory authority, current accounts/grants/rights, authorized market data,
independent QA, marketplace adapters, measured capacity or real end-to-end jobs.
The database-administration path is unchanged and was not retried. Existing
Render deploy dep-dbmv0g8u01pc739k2j4g was live at start, on functional
883a753cc365ed2441c0055d24d144829e19b5aa. Both publication flags remain false.
Etsy is excluded. No purchase, paid infrastructure, secret disclosure, social-vault
access, network widening or continuous self-hosted worker is claimed.

## Verified repair and rollout

Final focused suite: 56/56. Final complete local Node suite: 1,201 total,
1,192 passed, nine expected environment skips. Python: 385/385 in 294.022s.
Syntax/whitespace checks passed. Exact local/remote tree:
`0e8586d236da391f768cd6f531a96300c3538a49`.
CC #1125 passed integration run 42249185142/job 127999358518 and container
run 42249185076/job 127999358211, then merged as
`6f9c453739b5dfa79379b71fe056f40e4a750d29`.

Render automatically deployed that exact merge as
`dep-dbmvpgec6qcc73blgfhg`, live at 2026-11-06T16:15:05.579429Z.
Fresh public probes showed health alive=true, production_approved=false and
publication=false; readiness ok=false/captionReady=false; POD service,
production and outbox DISABLED, zero cycles, publication enabled/requested=false
and adapters_verified=false. These are liveness/safeguard observations only.
The extension tool returned Unknown tool; public probes used the available
cloud browser. No database administration was attempted through it.

Money Factory pin #457 preserves the current monitoring records and both false
publication literals. Local bridge verification passed 279 Node tests with one
expected PostgreSQL-only skip and all 81 Python tests. Its exact-head hosted
workflow and merge outcome are retained with the PR and final receipt update.

Exact-head Money Factory workflow 42250426140, job 128003738410, passed every
pinned contract, Python/KDP, Node/PostgreSQL and Python bridge stage.
MF #457 merged as `087d981a784a05699810c4d7c4b8371b18d60069`.
All 24 live acceptance areas remain OPEN, so the completion automation remains
enabled. Publication is held for explicit approval and cannot be enabled here.
