# POD run receipt R474

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `c9c255b17c4914cc903fe490317f5ec217d4ae3b`, the R473 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `04b6e09396cec4fcac63146fbfb8f300658dedc4`. This included the R473
  immutable Content Control pin plus the newer unrelated `free monitor cadence
  tick`; that concurrent commit was preserved.
- Open pull requests and exact workflow heads were reread in both repositories.
  They were older unrelated lanes and did not duplicate this repair. Etsy pull
  requests remained excluded. Fresh worktrees were created from the exact heads
  and existing dirty worktrees were left intact.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 acceptance areas still require
  attributable live evidence; implementation and tests alone do not complete
  them.

## Confirmed defect and repair

The optional Money Factory outbox runtime already used one lifecycle signal for
network delivery and promised cooperative shutdown, but it did not forward that
signal to its initial event-selection read or its post-acknowledgement delivered
marker transaction. `PodDB.read()` also directly awaited pool acquisition,
transaction setup and business SQL. A stalled driver promise could therefore
retain one of the production pool's two slots and prevent `stop()` from draining.

Regression-only execution on the prior implementation reproduced four missing
boundaries. Pool acquisition and a stalled read each required an external
three-second process bound. Cancellation between completed read statements
committed instead of rolling back. The outbox forwarded no signal into either
database phase.

Content Control PR 1048 adds an optional lifecycle signal to the shared read
transaction and forwards the outbox signal into both database phases. Pool
admission, setup and business SQL are cancellation-aware. A late-acquired client
or one with an in-flight query of uncertain outcome is destroyed rather than
returned to the scarce pool. Cancellation between completed statements retains
ordinary rollback and `DISCARD ALL` session scrub, while outcome-defining
`COMMIT` still settles before its post-commit cancellation checkpoint. An
already-cancelled batch performs no storage or network work. The outbox contract
records those boundaries.

The first exact hosted head `790de01f577a2294d04a033c4d9174f092257899`
passed every new read/outbox regression and the production-container gate, but
its integration run exposed an unrelated existing test-harness race: the review
CLI fixture allowed two seconds for a nested Node/Python process to initialize
during the saturated full suite. The behavioral test was retained; its readiness
wait now uses a ten-second monotonic deadline and fails immediately if the CLI
exits. The affected signal test passed in isolation, 20 repetitions of the full
review-CLI suite passed, and the complete POD gate was rerun before publishing
the follow-up. No failed run was treated as proof.

Final exact PR head `924b3ddcffa0eb9d79861eb8fd70d5914dc9c59c`
was verified and squash-merged under the standing authorization as
`dc496044297ce55256df7f4fff79bd6a1ca93f3b`.

## Verification evidence

Local verification recorded:

- the focused read/outbox suites: all 48 tests passed;
- the affected review CLI signal test and 20 complete review-CLI suite
  repetitions passed;
- full Content Control POD Node suite, before and after the fixture repair:
  1,129 passed, nine expected local PostgreSQL-environment skips and zero
  failures (1,138 total);
- syntax checks for affected JavaScript modules and `git diff --check`.

The first-head `POD integration gates` run `42033683186` (run number 1057), job
`127266211501`, failed only at the pre-existing fixture-readiness bound; the new
R474 tests passed. First-head `POD container runtime gates` run `42033683237`
(run number 534), job `127266210867`, passed. The final exact-head `POD
integration gates` run `42034705330` (run number 1058), job `127269708761`,
passed the full Node/PostgreSQL, Python/OpenCV, stored-task end-to-end, syntax,
workflow-control and review-guard sequence. Final exact-head `POD container
runtime gates` run `42034705385` (run number 535), job `127269709721`, passed
image build, non-root dependency probes, Python rendering QA, Node/PostgreSQL,
real print/review generation and disabled-startup checks.

Money Factory PR 429 changed only the immutable Content Control workflow pin to
the merged revision above, from exact base
`04b6e09396cec4fcac63146fbfb8f300658dedc4`. Its local POD suite passed 81
tests with five expected environment skips. Exact pin head
`bbe4f0805111aadd75481607da357d7bcbbf2135` passed `POD cross-repository
review verification` run `42035812973` (run number 431), job `127273542693`,
including every pinned Content Control Node/Python/KDP group and the Money
Factory Node/Python agent suites. PR 429 was squash-merged as
`a04483cbcf8200c0f90e08bcf30a0e3b418b0e00`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`dc496044297ce55256df7f4fff79bd6a1ca93f3b`, built it successfully and made
deploy `dep-dbm87iavcj2c738870og` live. Build-ended event
`evt-dbm887oujcmc73d2eb20` and deploy-ended event
`evt-dbm88ftah0ms73eehd80` record success on the authorized free service
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
shutdown and pool-retention gap in the optional outbox path only. It does not
establish an independently retained database backup, close the storage-expiry
boundary, mount and authenticate live Money Factory authority, provide current
grants or revocation evidence, configure owner-authorized marketplace accounts,
establish authorized intelligence or regional rights, accept generation,
official templates, KDP manuscripts/editorial/preview output, independent QA or
verified remediation, demonstrate authorized submit/readback on KDP, Redbubble,
TeePublic, Zazzle and Spreadshirt, reconcile actual economics or provider
statements, demonstrate production mobile operations, alerts, security or
measured 100/1,000-per-day capacity, complete an authorized end-to-end
marketplace job, or grant controlled launch approval. Publication remains held
for explicit approval after every acceptance requirement is satisfied. Etsy
remains excluded.

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
