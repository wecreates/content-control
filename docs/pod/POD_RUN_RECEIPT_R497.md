# POD run receipt R497

Date: 2026-11-06 UTC

## Scope and result

This bounded scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained
excluded. The run repaired authenticated request-body deadline enforcement,
merged the passing implementation and exact consumer pin, and verified the free
Render deployment. This is implementation and deployment evidence, not live
marketplace acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained
mandatory. The run did not enable publication, purchase resources, contact a
third party, access a social vault, evade a safeguard, widen network access, or
claim credentials, marketplace clearance, tests, revenue, or approvals that
were not observed.

## Reconciled starting state and concurrent work

- Content Control started at
  `cfd03646482e997ff90125f5b79ce5612273cbe1`.
- Money Factory started at
  `cb3d52e0dfdd5edf34df923f427ea57af12dce72`.
- The completion checklist, implementation-status and free-deployment
  documents, current run receipts, open pull requests, workflow results and the
  authorized Render service were inspected before editing.
- No open R497 POD/KDP pull request or duplicate job existed. Content Control
  draft PR #378 explicitly excluded POD changes and was left untouched.
- While local verification ran, Content Control main advanced through unrelated
  watchdog, QA-receipt and candidate-ledger changes. The functional change was
  rebased once before publication, later main changes were confirmed
  non-overlapping, and GitHub reported the exact tested PR head mergeable
  against the current base before merge.

## Confirmed defect and repair

Protected authorization and route operations already shared one fixed request
lifecycle, but the Express JSON and raw body parsers did not observe that
lifecycle. An authenticated client could declare a request body, send only part
of it, and keep body parsing alive after the 30-second server deadline before
any database handler began.

A regression was added first. It opens an authenticated partial `POST /jobs`,
waits until the parser is consuming the body, expires the native lifecycle
signal, and requires the connection to close without a database call. Against
the pre-repair implementation the focused operations suite reported 37 passes
and exactly one failure: `body parser outlived request deadline`.

The repair wraps both authenticated parsers in the existing lifecycle:

- JSON and approved artifact-body parsing now register a one-shot deadline
  abort listener;
- deadline expiry terminates the unfinished request before protected database
  work can start;
- the listener is removed as soon as parsing completes, so the later route
  deadline continues to return the existing sanitized response; and
- synchronous parser/setup failures dispose the lifecycle and flow through the
  existing fixed error response.

The repaired operations suite passed 38/38, and the broader request-error and
database-wait set passed 43/43.

## Content Control verification and merge

Local evidence on the tested tree:

- complete Node POD suite: 1,186 tests; 1,177 passed, nine expected
  environment-dependent skips and zero failures;
- complete Python POD suite: 385 passed;
- rebased focused operations suite: 38/38; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1114](https://github.com/wecreates/content-control/pull/1114) used immutable
head `9a436632a69a4bdac3caa4ae3a9e05665f84016e`. Its remote tree
`467b55a4b06301b68a4a9f2a6310001316cadff0` exactly matched the locally
tested tree. Hosted integration run `42211018066`, job `127869376577`, and
production container run `42211018171`, job `127869377410`, both passed.
The exact-head gates included Node/Python, PostgreSQL, production E2E,
workflow/review guards, image build, non-root dependencies, real print/review,
and disabled startup. The mergeability gate was re-read after concurrent main
updates, and the PR merged as
`81fa60b109d3f2d0814858fd5494521a5a426218`.

## Money Factory authority pin

The Money Factory production workflow now pins that exact Content Control
merge. The one-line pin retained both publication flags as literal `false`.
Local dependent evidence passed:

- Node bridge: 279 tests; 278 passed and one expected PostgreSQL skip;
- Python bridge: 81 passed; and
- `git diff --check`.

Money Factory PR
[#452](https://github.com/wecreates/Money-factory/pull/452) used immutable head
`c1314392e1d1af4a7346e23c04c9ed6358a7ac78`. Its remote tree
`0a2936e5a136769d363f242aa65c7724cc4dd9a4` exactly matched the locally
tested one-line workflow tree. Hosted cross-repository run `42212069246`,
job `127872879048`, passed every pinned contract, evidence, recovery, rights,
KDP editorial and bridge stage. The PR merged as
`f846b371209313dc5a63aff28cfd506d30c6eb5b`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered
auto-deploy, one instance and not suspended in workspace
`tea-darsafojo6nc739844hg`. No manual or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`81fa60b109d3f2d0814858fd5494521a5a426218` as live deploy
`dep-dbmrp7favr4c7393nh5g`. Deploy-started event
`evt-dbmrp7d494ic73abjd3g`, build-started event
`evt-dbmrp7t494ic73abjdd0`, successful build-ended event
`evt-dbmrph5fbbac73bjfibg`, and successful deploy-ended event
`evt-dbmrpp4q5q8c7398nrbg` bind that exact revision.

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
- `/api/print/status`: `status=DISABLED`,
  `production_status=DISABLED`, `publication_enabled=false`,
  `publication_requested=false`, and `adapters_verified=false`.

The live process therefore continues to fail closed for readiness and
publication. These probes do not establish marketplace, editorial, rights,
account, adapter or launch acceptance.

## Database administration and execution limits

The prior database-administration attempts through the connector and browser
had failed, and no credible changed database-administration access path appeared
in R497. The run therefore did not repeat the unchanged failed action. Existing
code, tests and a live web process are not substitutes for current restricted-role
preflight, independent backup/restore evidence or live authority configuration.

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

Content Control receipt PR #1115 merged as
`02aec06499271a0edb61dbcfca8ba8b60104d483`. Render event
`evt-dbmrtn5g1s2s73db1ep0` recorded that exact `[skip render]`
documentation revision as `commit_ignored` at
`2026-11-06T11:49:48.478577Z`. It did not replace live functional deploy
`dep-dbmrp7favr4c7393nh5g` or trigger a duplicate build.
