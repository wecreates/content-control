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
