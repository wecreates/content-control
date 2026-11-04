# POD run R437 evidence

Date: 2026-11-04 (UTC)

## Reconciled and preserved state

- Starting Money Factory main: `b0cbd79dd957efa30c2f1cba1f3672a30e251232`.
- Starting Content Control main: `68371c404ffdaaf68ba4c3f982533e74f7592a34`.
- No open Money Factory POD pull request existed before this repair. Content Control PR 378 is an unrelated draft OpenFilm candidate and was not changed.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory's exported `assertEventStorageText` traversed direct caller values with `Object.entries` and array iteration. Proxies, accessors and custom iterators could therefore execute before event storage validation rejected the value. Sparse arrays, inherited object state and symbol-keyed evidence were also silently omitted from validation. The authenticated HTTP path normally supplies parsed JSON, but the exported durable-storage boundary still needs to fail closed for direct callers and future reuse.

Six expected-red cases reproduced the defect: root and nested proxies, object and array accessors, a custom array iterator, and ambiguous container shapes. All were accepted or invoked caller-controlled behavior before the repair.

The storage validator now accepts only bounded plain JSON graphs proven through own data descriptors. It rejects proxies, accessors, inherited/symbolic/sparse/custom containers, cycles, non-finite numbers, depth beyond 64 and more than 8,192 objects without invoking caller code. Valid shared evidence remains accepted. UTF-16 text validation no longer dispatches an iterator and still rejects NUL and unpaired surrogates without normalizing signed content.

## Verification and promotion

- Final focused event-storage matrix: 15 passed, 0 failed.
- Local paired POD Node suite before the final bounded-graph case: 169 passed, 1 PostgreSQL-only skipped, 0 failed.
- Local POD Python suite: 81 passed, 0 failed.
- Syntax and `git diff --check`: passed.
- Money Factory PR 392 exact head: `01433433106fd7c2bd3eb979d0651e5270157819`.
- Workflow run 41748170809 first job 126306316241 failed before checkout because the GitHub-hosted runner timed out starting Docker's port-forwarding proxy for the disposable PostgreSQL container. Every repository setup and test step was skipped; this was not represented as a code result.
- The failed job alone was retried on the unchanged exact head. Retry job 126308864817 (`review-production`) completed successfully: all setup, contract, evidence, recovery, KDP QA, Node, Python, cleanup and completion steps succeeded. The exact-head CI Node suite passed all 171 tests, including the PostgreSQL bridge, and the Python suite passed all 81 tests.
- Squash merge: `9e98c4aa0a39939459e99240f9396aca6309137d`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remains an unsuspended free Docker web service on Content Control `main`, with one instance, automatic commit deploys enabled, and liveness path `/health`.

Deploy `dep-dbl75bqbg0es73a043lg` remains `live` on exact runtime-bearing Content Control revision `1bf4be7d2ba457318fa864a6d6c07db7703c2ad4`; it started at 2026-11-03T23:48:52.369636Z and finished at 2026-11-03T23:49:51.561789Z. Content Control main is `68371c404ffdaaf68ba4c3f982533e74f7592a34` only because the R436 evidence receipt followed that runtime revision with `[skip render]`. This R437 documentation-only receipt also uses `[skip render]` and must not trigger a deployment. Process liveness is not proof of `/readyz`, database, marketplace or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens durable event-storage and security evidence but is not live acceptance.

Database administration was not retried because no credible changed access path exists after the prior connector and browser failures. No credential, clearance, test, revenue or approval was invented.

This scheduled execution used only the tools and permissions actually available during this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
