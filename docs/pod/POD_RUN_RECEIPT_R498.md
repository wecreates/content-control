# POD run receipt R498

Date: 2026-11-06 UTC

## Scope and result

This bounded scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained
excluded. The run repaired a pre-routing request-disconnect race, merged the
passing implementation and exact Money Factory authority pin, and verified the
free Render deployment. This is implementation and deployment evidence, not
live marketplace acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained
mandatory. The run did not enable publication, purchase resources, contact a
third party, access a social vault, evade a safeguard, widen network access or
claim credentials, marketplace clearance, tests, revenue or approvals that
were not observed.

## Reconciled starting state and concurrent work

- Content Control started at
  `1ebc228276927ed146fc1d6dd9ca1eb93a115a55`.
- Money Factory started at
  `f846b371209313dc5a63aff28cfd506d30c6eb5b`.
- The completion checklist, implementation-status and free-deployment
  documents, current run receipts, open pull requests, workflow results and the
  authorized Render service were inspected before editing.
- No open R498 POD/KDP pull request or duplicate job existed. Content Control
  draft PR #378 explicitly excludes POD changes and remained untouched.
- Current heads were re-read before publication. The exact tested functional
  and pin heads were mergeable against their current bases before merge.

## Confirmed defect and repair

The protected POD router registered future `req.aborted` and `res.close`
events, but did not inspect the state already present when routing began. If an
upstream asynchronous middleware delayed routing until after the client had
disconnected, those events had already fired. The later authorization call
could therefore begin for an already-aborted request.

A regression was added first. It delays POD routing in upstream middleware,
destroys the client connection, confirms that the server observed the abort,
then releases the router and requires zero authorization and database calls.
Against the pre-repair implementation the focused operations suite reported 38
passes and exactly one failure because authorization was called once.

The repair retains the existing one-shot request lifecycle and listeners, then
immediately aborts it when `req.aborted` or `res.destroyed` is already true.
The repaired focused operations suite passed 39/39, and the broader operations,
request-error and database-wait set passed 44/44.

## Content Control verification and merge

Local evidence on the tested tree:

- complete Node POD suite: 1,187 tests; 1,178 passed, nine expected
  environment-dependent skips and zero failures;
- complete Python POD suite: 385 passed;
- focused operations suite: 39/39;
- broader operations, request-error and database-wait set: 44/44; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1117](https://github.com/wecreates/content-control/pull/1117) used immutable
head `4eb3fec61e072dcaeafb5508f4dd51e0a4c2b2db`. Its remote tree
`5931e5202fd75f3a29746c3e272825e63843bc6c` exactly matched the locally
tested tree. The changed router blob was
`2a6ab5601ad791b5cb4a263043fdc03e3f870bb4`, and the regression-test blob was
`d216bc7c925f112ac8068ed479b94fca8f940cbf`. Hosted integration run
`42225571002`, job `127918064617`, and production container run
`42225570659`, job `127918064023`, both passed every stage. The exact-head
gates included Node/Python, PostgreSQL, production E2E, workflow/review guards,
image build, non-root dependencies, real print/review and disabled startup.
The PR merged as
`d2348db36d5603877fa95cf4805b443cddcae7cc`.

## Money Factory authority pin

The Money Factory production workflow now pins that exact Content Control
merge. The one-line pin retained both publication flags as literal `false`.
Local dependent evidence passed:

- Node bridge: 279 tests; 278 passed and one expected PostgreSQL skip;
- Python bridge: 81 passed; and
- `git diff --check`.

Money Factory PR
[#453](https://github.com/wecreates/Money-factory/pull/453) used immutable head
`4cddd110151045c498917fb204bc1782dee34d5c`. Its remote tree
`b658a6316299ee54891af907441d821ea659687d` exactly matched the locally
tested one-line workflow tree; the workflow blob was
`1dc18178f055d42d5a434a6324eaa2a53dbe400c`. Hosted cross-repository run
`42226728068`, job `127921984872`, passed every pinned contract, evidence,
recovery, rights, official-template, KDP-editorial and bridge stage. The PR
merged as `455a5e268a824718ffd62d819becbe1ef555e744`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No
manual or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`d2348db36d5603877fa95cf4805b443cddcae7cc` as live deploy
`dep-dbmtellg1s2s73dd5hsg`. Deploy-started event
`evt-dbmtelts25qs739uu5kg`, build-started event
`evt-dbmtem0gs6ms73a46se0`, successful build-ended event
`evt-dbmtet7bf4ts738a9ogg`, and successful deploy-ended event
`evt-dbmtf2ggs6ms73a47bgg` bind that exact revision.

Fresh public probes observed:

- `/health`: `alive=true`, `production_approved=false`,
  `publication=false`;
- `/livez`: `alive=true`, `production_approved=false`,
  `publication=false`;
- `/readyz`: `ok=false`, `production_approved=false`,
  `publication=false`, `qaStatus=GREEN`, `hashBound=true`, exact expected
  and actual SHA-256
  `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`,
  `captionReady=false`, and `renderStatus=v2-validation-complete`; and
- `/api/print/status`: `status=DISABLED`, `database_health=null`,
  `production_status=DISABLED`, disabled production health with zero cycles,
  disabled outbox, `publication_enabled=false`,
  `publication_requested=false`, and `adapters_verified=false`.

The live process therefore continues to fail closed for readiness and
publication. These probes do not establish marketplace, editorial, rights,
account, adapter or launch acceptance.

## Database administration and execution limits

The prior database-administration attempts through the connector and browser
had failed, and no credible changed database-administration access path appeared
in R498. The run therefore did not repeat the unchanged failed action. Existing
code, tests and a live web process are not substitutes for current
restricted-role preflight, independent backup/restore evidence or live
authority configuration.

Direct Git transport had no interactive credential path in this scheduled
environment; the authorized repository connector published exact tested blobs
and trees instead. The connected browser extension was unavailable, so public
probes used the available cloud browser without login. This receipt describes
one bounded execution with the tools and permissions actually available to it.
It does not claim a continuously running self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. Live
database/storage durability, current external grants and account records,
authorized intelligence, regional-rights evidence, official template
provenance, substantive KDP editorial/preview acceptance, independent
QA/remediation, authorized adapters for all five in-scope marketplaces, real
economics and financial reconciliation, measured capacity, end-to-end
acceptance and controlled launch remain unverified. Publication remains held
for explicit owner approval, and this automation cannot enable it.

The continuation automation therefore remains enabled.

## Receipt deployment suppression

Content Control receipt PR #1118 merged as
`c0eb9314fbd5ac5490b6d8904994df235f169684`. Render event
`evt-dbmtitdckfvc7391l96g` recorded that exact `[skip render]`
documentation revision as `commit_ignored` at
`2026-11-06T13:43:17.962088Z`. It did not replace live functional deploy
`dep-dbmtellg1s2s73dd5hsg` or trigger a duplicate build.
