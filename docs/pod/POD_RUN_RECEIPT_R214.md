# POD run receipt r214 — descriptor-bound task workspace

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current repository heads after r213 and read the current
completion, implementation-status and free-deployment documents, open pull
requests, workflow results, and the authorized existing Render service. Content
Control started from
`966ba46031ff8094d93da7ff4ba29fe859d52754`; Money Factory started from
`349a34fafa6f90bbaeb6f44100888e0a22f58688`. No open pull request
overlapped this repair. Database administration was not retried because no
credible access-path change was present.

## Repaired task-workspace boundary

The stored task resolver opened a private workspace, but restored inputs and
returned stage paths used the replaceable pathname. A same-user rename followed
by replacement at the first write redirected restored bytes into the replacement
directory and stranded the originally opened directory. The pre-fix diagnostic
reproduced that redirect while confirming both directories existed.

[Content Control PR 525](https://github.com/wecreates/content-control/pull/525)
merged exact tested head
`33f37de894be99a0528b39230215afdb65aaefc5` as
`c5b650fa5f4ed93878563d829901f1f428a2575c`. The stored resolver now
opens and verifies one Linux directory descriptor, restores every input through
its `/proc/self/fd` alias, and returns only descriptor-rooted task paths. Every
bounded Python production stage receives that held descriptor as child fd 3 and
uses rewritten `/proc/self/fd/3` arguments. Replacing the temporary pathname
therefore cannot redirect restored inputs or stage outputs. Malformed or missing
descriptor boundaries fail closed with fixed reason codes. Cleanup retains the
descriptor until stages and reviewers settle and still preserves a replacement
pathname. Exact changed blobs were:

- `integrations/pod/TASK_INPUTS.md`:
  `c163b5593691b151e991463700d505715cce4fdc`
- `integrations/pod/failure-reasons.mjs`:
  `b66e045768ba10635e795ce5e1948fa1a1b51ec7`
- `integrations/pod/python-stage.mjs`:
  `5b6b37eacf2792432bd2a134d67c7bd58ce36d00`
- `integrations/pod/task-resolver.mjs`:
  `463a8d8a1721da02760c1bfd4d68cb4ab722f25c`
- `scripts/pod_production_worker.mjs`:
  `55d88c4f8d6e888d6fd3757663ce06747f3f5fef`
- `tests/pod-python-stage.test.mjs`:
  `8a1f5735bcc3c3b30ef52d821beb4e1c9d2485f1`
- `tests/pod-task-resolver.test.mjs`:
  `10a4009559734bf67033b75088c99984fd289eb0`

## Verification evidence

The final focused local resolver, Python-stage, template-production, artifact,
worker, lease, QA-process and failure-vocabulary matrix passed 164/164. The
complete local POD Node suite passed 690 tests with nine environment-gated skips
and zero failures. Changed-module syntax checks, workflow-control verification
and `git diff --check` passed; workflow control confirmed both publication flags
remained false.

Both exact-head Content Control workflows passed:

- integration run `40006347222`, job `120595119511`, passed the complete
  Node and Python suites, PostgreSQL production E2E, server syntax,
  workflow-control and free-review guards;
- container run `40006347242`, job `120595119310`, built the production
  image and passed non-root dependency, Python QA/rendering, Node/PostgreSQL,
  real print/review and publication-disabled startup stages.

Dependent [Money Factory PR 168](https://github.com/wecreates/Money-factory/pull/168)
pinned verification to Content Control
`c5b650fa5f4ed93878563d829901f1f428a2575c` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `99bd541f310903d30fb7f67072be86d723607b3f` merged as
`5e63d28a900ca6f31c37236b6537cb9dccdd71ee`. Cross-repository run
`40008510795`, job `120602504694`, passed every selected bridge, review,
recovery, evidence, KDP/editorial and integration stage. The changed workflow
blob was `56b116eb00e5a3671655bdb6c230ceec31001a9d`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact application merge as deploy
`dep-dbdquvgu01pc73dqj7jg`. Deploy-start event
`evt-dbdquvk7hfos73dk21g0` bound
`c5b650fa5f4ed93878563d829901f1f428a2575c` at
2026-10-23T19:03:26.833422Z. Event
`evt-dbdquvm4uq4c739gla0g` reported
`pipeline_minutes_exhausted` at 19:03:26.829314Z, and event
`evt-dbdquvu4uq4c739gla30` recorded the failed deploy at
19:03:27.289388Z. No application build ran.

A concurrent watchdog commit advanced Content Control main to
`5c4f7ba92989bc530488af76aca90f53a1af4e1a` after the application merge.
Render attempted it as `dep-dbdr026q1p3s73evcb40` and rejected it for the same
pipeline-minutes condition before build. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs the task-workspace
snapshot boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false. Etsy remains
excluded. No approval, clearance, revenue, publication, successful deployment or
continuously running self-hosted worker is claimed.
