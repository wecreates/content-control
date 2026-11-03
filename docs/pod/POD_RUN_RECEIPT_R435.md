# POD run R435 evidence

Date: 2026-11-03 (UTC)

## Reconciled starting state

- Content Control main: `f6de98139e54aa9d21ae3798732b5563353324e7`.
- Money Factory main: `10b280e95b22246265d5fa7cc0087f31aee2f5e7`.
- No open Money Factory POD pull request existed. Content Control PR 378 is an unrelated draft OpenFilm candidate and was left unchanged.
- Etsy is outside this lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; no marketplace was contacted.

## Highest-priority unblocked repair

Money Factory's exported `enforceReleaseEconomics` authority read its direct caller's price, economic, source-ID, and job evidence before proving that graph inert. Executable Proxy or accessor-backed evidence could therefore run inside the authority boundary even though the grant path had already copied its enclosing snapshot.

Five expected-red cases reproduced the defect: an input Proxy, a price accessor, an economics Proxy, a job Proxy, and a source-evidence array accessor. All five were accepted and invoked before the repair.

The authority now copies the complete direct-call input, job, and clock through the shared bounded descriptor-only authority verifier before reading any supplied field. Existing economics, scope, expiry, contribution, margin, and grant semantics remain unchanged. The five cases now fail closed with `AUTHORITY_SNAPSHOT_UNVERIFIED` and zero trap/getter reads.

## Verification and promotion

- Focused economics, grant, and signer matrix: 33 passed, 0 failed.
- Full paired POD Node suite: 159 total, 158 passed, 1 PostgreSQL-only skipped, 0 failed.
- POD Python suite: 81 passed, 0 failed.
- Syntax and `git diff --check`: passed.
- Money Factory PR 390 exact head: `03613c57f9c4b15210774310c0374d64102f5bac`.
- Cross-repository workflow run 41737730153, job 126271156905 (`review-production`): completed successfully. Every recorded setup, pinned contract, evidence, recovery, KDP QA, Node, Python, cleanup, and completion step succeeded.
- Squash merge: `cd97c7f568fb3711541b35a9672e278b2b10a7c9`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained an unsuspended free Docker web service on `main`, with one instance, automatic commit deploys enabled, and liveness path `/health`.

Latest deploy `dep-dbl44tebk0kc73fqgbbg` remained `live` on functional Content Control commit `ef840a948ae1678726c70a62a614f5fe5413c485`. It started at 2026-11-03T20:23:40.647895Z and finished at 2026-11-03T20:25:15.825555Z. This receipt is documentation-only and uses `[skip render]`; it must not trigger a redundant deploy. Service liveness is not proof of `/readyz`, database, marketplace, or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative and all 24 acceptance areas remain open. The canonical review remains unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. This repair strengthens Money Factory authority, economics, and security evidence but is not live acceptance.

Database administration was not retried because there is no credible changed access path after the prior connector and browser failures. No credential, clearance, test, revenue, or approval was invented.

This scheduled execution used only the tools and permissions actually available in this run; it is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
