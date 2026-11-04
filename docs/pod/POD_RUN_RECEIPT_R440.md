# POD run R440 evidence

Date: 2026-11-03 (America/Los_Angeles)

## Reconciled and preserved state

- Starting Money Factory main: `b03d2306ddb105a72255482519f6034a2d4c245e`, including the concurrent free-monitor cadence tick.
- Starting Content Control main: `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179`, including the concurrent zero-credit QA proof and accepted-candidate ledger updates.
- No open Money Factory POD pull request existed before this repair. Content Control PR 378 is an unrelated draft OpenFilm candidate and was not changed.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory's exported opaque-text authority validator destructured caller-owned length options before validation. Proxy, accessor, and inherited `maxLength` evidence could therefore execute while checking grant and economic identity fields. An object-valued bound could also execute its coercion hook during comparison, while nonfinite, fractional, negative, unsafe, or nonnumeric bounds were not rejected canonically.

Four expected-red cases reproduced the executable or inherited option behavior before the repair. Each returned an accepted identity after invoking a caller-controlled read or coercion instead of failing closed.

The validator now accepts only an ordinary or null-prototype options object, reads `maxLength` only from an own data descriptor, and requires a nonnegative safe integer before comparing text. Proxy, accessor, custom-prototype, coercible, noncanonical, and invalid primitive bounds return `false` without invocation. Grant and economics array checks now pass only the identity value instead of accidentally passing the `Array.every` callback index as validator options. Default and explicit inert bounds, exact Unicode identity, economics, grant scoping, and publication safeguards remain unchanged.

## Verification and promotion

- Final focused identity/grant/economics matrix: 26 passed, 0 failed.
- Complete local paired POD Node suite: 199 total, 198 passed, 1 PostgreSQL-only skipped, 0 failed.
- Complete local paired POD Python suite: 81 passed, 0 failed.
- Syntax and `git diff --check`: passed.
- Money Factory PR 395 exact head: `87b2dcff7d6dd6c1076510851c6a43083229df7a`.
- Cross-repository workflow run 41767998947, job 126370816562 (`review-production`): completed successfully. Every setup, pinned contract, evidence, recovery, KDP QA, Node, Python, cleanup, and completion step succeeded. Hosted results included 825 pinned Content Control contract tests, all 199 Money Factory Node/PostgreSQL tests, and all 81 Python tests.
- Squash merge: `c56be9980489385c3805dbdabe5b4290aa7b2b81`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) is an unsuspended free Docker web service on Content Control `main`, with one instance, automatic commit deploys enabled, and liveness path `/health`.

Concurrent deploy `dep-dblaboepbehc73ctnjm0` reached `live` on exact Content Control revision `8e4e5ddd0dc32439ac043e9ba648e6bae16a3179` at 2026-11-03 19:28:42 America/Los_Angeles. It includes the accepted-candidate ledger and zero-credit QA evidence updates that landed before this run branched. This R440 receipt is documentation-only and must not trigger another deployment. Process liveness is not proof of `/readyz`, database, marketplace, or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens Money Factory authority identity evidence but is not live acceptance.

Database administration was not retried because no credible changed access path exists after the prior connector and browser failures. No credential, clearance, test, revenue, or approval was invented.

This scheduled execution used only the tools and permissions actually available during this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
