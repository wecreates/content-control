# POD run receipt R473

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `fae6481a10bb9676e471e363f2896e97621a89a9`, the R472 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `dffc881ac68d3082fbd47a215cd6a76125cffab3`, the R472 exact Content
  Control pin.
- The open pull requests in both repositories were reread. They were older,
  unrelated draft/review lanes; none duplicated this recovery-transaction
  cancellation repair. Etsy pull requests were excluded from this lane. Fresh
  worktrees were created from the exact starting heads and older worktrees were
  left intact.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 acceptance areas still require
  attributable live evidence; implementation and tests alone do not complete
  them.

## Confirmed defect and repair

The artifact-only and complete-state restore functions accepted cancellation
signals, but entered the managed `PodDB.tx()` boundary without forwarding the
signal. The managed transaction also awaited pool acquisition, setup and
business-query driver promises directly. Cancellation during a stalled wait
could therefore leave a restore pending and retain one of the production
pool's two slots despite the restore's cooperative checkpoints elsewhere.

Regression-only execution reproduced all three missing boundaries on the prior
implementation. The pool-acquisition and stalled-query cases each required the
external three-second process bound; cancellation between completed statements
committed instead of rejecting and rolling back.

Content Control PR 1045 forwards the existing restore signal into the managed
transaction. It races cancellation across pool acquisition, transaction setup
and business queries, consumes late promise settlement, destroys a client
acquired after cancellation and destroys a client whose in-flight query leaves
transport outcome uncertain. Cancellation observed between completed
statements retains ordinary rollback and `DISCARD ALL` session scrub so the
client can be reused safely. Outcome-defining `COMMIT`, rollback and scrub are
not abandoned mid-control statement. `COMMIT` remains bounded by the existing
ten-second PostgreSQL statement timeout and is followed by the cancellation
checkpoint and reconciliation rule. Restore documentation records these
boundaries.

Exact PR head `75bc4b48e93f52aa6575fe4d111f459c86752e54` was verified and
squash-merged under the standing authorization as
`d6189940e1427984f6cf48e629c8cebd7ec848a9`.

## Verification evidence

Local verification recorded:

- the focused transaction and recovery suites: all 151 tests passed;
- full Content Control POD Node suite: 1,125 passed, nine expected local
  PostgreSQL-environment skips and zero failures (1,134 total);
- syntax checks for every affected JavaScript module; and
- `git diff --check`.

Exact-head hosted `POD integration gates` run `42021429761` (run number 1055),
job `127224885502`, passed all 1,134 Node/PostgreSQL 18 tests, all 385
Python/OpenCV tests, the stored-task production end-to-end test, syntax,
workflow-control and four review-guard tests. Exact-head `POD container runtime
gates` run `42021429835` (run number 533), job `127224885880`, passed image
build and non-root dependency probes, all 385 Python QA/rendering tests, all
1,134 Node/PostgreSQL tests, stored-task production end-to-end, print/review and
disabled-startup checks.

Money Factory PR 428 advanced only the immutable Content Control workflow pin
to the merged revision above. Exact pin head
`a99dd6432756e0a1b07fdb9fbaeb6b086c2795f5` passed `POD
cross-repository review verification` run `42022196284` (run number 430), job
`127227439513`: all 828 pinned Content Control Node tests, the Python/KDP groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests, all 274 Money Factory Node tests
and all 81 Money Factory Python tests passed with no failure or skip. PR 428
was squash-merged as `1342c8a2832a86f1f68929505b1945e469ec081b`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`d6189940e1427984f6cf48e629c8cebd7ec848a9`, built it successfully and made
deploy `dep-dbm6qocs728c73femnug` live. Build-ended event
`evt-dbm6qvjls7hs73f4erng` and deploy-ended event
`evt-dbm6ra5ah0ms73ed7esg` record success on the authorized free service
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

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair closes one code-level
pool-capacity leak in offline archive restore only. It does not establish an
independently retained database backup, close the current storage-expiry boundary,
mount and authenticate live Money Factory authority, provide current grants or
revocation evidence, configure owner-authorized marketplace accounts, establish
authorized intelligence or regional rights, accept generation, official templates,
KDP manuscripts/editorial/preview output, independent QA or verified remediation,
demonstrate authorized submit/readback on KDP, Redbubble, TeePublic, Zazzle and
Spreadshirt, reconcile actual economics or provider statements, demonstrate
production mobile operations, alerts, security or measured 100/1,000-per-day
capacity, complete an authorized end-to-end marketplace job, or grant controlled
launch approval. Publication remains held for explicit approval after every
acceptance requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the recorded connector and browser failures. The run used only
its actually available repository, hosted workflow, public service-probe and
authorized Render inspection paths. It did not have a continuously running
self-hosted worker, database shell, marketplace session or authority to widen
network access. It did not use or disclose credentials, contact anyone, purchase
resources, access the social vault, evade bot detection, or enable production or
publication.

Useful unblocked work remains, so the automation stays enabled. It must be
disabled only after all 24 acceptance areas are verifiably complete with
publication still held for explicit approval.
