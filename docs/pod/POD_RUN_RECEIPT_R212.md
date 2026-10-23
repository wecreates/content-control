# POD run receipt r212 — workspace cleanup outcome preservation

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current heads after r211 and read the current completion,
implementation-status and free-deployment documents, open pull requests, workflow
results, and the authorized existing Render service. Content Control started from
`0413f767ce00d41c9f4063301833db479bebbedf`; Money Factory started from
`dcef4157481294cd84c5773ef22e913ee35783d5`. Open Content Control PRs 378
and 517 were unrelated to this POD repair; Money Factory had no open POD PR.
Database administration was not retried because no credible access-path change was
present.

## Repaired production lifecycle

A rejected disposable-workspace cleanup ran from the production worker's
`finally` block. It could replace an already persisted BLOCKED,
REVIEW_REQUIRED, QA_PASSED or QA_FAILED result with a generic rejected worker
cycle. That erased the stable `last_result` health signal and hid the cleanup
failure behind `POD_WORKER_CYCLE_FAILED`.

[Content Control PR 519](https://github.com/wecreates/content-control/pull/519)
merged exact tested head `d5fc8eb3bce06df56a37ab5cc32ce8ab7092bab3` as
`6e47fe57b3a63d913befb6eb81b72141dc859e02`. The worker now retains the
persisted result, adds only `cleanup_failed: true`, reports fixed runtime code
`POD_WORKSPACE_CLEANUP_FAILED`, preserves `last_result`, and never exposes
cleanup error details. If result persistence itself failed first, that primary
exception remains authoritative. Exact changed blobs were:

- `integrations/pod/production-runtime.mjs`:
  `9bca96494b8b5224d01cae00e2093cd705c0068e`
- `scripts/pod_production_worker.mjs`:
  `78cac61c3797641643aad371855eb0e5f8e9540f`
- `tests/pod-worker.test.mjs`:
  `643b42ca73529dde386bec810a05e93b84fcc147`

## Verification evidence

The focused local worker, failure-vocabulary, task-restoration and KDP production
matrix passed 103/103. Workflow-control verification passed with publication
disabled, and `git diff --check` passed.

Both exact-head Content Control workflows passed:

- integration run `39993402114`, job `120550631894`, passed the full
  Node/PostgreSQL gate, aggregate Python gate, real production E2E, server syntax,
  workflow-control and free-review guards;
- container run `39993402134`, job `120550631700`, built the production image
  and passed non-root dependencies, aggregate Python, Node/PostgreSQL, real
  print/durable-review, and publication-disabled startup checks.

Dependent [Money Factory PR 166](https://github.com/wecreates/Money-factory/pull/166)
pinned verification to Content Control
`6e47fe57b3a63d913befb6eb81b72141dc859e02` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `82bacfe0eed20ce52af369c805ea75a3842df67e` merged as
`324bafb4a44001e4580af0349e98030d997a6aee`. Cross-repository run
`39994356395`, job `120553894679`, passed every selected Content Control and
Money Factory bridge, review, recovery, rights, KDP and adapter-contract stage.
The changed workflow blob was
`3256f373257538d5065ef943385b603c888a54a3`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact Content Control merge as deploy
`dep-dbdpeouk1f9s73ecu2l0`. Deploy-start event
`evt-dbdpeoubv0ns73bndiag` bound
`6e47fe57b3a63d913befb6eb81b72141dc859e02` at
2026-10-23T17:20:35.638174Z. Event `evt-dbdpeoqqqsrs73d4a0c0` reported
`pipeline_minutes_exhausted` at 17:20:35.617842Z, and event
`evt-dbdpep0se3cs73f1dr60` recorded the failed deploy at
17:20:36.008641Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs worker lifecycle
and monitoring behavior only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false. Etsy remains
excluded. No approval, clearance, revenue, publication, successful deployment or
continuously running self-hosted worker is claimed.
