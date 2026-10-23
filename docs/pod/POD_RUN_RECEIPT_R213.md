# POD run receipt r213 — descriptor-bound package snapshot

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current heads after r212 and read the current completion,
implementation-status and free-deployment documents, open pull requests, workflow
results, and the authorized existing Render service. Content Control started from
`45183791efef5bc80a5743e2e526222fc413a485`; Money Factory started from
`324bafb4a44001e4580af0349e98030d997a6aee`. Open Content Control pull
requests were unrelated to this POD repair; Money Factory had no overlapping open
POD pull request. Database administration was not retried because no credible
access-path change was present.

## Repaired package snapshot boundary

The production worker validated a manifest and later read package artifacts through
separate path-based opens. A same-user path replacement after manifest validation
could therefore make the worker consume a different package directory. The
pre-fix diagnostic reproduced this as `ARTIFACT_HASH_MISMATCH` after validating
the original manifest, replacing the package path, and reading artifacts.

[Content Control PR 523](https://github.com/wecreates/content-control/pull/523)
merged exact tested head `c978b76cc1840030fa1fbd814d667b2ca19ddda3` as
`8d23cef652a3be060a9e3b76cc80d97ab3c2ae55`. The package reader now opens
one verified directory descriptor with `O_NOFOLLOW`, verifies its Linux
`/proc/self/fd` alias identity, and holds that descriptor across manifest
validation, an authority refresh, and every KDP receipt and artifact read. The
worker fails closed with the existing fixed reason vocabulary when that boundary
cannot be established. Its existing authority refresh after the snapshot and the
refresh after durable storage remain intact. Exact changed blobs were:

- `integrations/pod/package-artifacts.mjs`:
  `5579f2da8cb3808769c3e6a06b09aa68457c897e`
- `scripts/pod_production_worker.mjs`:
  `e0ebe4fb1b90f71fef647ff5c9e74cccf124aa9a`
- `tests/pod-artifact-batch.test.mjs`:
  `ef6b9683084c765fbcdb70ca99b8f3856effd198`
- `integrations/pod/PACKAGE_STORAGE.md`:
  `5c01a9417c5ef150826d3338c6a915ccf12b7a2f`
- `integrations/pod/QA_SNAPSHOT.md`:
  `f424cc599687f0bf3e0af194a5914b234f683b9f`

## Verification evidence

The final focused local package, worker, lease, QA-process, task restoration,
template-production and failure-vocabulary matrix passed 152/152. Syntax checks
for the package reader, worker and regression test passed. Workflow-control
verification passed with publication disabled, and `git diff --check` passed.

Both exact-head Content Control workflows passed:

- integration run `39999948139`, job `120573133004`, passed Node, Python/OpenCV,
  PostgreSQL, production E2E and workflow-control stages;
- container run `39999948130`, job `120573132641`, built the production image
  and passed non-root dependency, Python QA/rendering, Node/PostgreSQL, real
  print/review and publication-disabled startup stages.

Dependent [Money Factory PR 167](https://github.com/wecreates/Money-factory/pull/167)
pinned verification to Content Control
`8d23cef652a3be060a9e3b76cc80d97ab3c2ae55` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `8a607f4a943a1be1e87c0b85f93bc2d1c0b35a9a` merged as
`349a34fafa6f90bbaeb6f44100888e0a22f58688`. Cross-repository run
`40000995085`, job `120576707924`, passed every selected Content Control and
Money Factory bridge, review, recovery, rights, KDP, editorial and adapter-contract
stage, including the aggregate Node and Python suites and clean container teardown.
The changed workflow blob was
`3d89b6bb7505b29f593bd744d312cfdbae6b56bf`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact Content Control merge as deploy
`dep-dbdq5fuq1p3s73eu22q0`. Deploy-start event
`evt-dbdq5fubv0ns73bo4s6g` bound
`8d23cef652a3be060a9e3b76cc80d97ab3c2ae55` at
2026-10-23T18:09:03.910580Z. Event `evt-dbdq5fs7hfos73dj8sd0` reported
`pipeline_minutes_exhausted` at 18:09:03.976055Z, and event
`evt-dbdq5g0se3cs73f2475g` recorded the failed deploy at
18:09:04.363312Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs the package-read
snapshot boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false. Etsy remains
excluded. No approval, clearance, revenue, publication, successful deployment or
continuously running self-hosted worker is claimed.
