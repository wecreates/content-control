# POD run R439 evidence

Date: 2026-11-03 (America/Los_Angeles)

## Reconciled and preserved state

- Starting Money Factory main: `219986380b3fec7bab51a1a1c7b3a551dc4dd5b0`.
- Starting Content Control main: `367b51ef72071334e6eebbc27c8da5620bb85f62`.
- No open Money Factory POD pull request existed before this repair. Content Control PR 378 is an unrelated draft OpenFilm candidate and was not changed.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory accepted Proxy-wrapped callable capabilities at its exported POD authority and event boundaries. A proxied snapshot loader could evade the shared loader-capacity identity by wrapping one target in multiple Proxy objects. Proxied PostgreSQL `connect`, `query`, and `release` methods also reached their executable traps while the inbox bound or called them. Proxied authority and event clocks were accepted and invoked.

Seven expected-red cases reproduced the behavior before the repair: proxied authority loader and clock, event-handler clock, pool connect method, client query and release methods, and direct inbox clock. The cases proved the capabilities were admitted or invoked instead of failing closed.

The authority handler, event handler, and event inbox now reject callable Proxies before reading a function property or invoking a get/apply trap. Ordinary functions, handler defaults, timeout and connection admission, signatures, database transaction cleanup, and acknowledgement semantics are unchanged.

## Verification and promotion

- Final focused authority/capability/clock/HTTP matrix: 80 passed, 0 failed.
- Complete local paired POD Node suite: 193 total, 192 passed, 1 PostgreSQL-only skipped, 0 failed.
- Complete local paired POD Python suite: 81 passed, 0 failed.
- The first broad local attempt lacked `CONTENT_CONTROL_ROOT` for three cross-repository Node cases and ran Python concurrently, causing two short subprocess timeouts. The required checkout was then supplied and the suites were rerun sequentially. One lifecycle scheduling miss on the first Python rerun passed focused and again in the complete 81-test rerun. These initial environment/timing failures are not counted as passing evidence.
- Syntax and `git diff --check`: passed.
- Money Factory PR 394 exact head: `265dcf39983fc696c527c9c9cdc1f8b76cf55c90`.
- Cross-repository workflow run 41763675564, job 126356945080 (`review-production`): completed successfully. Every setup, pinned contract, evidence, recovery, KDP QA, Node, Python, cleanup, and completion step succeeded. Hosted results included 825 pinned Content Control contract tests, all 193 Money Factory Node/PostgreSQL tests, and all 81 Python tests.
- Squash merge: `a1b9a76268ebc090fe6339c3290f4ac319509439`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains an unsuspended free Docker web service on Content Control `main`, with one instance, automatic commit deploys enabled and liveness path `/health`.

Deploy `dep-dbl75bqbg0es73a043lg` remains `live` on exact runtime-bearing Content Control revision `1bf4be7d2ba457318fa864a6d6c07db7703c2ad4`. Content Control main is ahead only through documentation receipts marked `[skip render]`. This R439 receipt is also documentation-only and must not trigger another deployment. Process liveness is not proof of `/readyz`, database, marketplace, or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens Money Factory authority/event capability evidence but is not live acceptance.

Database administration was not retried because no credible changed access path exists after the prior connector and browser failures. No credential, clearance, test, revenue, or approval was invented.

This scheduled execution used only the tools and permissions actually available during this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
