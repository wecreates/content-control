# POD run receipt R471

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `1d695632c59b72d10184c5ecb64abd06210fcff2`, the R470 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `417d40dc15fa4c6f49a97f4b17ae416ba74659c8`, the R470 exact
  configuration-boundary repair.
- No later commit, open pull request or duplicate R471 job existed in either
  repository. Fresh worktrees were created from those exact heads; older
  worktrees and their generated files were left untouched.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 acceptance areas still require
  attributable live evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The authenticated `/api/print/metrics` and `/api/print/capacity` database
transactions configured PostgreSQL lock and statement timeouts, but awaited pool
acquisition and driver promises directly. A stalled pool acquisition or client
promise could therefore retain an HTTP request and one of the two production pool
slots indefinitely without reaching a PostgreSQL timeout.

Regression-only focused execution reached the new stalled diagnostic case after
six passing capacity tests and did not settle. The test process required its
external 30-second bound, reproducing the missing client-side deadline without
claiming an ordinary assertion failure.

Content Control PR 1039 applies one 40-second signal deadline across pool
acquisition, transaction setup, diagnostic queries and commit. A client whose
transport state is indeterminate after deadline expiry is destroyed without a
rollback attempt. A client acquired after its caller has timed out is also
destroyed, and late promise rejection is consumed. Ordinary query failures retain
the existing verified rollback and connection-reuse behavior. The five-file diff
contained only the shared deadline helper, both diagnostic transactions and their
regressions. Review found no material correctness, compatibility, security or
missing-test issue.

Exact PR head `503d383e51af779704e69594a8b306bec9a43c8e` was cleanly
mergeable on the reconciled base and was squash-merged under the standing
authorization as `cd48529cb0480e53fe9a1934242d018405c98741`.

## Verification evidence

Local verification recorded:

- repaired focused suites: all 26 tests passed;
- full Content Control POD Node suite: 1,119 passed, nine expected local
  PostgreSQL-environment skips and zero failures; and
- syntax checks plus `git diff --check`: passed.

Exact-head hosted `POD integration gates` run `42007196655` (run number 1051),
job `127176835956`, passed all 1,128 Node/PostgreSQL 18 tests with no failures
or skips, all 385 Python/OpenCV tests, the stored-task production end-to-end test,
syntax, workflow-control and four review-guard tests. Exact-head `POD container
runtime gates` run `42007196803` (run number 531), job `127176836071`, passed
image build and non-root dependency probes, all 385 Python QA/rendering tests,
all 1,128 Node/PostgreSQL tests, stored-task production end-to-end, print/review
and disabled-startup checks. Its final smoke result recorded
`publication_enabled=false`, `production_status=DISABLED` and
`outbox_status=DISABLED`.

Money Factory PR 426 advanced only the immutable Content Control workflow pin to
the exact merged revision above. Exact pin head
`2850287fe41168c636f3dfa0eb137bb4444d4ac2` passed `POD
cross-repository review verification` run `42008348921` (run number 428), job
`127180721431`: all 825 pinned Content Control Node tests, the Python/KDP groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests, all 274 Money Factory
Node/PostgreSQL tests and all 81 Money Factory Python tests passed with no hosted
skip. PR 426 was squash-merged as
`a476f186320af02dff1eeec29434a99876e775c2`.

Every hosted stage recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Both merged workflows retain those literal
false values.

## Live service observation

Render detected functional Content Control merge
`cd48529cb0480e53fe9a1934242d018405c98741`, built it successfully and made
deploy `dep-dbm5b9avcj2c73849600` live. Deploy-ended event
`evt-dbm5bpoqa4ss73ao4t40` records success at
2026-11-05T10:09:43.696583Z on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Direct unauthenticated probes after rollout returned:

- `/health`: HTTP 200, `alive=true`, `production_approved=false` and
  `publication=false`;
- `/livez`: HTTP 200 with the same production/publication holds; and
- `/readyz`: HTTP 503, with hash-bound GREEN QA but `captionReady=false`,
  `production_approved=false` and `publication=false`.

This proves process liveness for the exact merged revision and confirms that the
acceptance readiness gate still fails closed. It does not turn a successful
rollout into hosting, end-to-end or launch acceptance.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair bounds authenticated
monitoring and measured-activity database capacity only. It does not establish an
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
