# POD run receipt R494

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The run repaired one unblocked request-cancellation defect, merged the exact passing
implementation and consumer pin, and verified the free Render deployment. This is
implementation and deployment evidence, not live marketplace acceptance: all 24
acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory.
The run did not enable publication, purchase resources, contact a third party,
access a social vault, evade a safeguard, widen network access, or claim credentials,
marketplace clearance, tests, revenue, or approvals that were not observed.

## Reconciled starting heads and concurrent work

- Content Control started at
  `93b20fe463742ec9fcbf5df35da5c1395855cc57`.
- Money Factory started at
  `2d8519032f2e1441cf60e0eb783d5af323694ecd`.
- While the repair branch was being prepared, Content Control `main` advanced to
  report-only commit `7e75b300c1e70b84ea31723a5d37764590357f93`. The repair branch
  was rebuilt on that current head before its pull request was opened, preserving
  the concurrent work.
- Open pull requests, workflow results and current remote heads were inspected before
  branches were created and again before each merge. No open R494 POD/KDP pull
  request or duplicate job existed. Unrelated open work was left untouched and Etsy
  pull requests remained outside this lane.

## Confirmed defect and repair

Authenticated owner repair-retry and QA-review mutations did not receive the
request's cancellation/deadline signal. A disconnected request could therefore
leave its database mutation running. Two regression tests were added first. Against
the pre-repair implementation, the repair retry received no `AbortSignal` and review
acceptance received no `AbortSignal`; the focused run reported 27 passes and those
two failures.

The repair now:

- creates the existing request lifecycle for owner `POST /jobs/:id/retry` and
  `POST /jobs/:id/review` operations;
- forwards the request signal through `requeueRepair` and `acceptReview` into the
  existing rollback-capable transaction helper;
- enforces the existing request deadline before mutation; and
- disposes cancellation listeners after each operation.

The affected focused suites then passed 68/68.

## Content Control verification and merge

Local evidence:

- complete Node POD suite: 1,177 tests; 1,168 passed, nine expected skips and zero
  failures;
- complete Python POD suite: 385 passed; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1105](https://github.com/wecreates/content-control/pull/1105) used immutable head
`e528cc10c2d3337d3874b070e78648c270800406`. Its remote tree
`4610a7d5eb6e8fbc6ea1bc69670b1c97159f52b5` preserved the concurrent report and
contained the exact locally tested implementation and test blobs. Hosted POD
integration run `42194327471`, job `127814093162`, and container run
`42194327355`, job `127814094777`, both passed. The PR merged as
`04f1daadc22d2ae55d7b1aae06ec3a41919af07d`.

## Money Factory authority pin

The Money Factory production workflow now pins the exact Content Control merge
above. The one-line pin retained both publication flags as literal `false`. Local
dependent evidence passed:

- Money Factory Node bridge: 279 tests; 278 passed, one expected PostgreSQL skip;
- Money Factory Python bridge: 81 passed; and
- `git diff --check`.

Money Factory PR
[#449](https://github.com/wecreates/Money-factory/pull/449) used immutable head
`2e3dddbb78db7b75d7b3f3872d3d86fd9ad1d898`. Its remote tree
`848805df77b34a6a74c14889f32283b5a9344791` contained the exact tested workflow
blob. Hosted cross-repository run `42195423666`, job `127817384628`, passed. The
PR merged as `e8c8f02c8fac6fd3cf01ede4cf36bc441d53b3ea`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No manual
or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`04f1daadc22d2ae55d7b1aae06ec3a41919af07d` as live deploy
`dep-dbmprd0n74is73bbc210`. Build-started event
`evt-dbmprdfbf4ts7387dqcg`, successful build-ended event
`evt-dbmprk3fnrrc73a1as6g`, deploy-started event
`evt-dbmprd7bf4ts7387dq60` and successful deploy-ended event
`evt-dbmprunrkulc73el3u40` bind that exact revision.

Fresh public probes observed:

- `/health`: `alive=true`, `production_approved=false`, `publication=false`;
- `/livez`: `alive=true`, `production_approved=false`, `publication=false`;
- `/readyz`: `ok=false`, `production_approved=false`, `publication=false`,
  `qaStatus=GREEN`, `hashBound=true`, exact expected and actual SHA-256
  `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`,
  `captionReady=false`, and `renderStatus=v2-validation-complete`; and
- `/api/print/status`: `status=DISABLED`, `production_status=DISABLED`,
  `publication_enabled=false`, `publication_requested=false`, and
  `adapters_verified=false`.

The live process therefore continues to fail closed for readiness and publication.
These probes do not establish marketplace, editorial, rights, account, adapter or
launch acceptance.

## Database administration and execution limits

The prior database-administration attempts through the connector and browser had
failed, and no credible changed database administration access path appeared in
R494. The run therefore did not repeat the unchanged failed action. Existing code,
unit tests and a live web process are not substitutes for current restricted-role
preflight, independent backup/restore evidence or live authority configuration.

The connected local browser was unavailable to this scheduled run. The public
probes above were completed with the available cloud browser and required no login.
This receipt describes one bounded scheduled execution with the tools and
permissions actually available to it. It does not claim a continuously running
self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. Live
database/storage durability, current external grants and account records,
authorized intelligence, regional-rights evidence, official template provenance,
substantive KDP editorial/preview acceptance, independent QA/remediation,
authorized adapters for all five in-scope marketplaces, real economics and
financial reconciliation, measured capacity, end-to-end acceptance and controlled
launch remain unverified. Publication remains held for explicit owner approval,
and this automation cannot enable it.

The continuation automation therefore remains enabled.
