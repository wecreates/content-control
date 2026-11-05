# POD run receipt R476

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `c1f1a6ea76d42fbd2abdbc2e207df3eb95163c13`, the R475 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `34d9c109556de6208ba98bfa77a0aad5c5182d72`, the R475 immutable Content
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

Authenticated job-list, package, artifact, readiness, metrics and capacity
routes owned a real client request lifecycle, and their guarded database reads
already supported cancellation. The router did not forward that lifecycle.
After a dashboard or mobile client disconnected, its server-side database work
could therefore remain blocked in pool admission or SQL and retain one of the
two production pool slots.

Content Control PR 1054 creates one fixed request-lifecycle signal for each
authenticated read, aborts it when the request is aborted or the response
connection closes, removes its listeners when the route completes, and forwards
it through every authenticated read-only route. `PodDB.listOperationsJobs()`,
`reviewPackage()` and `reviewArtifact()` now pass the signal into the existing
guarded read helper; `listReady()` already accepted it. Metrics and capacity
receive the same signal and retain their existing independent diagnostic
deadline. The shared database helper interrupts pool acquisition and stalled
SQL; late or uncertain clients are destroyed, while known-clean transactions
retain their existing rollback and scrub behavior. Mutation routes were not
given disconnect cancellation because abandoning an outcome-defining commit
would create a different uncertainty boundary.

The regression suite proves both optional method forwarding and a real
authenticated HTTP disconnect. The pending job-list operation observes a native
aborted signal with the fixed `POD_REQUEST_CANCELLED` reason; no private client
or database details enter the reason or response. Normal completed reads retain
their response contracts. Publication, production and outbox controls are
unchanged and remain disabled.

Exact PR head `33b4361351b9ea6184e1b85ba3599a702c18c504` was verified and
squash-merged under the standing authorization as
`e443e2315fae1b9db729972100195ad1a7b0f5d4`.

## Verification evidence

Local Content Control verification recorded:

- the focused operations and guarded-read suites passed 44 tests with zero
  failures;
- the complete POD Node suite passed 1,137 tests, with nine expected local
  PostgreSQL-environment skips and zero failures (1,146 total);
- after installing the repository's locked free runtime requirements, the
  complete POD Python/OpenCV suite passed 385 tests with zero failures;
- syntax checks passed for the changed JavaScript modules; and
- `git diff --check` passed.

Exact-head `POD integration gates` run `42048349281` (run number 1062), job
`127317369429`, passed the complete Node/PostgreSQL, Python/OpenCV,
stored-task end-to-end, syntax, workflow-control and review-guard sequence.
Exact-head `POD container runtime gates` run `42048349243` (run number 537),
job `127317368466`, passed image build, non-root dependency probes, Python
rendering QA, Node/PostgreSQL tests, real print/review generation and disabled
hosted-startup checks.

Money Factory PR 431 changed only its immutable Content Control workflow pin
from the R475 merge to `e443e2315fae1b9db729972100195ad1a7b0f5d4`.
Its local Node POD suite passed 273 tests with one expected PostgreSQL skip and
zero failures; its Python POD suite passed 81 tests with zero failures.
Exact pin head `ab37308b9d69481d0fbaca327021f61c51c17b5a` passed `POD
cross-repository review verification` run `42050270609` (run number 433), job
`127324196285`, including every pinned Content Control Node/Python/KDP group
and the Money Factory Node/Python agent suites. PR 431 was squash-merged as
`3af2473282bfe88fee24514ea13d83902734cd7a`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`e443e2315fae1b9db729972100195ad1a7b0f5d4`, built it successfully and made
deploy `dep-dbm9igks728c73fir220` live. Build-ended event
`evt-dbm9ipmoc8ic73bn2pt0` and deploy-ended event
`evt-dbm9j4lpetos738v61gg` record success on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`. The prior functional deploy was deactivated. The
service remains one free Docker instance with automatic main-branch deployment
and `/health` configured as its health path.

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

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair closes one code-level
request-cancellation and pool-retention gap in authenticated reads only. It does
not establish an independently retained database backup, close the
storage-expiry boundary, mount and authenticate live Money Factory authority,
provide current grants or revocation evidence, configure owner-authorized
marketplace accounts, establish authorized intelligence or regional rights,
accept generation, official templates, KDP manuscripts/editorial/preview
output, independent QA or verified remediation, demonstrate authorized
submit/readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile
actual economics or provider statements, demonstrate production mobile
operations, alerts, security or measured 100/1,000-per-day capacity, complete
an authorized end-to-end marketplace job, or grant controlled launch approval.
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
