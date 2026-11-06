# R500: bounded read-only production preflight

## Reconciled state

Content Control began at `5078210970691d3adb749167bab9e853ec17dd3d`;
Money Factory at `e6fb6f78220d67d3a6fe556b2c9413abc89a0513`.
The prior timeout-fixture repair (MF #455) is merged and its exact-head workflow
`42235278664` passed. No duplicate POD PR or job was started. Unrelated drafts
were preserved. Render's existing free Docker service is unsuspended and live on
functional commit `332b01b1f64da814ba5532941b4dc173d021ba19`, deployment
`dep-dbmtsbtckfvc73923u0g`. Auto-deploy remains enabled; no manual deploy requested.

## Repair

The read-only production preflight previously awaited bridge reads, pool factory,
client acquisition, queries, migration-file reads, rollback and pool shutdown
without a shared deadline. PostgreSQL statement_timeout cannot bound acquiring
a connection or shutting down a pool. The existing diagnostic deadline now
bounds those waits to 40 seconds and accepts caller cancellation. Late clients
are destroyed; late pools are shut down best effort. A timed-out query is not
followed by rollback on an uncertain protocol state. Owned-pool shutdown starts
even after expiry, but cannot strand the preflight response. A referenced timer
keeps a standalone CLI alive until its redacted result is emitted, and is cleared
on completion. The checks remain read-only and cannot authorize publication.

Seven focused regressions cover pre-aborted admission and stalled bridge,
factory, acquisition, query, rollback and shutdown. Focused suite: 51/51.
Full local and exact-head hosted results are retained in the associated PR.
No baseline red test result is claimed; the missing bounds were identified by
direct code inspection, and repaired cancellation paths were exercised locally.

## Limits and next dependencies

All 24 live acceptance areas remain OPEN. This is a diagnostic reliability repair,
not proof of live database/authority, backup retention, rights/accounts, actual
marketplace adapters, independent QA, measured capacity or end-to-end acceptance.
The unchanged failed database-administration path was not retried. No quota
boundary, credentials, permissions, network access or approvals were invented.
The last verified storage cutoff is not extended by this code.
Both publication flags remain false; Etsy is excluded. Only currently available
bounded tools were used; no continuously running self-hosted worker is claimed.
