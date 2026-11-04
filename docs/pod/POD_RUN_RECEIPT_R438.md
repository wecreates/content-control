# POD run R438 evidence

Date: 2026-11-04 (UTC)

## Reconciled and preserved state

- Starting Money Factory main: `9e98c4aa0a39939459e99240f9396aca6309137d`.
- Starting Content Control main: `96bab8f38ce7150e48e23681609ba0a059dac02e`.
- No open Money Factory POD pull request existed before this repair. Content Control PR 378 is an unrelated draft OpenFilm candidate and was not changed.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory's exported authority and event-handler constructors destructured caller-owned configuration before validation. A configuration Proxy or an accessor for the snapshot loader, database pool, transport/signing keys, clock or timeout controls could therefore execute during construction. Values inherited through an arbitrary prototype were also trusted as credentials or capabilities.

Fourteen expected-red cases reproduced the defect: two configuration Proxies, ten named accessors across both constructors and two inherited configurations. All reached implicit property reads or were accepted before the repair.

Both constructors now use one shared configuration snapshot that accepts only named own data descriptors from an inert ordinary or null-prototype object. Executable and inherited configuration fails closed as `AUTHORITY_CONFIG_INVALID` or `EVENT_HANDLER_CONFIG_INVALID` with zero trap/getter reads. Missing optional clock and timeout values retain the existing defaults. Snapshot admission, authority authentication, event signatures, database capability verification and request/connection deadlines are otherwise unchanged.

## Verification and promotion

- Final focused authority/event handler matrix: 50 passed, 0 failed.
- Complete local paired POD Node suite: 186 total, 185 passed, 1 PostgreSQL-only skipped, 0 failed.
- Local POD Python suite: 81 passed, 0 failed.
- Syntax and `git diff --check`: passed.
- Money Factory PR 393 exact head: `06332d8e85004f1f6c7708d109c1ebaa6f8ccf60`.
- Cross-repository workflow run 41754774895, job 126328196090 (`review-production`): completed successfully. Every setup, contract, evidence, recovery, KDP QA, Node, Python, cleanup and completion step succeeded. The exact-head CI Node suite passed all 186 tests, including the PostgreSQL bridge, and the Python suite passed all 81 tests.
- Squash merge: `219986380b3fec7bab51a1a1c7b3a551dc4dd5b0`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains an unsuspended free Docker web service on Content Control `main`, with one instance, automatic commit deploys enabled and liveness path `/health`.

Deploy `dep-dbl75bqbg0es73a043lg` remains `live` on exact runtime-bearing Content Control revision `1bf4be7d2ba457318fa864a6d6c07db7703c2ad4`; it started at 2026-11-03T23:48:52.369636Z and finished at 2026-11-03T23:49:51.561789Z. Content Control main is ahead only through documentation receipts marked `[skip render]`. This R438 receipt is also documentation-only and must not trigger another deployment. Process liveness is not proof of `/readyz`, database, marketplace or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens Money Factory authority/event construction and security evidence but is not live acceptance.

Database administration was not retried because no credible changed access path exists after the prior connector and browser failures. No credential, clearance, test, revenue or approval was invented.

This scheduled execution used only the tools and permissions actually available during this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
