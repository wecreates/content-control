# POD run receipt R475

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `70d1aff053067e3db477709e517c64c4bf994b8c`, the R474 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `a04483cbcf8200c0f90e08bcf30a0e3b418b0e00`, the R474 immutable Content
  Control pin.
- Open pull requests, exact workflow heads and the authorized Render service
  were reread before work began. The open requests were older unrelated lanes
  and did not duplicate this repair. Etsy requests remained excluded. Fresh
  worktrees were created from the exact heads and every existing worktree was
  preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 acceptance areas still require
  attributable live evidence; implementation, tests and a healthy process do
  not complete them.

## Confirmed defect and repair

The production runtime already owned one lifecycle AbortSignal and the shared
read/transaction helpers already supported cancellation, but four initial
database phases dropped that signal: the worker recovery sweep, production
claim, publication-disabled ready scan and enabled publication claim. A stopped
worker could therefore remain blocked in pool admission, transaction setup or
business SQL and retain one of the two production pool slots.

Five regression tests were added before the implementation change. All five
failed on the reconciled prior head because the recovery, scan and claim
endpoints received `undefined` instead of the exact lifecycle signal. This
failure was retained as the pre-fix reproduction and was not counted as passing
evidence.

Content Control PR 1051 passes the exact lifecycle signal through all four
runtime boundaries and adds optional signal arguments to `PodDB.listReady()`,
`claimProduction()`, `claimPublish()` and `recover()`. The initial operations now
use the existing guarded database wait. Cancellation can interrupt pool
acquisition, transaction setup or business SQL; known-clean work rolls back and
scrubs the session, while late or uncertain clients are destroyed instead of
being returned to the scarce pool. Outcome-defining commit still settles so the
runtime does not abandon a possibly successful claim. A returned lease keeps the
existing fenced, fail-closed stopped settlement. Documentation now distinguishes
that client-side boundary from forcibly terminating PostgreSQL server execution.

Exact PR head `0824cc077f8fbc1b308c7de700c43105e432662b` was verified and
squash-merged under the standing authorization as
`b3be98f4682d3d59ff319c80b296a2a4d6ac5cad`.

## Verification evidence

Local Content Control verification recorded:

- the five regression tests failed five-for-five before the repair and passed
  five-for-five afterward;
- syntax checks passed for `pod-db-bridge.js`, the orchestrator, production
  worker and publisher;
- the complete POD Node suite passed 1,134 tests with nine expected local
  PostgreSQL-environment skips and zero failures (1,143 total); and
- `git diff --check` passed.

Exact-head `POD integration gates` run `42038967337` (run number 1060), job
`127284410785`, passed the complete Node/PostgreSQL, Python/OpenCV,
stored-task end-to-end, syntax, workflow-control and review-guard sequence.
Exact-head `POD container runtime gates` run `42038967267` (run number 536),
job `127284412210`, passed image build, non-root dependency probes, Python
rendering QA, Node/PostgreSQL tests, real print/review generation and disabled
hosted-startup checks.

Money Factory PR 430 changed only its immutable Content Control workflow pin
from the R474 merge to `b3be98f4682d3d59ff319c80b296a2a4d6ac5cad`.
Its local POD suite passed 81 tests with five expected environment skips and
zero failures. Exact pin head `6e0c472425e771b8322bb996e7906299977dc398`
passed `POD cross-repository review verification` run `42039976710` (run
number 432), job `127287918855`, including every pinned Content Control
Node/Python/KDP group and the Money Factory Node/Python agent suites. PR 430
was squash-merged as `34d9c109556de6208ba98bfa77a0aad5c5182d72`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`b3be98f4682d3d59ff319c80b296a2a4d6ac5cad`, built it successfully and made
deploy `dep-dbm8knivcj2c7388su7g` live. Build-ended event
`evt-dbm8kvlpetos738u7aa0` and deploy-ended event
`evt-dbm8l7tpetos738u7h40` record success on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`. The service remains one free Docker instance with
automatic main-branch deployment and `/health` configured as its health path.

Direct unauthenticated probes after rollout returned:

- `/health`: HTTP 200, `alive=true`, `production_approved=false` and
  `publication=false`;
- `/livez`: HTTP 200 with the same production/publication holds; and
- `/readyz`: HTTP 503, with `ok=false`, GREEN QA and matching expected/actual
  SHA-256
  `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`,
  but `captionReady=false`, `production_approved=false` and
  `publication=false`.

This proves process liveness for the exact merged repair and confirms that the
acceptance readiness gate still fails closed. It does not convert deployment
success into hosting, end-to-end or launch acceptance.

After this documentation receipt merged as
`dde72095872f9b59e4fdea1502df53e8646233d9`, Render recorded
`commit_ignored` event `evt-dbm8oi3ncjis738vq7u0` at
2026-11-05T14:01:44.726294Z. No second deployment started; functional deploy
`dep-dbm8knivcj2c7388su7g` remained live on
`b3be98f4682d3d59ff319c80b296a2a4d6ac5cad`.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair closes one code-level
shutdown and pool-retention gap in the initial runtime database phases only. It
does not establish an independently retained database backup, close the
storage-expiry boundary, mount and authenticate live Money Factory authority,
provide current grants or revocation evidence, configure owner-authorized
marketplace accounts, establish authorized intelligence or regional rights,
accept generation, official templates, KDP manuscripts/editorial/preview
output, independent QA or verified remediation, demonstrate authorized
submit/readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile
actual economics or provider statements, demonstrate production mobile
operations, alerts, security or measured 100/1,000-per-day capacity, complete an
authorized end-to-end marketplace job, or grant controlled launch approval.
Publication remains held for explicit approval after every acceptance
requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the recorded connector and browser failures. The run used only
its actually available repository connector, hosted workflows, public
service-probe and authorized Render inspection paths. Direct Git push lacked
interactive credentials, so the configured repository connector created the
exact tested Git objects and refs. The run did not have a continuously running
self-hosted worker, database shell, marketplace session or authority to widen
network access. It did not use or disclose credentials, contact anyone, purchase
resources, access the social vault, evade bot detection, or enable production or
publication.

Useful unblocked work remains, so the automation stays enabled. It must be
disabled only after all 24 acceptance areas are verifiably complete with
publication still held for explicit approval.
