# POD run receipt r269 — publication storage checkpoints

Date: 2026-10-25 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`0e65ffac5aeb2cf93c641d1e266b473005f02460`. Money Factory main was
`25ee31461e831e429ebbb26d4ead6743bde9b913`, including the latest monitor-bot
cadence commit. Current completion, implementation and free-deployment records,
open pull requests, workflow results and the authorized existing Render service
were inspected before changing code. The only open Content Control search match
for POD was draft PR 378, whose scope explicitly excludes POD changes; no open
Money Factory POD PR overlapped this work.

The previously failed database-administration path had no credible access
change, so it was not retried. No network rule, database identity, paid resource
or secret was changed.

## Implemented and merged

[Content Control PR 654](https://github.com/wecreates/content-control/pull/654)
added prompt storage-retention checkpoints to `PodDB.claimPublish`. After each
awaited SQL statement, publication claiming now stops before issuing later
account, queue, quota-reservation or cooldown operations if the configured
storage lifetime has crossed its safety cutoff. The enclosing transaction's
pre-commit check and rollback remain in force.

The four new regressions all failed on the reconstructed main and all passed
after the repair. Focused publishing checks passed 11/11. The complete local POD
Node suite passed 849 tests: 840 passed, nine expected environment-gated skips
and zero failures. Exact PR head
`81025d37bf76fee4396d83c57574391c4cbe53ad` passed:

- integration run
  [40258852611](https://github.com/wecreates/content-control/actions/runs/40258852611),
  job `121366566873`;
- production-container run
  [40258852606](https://github.com/wecreates/content-control/actions/runs/40258852606),
  job `121366567046`.

The base remained `0e65ffac5aeb2cf93c641d1e266b473005f02460`
and GitHub reported a clean merge before the exact tested head was squash-merged
as `476fba222007cf10c399cb6053437d4e54879678`.

Dependent [Money Factory PR 225](https://github.com/wecreates/Money-factory/pull/225)
pinned cross-repository verification to that exact Content Control merge while
retaining explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`013694b5fd31ffa406590c8877b40da903655283` passed run
[40259472284](https://github.com/wecreates/Money-factory/actions/runs/40259472284),
job `121368494870`, including review, evidence, recovery, KDP, rights and adapter
contract stages. Its unchanged base was
`25ee31461e831e429ebbb26d4ead6743bde9b913`; it merged as
`f3be281b0ba86d55abb34b49989758e8e197f961`.

## Deployment evidence and remaining acceptance

Render automatically attempted exact executable merge
`476fba222007cf10c399cb6053437d4e54879678` as deploy
`dep-dbfbmg3bc2fs7391jp00`. Event `evt-dbfbmg4egpmc73c48drg` records the deploy
start, `evt-dbfbmgbphbkc73abab5g` records `pipeline_minutes_exhausted`, and
`evt-dbfbmg84cbqc73dvt9tg` records the failed deploy. The failure occurred before
an application build. No manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This repair is merged code plus hosted
test evidence, not proof of live database retention, a running worker, authorized
marketplace accounts or adapters, real rights/templates/review, actual economics,
measured capacity, publication, revenue or launch readiness. Both publication
flags remain false; Etsy remains excluded. No approval, clearance, provider
result or continuously running self-hosted worker is claimed.
