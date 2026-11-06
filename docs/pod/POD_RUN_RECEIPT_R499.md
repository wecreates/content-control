# POD run receipt R499

Date: 2026-11-06 UTC

## Scope and result

This bounded scheduled run continued the Amazon KDP/POD lane across
`wecreates/content-control` and `wecreates/Money-factory`. Etsy remained
excluded. The run repaired executable error classifiers at the protected HTTP
boundary, merged the passing implementation and exact Money Factory authority
pin, and verified the free Render deployment. This is implementation and
deployment evidence, not live marketplace acceptance: all 24 acceptance areas
remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained
mandatory. The run did not enable publication, purchase resources, contact a
third party, access a social vault, evade a safeguard, widen network access or
claim credentials, marketplace clearance, tests, revenue or approvals that
were not observed.

## Reconciled starting state and concurrent work

- Content Control started at
  `2eae0034d904c7326f08f0ff6df7bae4c21c2cce`.
- Money Factory started at
  `455a5e268a824718ffd62d819becbe1ef555e744`.
- The completion checklist, implementation-status and free-deployment
  documents, open pull requests, workflow results and the authorized Render
  service were inspected before editing.
- No open R499 POD/KDP pull request or duplicate job existed. Current heads
  were re-read before publication and before each merge; the exact tested heads
  remained mergeable against their unchanged bases.
- The prior database-administration attempts still had no credible changed
  access path, so the run did not repeat that failed action.

## Confirmed defect and repair

The protected operations router classified the storage-expiry exception through
ordinary `error.message` property access. A database rejection with an accessor
or Proxy-backed `message` could execute code in the response boundary and could
misclassify an unrelated failure as a storage cutoff. The parser-error sanitizer
similarly read `error.type` through ordinary property access, allowing an
executable error shape to run inside the code intended to redact it.

Two regressions were added first. They require accessor- and Proxy-backed
database/parser errors to execute no traps, to retain fixed route-specific
responses and to avoid manufacturing a storage-expiry classification. Against
the pre-repair implementation the focused suite ran 43 tests, passed 41 and
failed exactly those two regressions: the operation returned 503 instead of 409,
and the parser type accessor executed.

The repair accepts a storage exception only from an inert own `message` data
field equal to `POD_STORAGE_EXPIRING`, and accepts a parser classification only
from an inert own string `type` data field. Proxies, accessors, inherited values,
coercible values and descriptor failures fall back to fixed sanitized responses
without invocation. Ordinary storage-expiry errors retain their existing 503
contract.

## Content Control verification and merge

Local evidence on the tested tree:

- focused operations and parser-error suite: 43/43;
- complete Node POD suite: 1,189 tests; 1,180 passed, nine expected
  environment-dependent skips and zero failures;
- complete Python POD suite: 385/385; and
- syntax checks and `git diff --check`: passed.

Content Control PR
[#1120](https://github.com/wecreates/content-control/pull/1120) used immutable
head `2abfdbe5879fe568fbe9586d45cb09d2207c3b55`. Its remote tree
`bc7a6706ae03422550a399a0eaa6af145a3f8aa3` exactly matched the locally
tested tree. Hosted integration run `42229482155`, job `127931374304`, and
production container run `42229481884`, job `127931372860`, both passed every
stage. The exact-head gates included Node/Python, PostgreSQL, production E2E,
workflow/review guards, image build, non-root dependencies, real print/review
and disabled startup. The PR merged as
`332b01b1f64da814ba5532941b4dc173d021ba19`.

## Money Factory authority pin

The Money Factory production workflow now pins that exact Content Control
merge. The one-line pin retained both publication flags as literal `false`.
Local dependent evidence passed:

- Node bridge rerun: 279 tests; 278 passed and one expected PostgreSQL skip;
- Python bridge: 81/81; and
- `git diff --check`.

The first concurrent local Node bridge invocation exposed one existing timing
race in `HTTP pool timeout returns a redacted retryable 503`: its fixture tried
to resolve a pool promise before the isolated test had created that resolver.
The exact focused test then passed, and a complete default-concurrency rerun
passed 278 tests with the expected single PostgreSQL skip. No Money Factory
runtime code was changed or represented as repaired by the pin.

Money Factory PR
[#454](https://github.com/wecreates/Money-factory/pull/454) used immutable head
`135c8b70d3ecb5821a811599d76285151e929357`. Its remote tree
`5bb7162d4d422a28c3f536ffd2166fb510dc0c4a` exactly matched the locally
tested one-line workflow tree; the workflow blob was
`9623053aa0affab15676119d539d5e7e0bdbecf4`. Hosted cross-repository run
`42230864864`, job `127936079009`, passed every pinned contract, evidence,
recovery, rights, official-template, KDP-editorial and bridge stage. The PR
merged as `c10494eac0b8780f14472d4d41db5b177b0e9eab`.

## Free Render deployment and public probes

The authorized free Docker service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) remained on `main`, commit-triggered auto-deploy,
one instance and not suspended in workspace `tea-darsafojo6nc739844hg`. No
manual or duplicate deploy was triggered.

Render auto-deployed exact functional merge
`332b01b1f64da814ba5532941b4dc173d021ba19` as live deploy
`dep-dbmtsbtckfvc73923u0g`. Deploy-started event
`evt-dbmtsc47j7js73biept0`, build-started event
`evt-dbmtsc8gs6ms73a4j9p0`, successful build-ended event
`evt-dbmtsk4q5q8c739agm80`, and successful deploy-ended event
`evt-dbmtsuk7j7js73bifblg` bind that exact revision.

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
in R499. The run therefore did not repeat the unchanged failed action. Existing
code, tests and a live web process are not substitutes for current
restricted-role preflight, independent backup/restore evidence or live
authority configuration.

The connected browser extension was unavailable, so public probes used the
available cloud browser without login. This receipt describes one bounded
execution with the tools and permissions actually available to it. It does not
claim a continuously running self-hosted worker.

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
