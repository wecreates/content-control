# POD run R434 evidence

Date: 2026-11-03 (UTC)

## Scope and preserved state

- Starting Content Control head: `5b90895de4e1596acdde7ac589f1cc24a49056f8` (`Update live Render deployment health [skip render]`).
- Starting Money Factory head: `035576e748f8a850ba39456ec45e1d29275bd3e3`.
- The concurrent Content Control deployment-health commit was read and preserved. This receipt changes documentation only and uses `[skip render]`.
- Etsy is outside this POD lane.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained `false`; this run did not enable publication or contact a marketplace.

## Highest-priority unblocked repair

The exported Money Factory grant-envelope signer could inspect and serialize caller-provided payloads without first proving the evidence graph inert. A Proxy, accessor, nested executable property, or `toJSON` hook could therefore execute inside signing.

Expected-red coverage proved five previously accepted executable shapes: a payload Proxy, a schema accessor, a nested `verified_facts` Proxy, a nested field accessor, and a `toJSON` accessor. Each case now fails closed with `AUTHORITY_SNAPSHOT_UNVERIFIED` before any trap or getter read.

The repair moved the bounded descriptor-only authority copier into a shared neutral module, used strict verified copying for the grant envelope, retained the handler and direct-grant protections, and explicitly omitted an absent optional package hash instead of passing `undefined` into the strict copier.

## Verification and promotion

- Focused authority/signing matrix: 71 passed, 0 failed.
- Full POD integration suite with paired Content Control root: 154 total, 153 passed, 1 PostgreSQL-only skipped, 0 failed.
- Syntax checks and `git diff --check`: passed.
- Money Factory PR 389 exact head: `1e07fff1aa07eca7e375c41fe0dbb5804e96776a`.
- Exact-head workflow run 41728339857, job 126238879614 (`review-production`): completed successfully; every recorded step succeeded, including pinned contracts, bounded evidence, recovery, KDP QA, the full Node suite, and the Python suite.
- Squash merge: `10b280e95b22246265d5fa7cc0087f31aee2f5e7`.
- The merged `.github/workflows/pod-production.yml` still contains literal `PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Live deployment observation

Authorized Render workspace `tea-darsafojo6nc739844hg`, service `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) was observed as an unsuspended free Docker web service on `main`, one instance, automatic commit deploys enabled, and health-check path `/health`.

Latest deploy `dep-dbl44tebk0kc73fqgbbg` remained `live` on functional Content Control commit `ef840a948ae1678726c70a62a614f5fe5413c485`; it started at 2026-11-03T20:23:40.647895Z and finished at 2026-11-03T20:25:15.825555Z. Later Content Control evidence commits are marked `[skip render]`, so no redundant deploy was triggered by this receipt. This service observation is not proof of `/readyz`, database, marketplace, or end-to-end acceptance.

## Acceptance state and limitations

The current `POD_COMPLETION_CHECKLIST.md` remains authoritative: all 24 acceptance areas remain open. The canonical review is still unaccepted, `/readyz` is not independently verified green, and saved deployment health remains fail-closed. The new code and green CI improve Money Factory authority and security evidence but do not by themselves prove live acceptance.

Database administration was not retried because no credible changed access path was available after the prior connector and browser failures. No database credential or clearance was invented.

This scheduled run used only the tools and permissions actually available during this execution. It is not evidence of a continuously running self-hosted worker. The automation remains enabled because the 24-area completion gate has not been met.
