# POD run receipt R493

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded.
The run repaired one unblocked public-diagnostics information-boundary defect,
merged the exact passing implementation and consumer pin, and verified the free
Render deployment. This is implementation and deployment evidence, not live
marketplace acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory.
The run did not enable publication, purchase resources, contact a third party,
access a social vault, evade a safeguard, widen network access, or claim credentials,
marketplace clearance, tests, revenue, or approvals that were not observed.

## Reconciled starting heads and concurrent work

- Content Control started at
  `f1beee1139b14459610fe511ec0967d3e116f1b1`.
- Money Factory started at
  `21c9e67a11479dd73d72b10844f7cc4aec7989a1`.
- Open pull requests, workflow results and current remote heads were inspected before
  branches were created and again before each merge. No open R493 POD/KDP pull
  request or duplicate job existed. Unrelated open work was left untouched and Etsy
  pull requests remained outside this lane.

## Confirmed defect and repair

The unauthenticated `/api/print/status` route spread every enumerable field from the
internal status provider. An accidental private field would therefore have crossed
the public boundary, while an enumerable accessor could execute during projection.
Two regression tests were added first. Against the pre-repair implementation, the
private accessor executed once instead of zero times and an executable status field
returned HTTP 200 instead of failing closed with HTTP 503.

The repair now:

- projects only documented service, database, production and outbox diagnostics;
- reads only own inert data descriptors and rejects proxy/accessor-backed known
  fields;
- validates bounded status/error codes, nonnegative safe counts and canonical UTC
  timestamps;
- emits a fixed blocked response when projection is not safe; and
- continues to hard-disable publication and adapter-verification claims.

The focused operations suite then passed 27/27.

## Content Control verification and merge

Local evidence:

- complete Node POD suite: 1,175 tests; 1,166 passed, nine expected skips and zero
  failures;
- complete Python POD suite: 385 passed;
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1102](https://github.com/wecreates/content-control/pull/1102) used immutable head
`0565d1a6e1fca2eef6569e2c2fe7a076b983d15e`. Its remote tree
`936e31b138e35dbac6e14155b49a17b6b2208815` exactly matched the locally tested
tree. Hosted POD integration run `42190759616`, job `127801902820`, and container
run `42190759623`, job `127801903061`, both passed. The PR merged as
`6d2a21807eab571b0f6e63ed308a34531b3d0a5c`.

## Money Factory authority pin

The Money Factory production workflow now pins the exact Content Control merge
above. The one-line pin retained both publication flags as literal `false`. Local
dependent evidence passed:

- Money Factory Node bridge: 279 tests; 278 passed, one expected PostgreSQL skip;
- Money Factory Python bridge: 81 passed; and
- `git diff --check`.

Money Factory PR
[#448](https://github.com/wecreates/Money-factory/pull/448) used immutable head
`a9e20d5c881a4d14bdac7976d5301c21bd1495ad`. Its remote tree
`c84bda0da4679aecb8eb570f7e3e458ceafd61eb` exactly matched the locally tested
tree. Hosted cross-repository run `42191652242`, job `127804895927`, passed. The
PR merged as `2d8519032f2e1441cf60e0eb783d5af323694ecd`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No manual
or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`6d2a21807eab571b0f6e63ed308a34531b3d0a5c` as live deploy
`dep-dbmpdc5g1s2s73d83g5g`. Build-started event
`evt-dbmpdclfbbac73bhm6b0`, successful build-ended event
`evt-dbmpdjts25qs739rnbv0`, deploy-started event
`evt-dbmpdc9uqbhc73b2b4ng` and successful deploy-ended event
`evt-dbmpduc7j7js73betnqg` bind that exact revision.

Fresh public probes observed:

- `/health`: `alive=true`, `production_approved=false`, `publication=false`;
- `/livez`: `alive=true`, `production_approved=false`, `publication=false`;
- `/readyz`: `ok=false`, `production_approved=false`, `publication=false`,
  `qaStatus=GREEN`, `hashBound=true`, exact expected and actual SHA-256
  `59b662688952addf932c2ced9c438aa1499e282039055e71eeb5109d8e86134e`,
  `captionReady=false`, and `renderStatus=v2-validation-complete`;
- `/api/print/status`: HTTP response content was limited to the documented keys
  `status`, `database_health`, `production_status`, `production_health`, `outbox`,
  `publication_enabled`, `publication_requested` and `adapters_verified`;
  `status=DISABLED`, `production_status=DISABLED`, and all three publication or
  adapter booleans were `false`.

The live process therefore serves the constrained public projection and continues
to fail closed for readiness and publication. These probes do not establish
marketplace, editorial, rights, account, adapter or launch acceptance.

## Database administration and execution limits

The prior database-administration attempts through the connector and browser had
failed, and no credible changed database administration access path appeared in
R493. The run therefore did not repeat the unchanged failed action. Existing code,
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

Documentation merge `7e7c722451bf2fe03e0a4f5917f1fa07e90fe43f` was ignored by
Render as intended in event `evt-dbmphcks728c739f679g`. The verified live deploy
therefore remained `dep-dbmpdc5g1s2s73d83g5g` from functional merge
`6d2a21807eab571b0f6e63ed308a34531b3d0a5c`.

