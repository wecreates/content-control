# POD run receipt R495

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The run repaired the remaining authenticated request-cancellation gaps, merged the
exact passing implementation and consumer pin, and verified the free Render
deployment. This is implementation and deployment evidence, not live marketplace
acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory.
The run did not enable publication, purchase resources, contact a third party,
access a social vault, evade a safeguard, widen network access, or claim credentials,
marketplace clearance, tests, revenue, or approvals that were not observed.

## Reconciled starting heads and concurrent work

- Content Control started at
  `1c399cfed44495d1be07093191a70d277a6d34d9`.
- Money Factory started at
  `e8c8f02c8fac6fd3cf01ede4cf36bc441d53b3ea`.
- Open pull requests, workflow results and current remote heads were inspected before
  branches were created and again before each merge. No open R495 POD/KDP pull
  request or duplicate job existed. Neither main branch moved during the functional
  pull requests. Unrelated open work was left untouched and Etsy pull requests
  remained outside this lane.

## Confirmed defect and repair

The earlier request lifecycle covered authenticated reads, repair retry and review
acceptance, but six remaining mutations did not receive its cancellation/deadline
signal. A disconnected client could therefore leave an artifact upload, market
observation, provider listing readback, financial event, concept intake or job
enqueue database transaction running.

Six regression tests were added first. Against the pre-repair implementation, the
operations run reported 29 passes and exactly those six failures because none
received a native `AbortSignal`.

The repair now:

- establishes the same bounded request lifecycle for every remaining authenticated
  mutation route;
- forwards its native signal through artifact storage, market intake, listing
  reconciliation, finance intake, concept admission and queue admission;
- passes that signal into the existing rollback-capable transaction helper; and
- checks the fixed request deadline before returning a success response and always
  removes the request listeners.

The operations suite then passed 35/35. A focused 195-test set covering all affected
boundaries also passed.

## Content Control verification and merge

Local evidence:

- complete Node POD suite: 1,183 tests; 1,174 passed, nine expected skips and zero
  failures;
- complete Python POD suite: 385 passed; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1108](https://github.com/wecreates/content-control/pull/1108) used immutable head
`3623c05af616b484bfa19b0dfaa0342b54c87c42`. Its remote tree
`7179d58b52a94b49e0a0bda0c9023e30b071ec89` exactly matched the locally tested
tree. Hosted POD integration run `42198975012`, job `127829246187`, and container
run `42198975073`, job `127829246306`, both passed. The container gate included
the production image, non-root dependencies, Python QA/rendering, Node/PostgreSQL,
real print/review and disabled-startup stages. The PR merged as
`61ec9e5bddabcbc8b007e953443a27459836a2c3`.

## Money Factory authority pin

The Money Factory production workflow now pins the exact Content Control merge
above. The one-line pin retained both publication flags as literal `false`. Local
dependent evidence passed when supplied the exact paired Content Control worktree:

- Money Factory Node bridge: 279 tests; 278 passed, one expected PostgreSQL skip;
- Money Factory Python bridge: 81 passed, with five expected environment skips; and
- `git diff --check`.

The first local Node invocation omitted the required `CONTENT_CONTROL_ROOT`; its
three paired-contract cases stopped with `CONTENT_CONTROL_ROOT_REQUIRED`. They all
passed when rerun with the exact tested Content Control root, so the failed command
is not counted as product acceptance.

Money Factory PR
[#450](https://github.com/wecreates/Money-factory/pull/450) used immutable head
`b672d6b028a3d4fd96765b0359119c6fbc76d7b9`. Its remote tree
`917bfbb6bd1259177dbcb77a23aa3ed31f187b39` contained the exact tested workflow
blob. Hosted cross-repository run `42200112008`, job `127833009374`, passed every
pinned, evidence, recovery, rights, KDP editorial and bridge stage. The PR merged as
`bbd6972e6fff007a302787f5f046546994605658`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No manual
or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`61ec9e5bddabcbc8b007e953443a27459836a2c3` as live deploy
`dep-dbmqcqff3r2c73amthvg`. Build-started event
`evt-dbmqcqt494ic73aahqdg`, successful build-ended event
`evt-dbmqd2ds25qs739seg8g`, deploy-started event
`evt-dbmqcqfbf4ts7387q4dg` and successful deploy-ended event
`evt-dbmqdad494ic73aai5i0` bind that exact revision.

Fresh public probes observed:

- `/health`: `alive=true`, `production_approved=false`, `publication=false`;
- `/livez`: `alive=true`, `production_approved=false`, `publication=false`;
- `/readyz`: `ok=false`, `production_approved=false`, `publication=false`,
  `qaStatus=GREEN`, `hashBound=true`, exact expected and actual SHA-256
  `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`,
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
R495. The run therefore did not repeat the unchanged failed action. Existing code,
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

## Receipt deployment suppression

Content Control receipt PR #1109 merged as
`78bcd74d462f4f480d6e1d5956f7565a0b0ed3e4`. Render event
`evt-dbmqhjvavr4c739274t0` recorded that exact `[skip render]` documentation
revision as `commit_ignored` at `2026-11-06T10:15:43.60241Z`. It did not replace
the live functional deploy or trigger a duplicate build.
