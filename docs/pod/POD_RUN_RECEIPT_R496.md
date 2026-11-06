# POD run receipt R496

Date: 2026-11-06 UTC

## Scope and result

This bounded scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The run repaired the remaining owner-authorization cancellation boundary, merged
the exact passing implementation and consumer pin, and verified the free Render
deployment. This is implementation and deployment evidence, not live marketplace
acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory.
The run did not enable publication, purchase resources, contact a third party,
access a social vault, evade a safeguard, widen network access, or claim credentials,
marketplace clearance, tests, revenue, or approvals that were not observed.

## Reconciled starting state

- Content Control started at
  `ee49038cb861a9289cbac5056538ef76fbc3b02c`.
- Money Factory started at
  `bbd6972e6fff007a302787f5f046546994605658`.
- Current POD completion, implementation-status and free-deployment documents,
  open pull requests, recent workflow evidence and the authorized Render service
  were inspected before editing.
- No open R496 POD/KDP pull request or duplicate job existed. Content Control draft
  PR #378 explicitly excluded POD changes and was left untouched. No in-scope main
  branch moved during either functional pull request.

## Confirmed defect and repair

Protected route operations already received request cancellation and a fixed
deadline, but owner authorization ran before that lifecycle existed. A disconnected
client could therefore leave an asynchronous authority check running, and authority
plus database work did not share one request deadline.

Two regression tests were added first. Against the pre-repair implementation the
operations suite reported 35 passes and exactly two failures: authorization received
no native `AbortSignal`, and the authority check could not share the protected route
signal.

The repair now:

- establishes one lifecycle before owner authorization;
- passes the native signal to the authorization adapter and reuses the same signal
  for all following protected work;
- races every protected step against that signal while consuming late settlement;
- checks the fixed monotonic deadline before and after each protected step; and
- disposes request listeners on authorization denial, parser failure, route exit
  and ordinary completion.

The focused authorization, router and cancellation set then passed 40/40.

## Content Control verification and merge

Local evidence:

- complete Node POD suite: 1,185 tests; 1,176 passed, nine expected skips and zero
  failures;
- complete Python POD suite: 385 passed; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1111](https://github.com/wecreates/content-control/pull/1111) used immutable head
`42a9dd83358d30c8ccd7e554e9b645383d3bdc49`. Its remote tree
`858a7ab036a1b91ed8a1bd936dfd90e507c2e2d0` exactly matched the locally tested
tree. Hosted integration run `42206627347`, job `127854805760`, and production
container run `42206627337`, job `127854805432`, both passed. The exact-head gates
included Node/Python, PostgreSQL, production E2E, workflow/review guards, image
build, non-root dependencies, real print/review, and disabled startup. The PR
merged as `e29384829c5cb34e15c0db66be2e5a6c200ee41f`.

## Money Factory authority pin

The Money Factory production workflow now pins that exact Content Control merge.
The one-line pin retained both publication flags as literal `false`. Local dependent
evidence passed against the exact tested Content Control tree:

- Node bridge: 279 tests; 278 passed and one expected PostgreSQL skip;
- Python bridge: 81 passed; and
- `git diff --check`.

Money Factory PR
[#451](https://github.com/wecreates/Money-factory/pull/451) used immutable head
`dffc17c80af7d803a088ae56a9a226bfad6487b8`. Its remote tree
`c297c7ca4b1902a49f84a91a557fa37cec5ee1dc` contained the exact tested workflow
blob. Hosted cross-repository run `42207690460`, job `127858326795`, passed every
pinned, evidence, recovery, rights, KDP editorial and bridge stage. The PR merged
as `cb3d52e0dfdd5edf34df923f427ea57af12dce72`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No manual
or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`e29384829c5cb34e15c0db66be2e5a6c200ee41f` as live deploy
`dep-dbmr8p7avr4c73932rk0`. Build-started event
`evt-dbmr8pjfnrrc73a2d1a0`, successful build-ended event
`evt-dbmr920gs6ms73a2d260`, deploy-started event
`evt-dbmr8p7bf4ts7388fdr0` and successful deploy-ended event
`evt-dbmr9cnrkulc73em6f90` bind that exact revision.

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
R496. The run therefore did not repeat the unchanged failed action. Existing code,
unit tests and a live web process are not substitutes for current restricted-role
preflight, independent backup/restore evidence or live authority configuration.

The connected browser extension was unavailable to this scheduled run. Public
probes were completed with the available cloud browser and required no login. This
receipt describes one bounded execution with the tools and permissions actually
available to it. It does not claim a continuously running self-hosted worker.

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
