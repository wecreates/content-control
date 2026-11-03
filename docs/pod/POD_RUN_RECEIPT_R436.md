# POD run R436 evidence

Date: 2026-11-03 (UTC)

## Reconciled and preserved state

- Starting Money Factory main: `1e20cda28526cdc7c0ca075893496085ca3c7733`, including the concurrent free-monitor cadence tick.
- Starting Content Control main: `3ea7780420c339ee041538660e66ac4e50fe743b`.
- During exact-head CI, Content Control independently advanced through `184dc14f2f6399c708392772e4dbfef3d2059315` and `1bf4be7d2ba457318fa864a6d6c07db7703c2ad4`. Those monitoring/QA changes were preserved; this receipt is based on the latter current head.
- No open Money Factory POD pull request existed before this repair. Content Control PR 378 is an unrelated draft OpenFilm candidate and was not changed.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory's exported `acceptPodEvent` inbox read direct caller envelope and connection-option properties before proving those objects inert. A Proxy or accessor could therefore execute inside the event admission boundary. The HTTP route normally passes parsed JSON, but the exported receiver contract also needs to fail closed for direct callers.

Five expected-red cases reproduced the defect: an envelope Proxy, a payload accessor, a signature accessor, an options Proxy, and a connection-timeout accessor. Each executed and reached later scope validation before the repair.

The inbox now extracts only exact own data descriptors from a plain two-field envelope before reading its payload or signature. It separately extracts the two supported connection options from a non-Proxy plain object without invoking getters or inherited values. Executable inputs fail closed as `EVENT_ENVELOPE_INVALID` or `EVENT_CONNECTION_CONFIG_INVALID` with zero trap/getter reads. Signed event, replay, transaction, timeout, database-capability, and HTTP handler behavior is otherwise unchanged.

## Verification and promotion

- Focused event admission, handler, capability, connection, query, envelope, and transaction matrix: 61 passed, 0 failed.
- Full paired POD Node suite: 164 total, 163 passed, 1 PostgreSQL-only skipped, 0 failed.
- POD Python suite: 81 passed, 0 failed.
- Syntax and `git diff --check`: passed.
- Money Factory PR 391 exact head: `1a98ead80b8bb5468d5ead1f74e22cb24a8ed89f`.
- Cross-repository workflow run 41742297146, job 126286536739 (`review-production`): completed successfully. Every setup, contract, evidence, recovery, KDP QA, Node, Python, cleanup, and completion step succeeded.
- Squash merge: `b0cbd79dd957efa30c2f1cba1f3672a30e251232`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained an unsuspended free Docker web service on `main`, with one instance, automatic commit deploys enabled, and liveness path `/health`.

The latest deployment changed during this run because of independent Content Control monitoring/QA work. Deploy `dep-dbl75bqbg0es73a043lg` is `live` on exact Content Control head `1bf4be7d2ba457318fa864a6d6c07db7703c2ad4`; it started at 2026-11-03T23:48:52.369636Z and finished at 2026-11-03T23:49:51.561789Z. This documentation-only receipt uses `[skip render]` and must not trigger another deployment. Process liveness is not proof of `/readyz`, database, marketplace, or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens Money Factory event admission and security evidence but is not live acceptance.

Database administration was not retried because no credible changed access path exists after the prior connector and browser failures. No credential, clearance, test, revenue, or approval was invented.

This scheduled execution used only the tools and permissions actually available during this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
