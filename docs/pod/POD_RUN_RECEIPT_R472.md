# POD run receipt R472

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Content Control `main` was
  `e96fb30a7bd11f0ce0b87daa0657f7fd4972ff2f`, the R471 skipped-deploy
  evidence merge.
- Money Factory `main` was
  `a476f186320af02dff1eeec29434a99876e775c2`, the R471 exact Content
  Control pin.
- The open pull requests in both repositories were reread. They were older,
  unrelated draft/review lanes; none duplicated this archive cancellation
  repair. Etsy pull requests were excluded from this lane. Fresh worktrees were
  created from the exact starting heads and older worktrees were left intact.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 acceptance areas still require
  attributable live evidence; implementation and tests alone do not complete
  them.

## Confirmed defect and repair

The artifact-only and complete-state export functions accepted cancellation
signals, but awaited pool acquisition and database driver promises directly.
Their checkpoints ran only between waits. Cancellation during a stalled pool
acquisition or query therefore left the export pending and could retain one of
the production pool slots indefinitely.

Regression-only execution of both new cases reached the selected stalled
database boundary and did not settle on the prior implementation. Each test
process required its external three-second bound. This reproduced the missing
responsive cancellation path without describing an ordinary assertion failure.

Content Control PR 1042 adds a shared wait helper which preserves the exact
abort reason, consumes late promise settlement, destroys a client acquired after
cancellation and destroys a client whose query transport state is uncertain.
Ordinary database errors retain the existing rollback behavior. `COMMIT` still
settles under the transaction's existing ten-second PostgreSQL statement timeout
so its outcome is known before cancellation is applied at the following
checkpoint. The five-file change is limited to the helper, the two export paths
and their regressions.

Exact PR head `1da7fc878e6d0ab36b57d1bfd22ee8ebf40d6714` was verified and
squash-merged under the standing authorization as
`9fddc14ef236a22ca6597d5edfde4b0775fb216b`.

## Verification evidence

Local verification recorded:

- both archive suites: all 128 tests passed;
- full Content Control POD Node suite: 1,121 passed, nine expected local
  PostgreSQL-environment skips and zero failures;
- syntax checks for every affected module; and
- `git diff --check`.

Exact-head hosted `POD integration gates` run `42014657867` (run number 1053),
job `127202033885`, passed all 1,130 Node/PostgreSQL 18 tests, all 385
Python/OpenCV tests, the stored-task production end-to-end test, syntax,
workflow-control and four review-guard tests. Exact-head `POD container runtime
gates` run `42014657648` (run number 532), job `127202032984`, passed image
build and non-root dependency probes, all 385 Python QA/rendering tests, all
1,130 Node/PostgreSQL tests, stored-task production end-to-end, print/review and
disabled-startup checks. Its final smoke result recorded
`publication_enabled=false`, `production_status=DISABLED` and
`outbox_status=DISABLED`.

Money Factory PR 427 advanced only the immutable Content Control workflow pin
to the merged revision above. Exact pin head
`e3abb625d77515dd0ee8f1fc6a7ec1db6ea71921` passed `POD
cross-repository review verification` run `42015826426` (run number 429), job
`127206000974`: all 827 pinned Content Control Node tests, the Python/KDP groups
of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests, all 274 Money Factory Node tests
and all 81 Money Factory Python tests passed with no failure. PR 427 was
squash-merged as `dffc881ac68d3082fbd47a215cd6a76125cffab3`.

Every hosted stage retained `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false`. Neither repository change enables production,
outbox delivery or publication.

## Live service observation

Render detected functional Content Control merge
`9fddc14ef236a22ca6597d5edfde4b0775fb216b`, built it successfully and made
deploy `dep-dbm64javcj2c73859tbg` live. Deploy-ended event
`evt-dbm656dpetos738ru62g` records success at
2026-11-05T11:03:53.838836Z on the authorized free service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Direct unauthenticated probes after rollout returned:

- `/health`: HTTP 200, `alive=true`, `production_approved=false` and
  `publication=false`;
- `/livez`: HTTP 200 with the same production/publication holds; and
- `/readyz`: HTTP 503, with GREEN QA and matching expected/actual SHA-256
  `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`,
  but `captionReady=false`, `production_approved=false` and
  `publication=false`.

This proves process liveness for the exact merged repair and confirms that the
acceptance readiness gate still fails closed. It does not convert deployment
success into hosting, end-to-end or launch acceptance.

After this documentation receipt merged as
`0689d69cc31e3fea87d440eff2e5b1796be759a7`, Render recorded
`commit_ignored` event `evt-dbm68j2jnfac73d0velg` at
2026-11-05T11:11:08.726494Z. No second deployment started; functional deploy
`dep-dbm64javcj2c73859tbg` remained live on
`9fddc14ef236a22ca6597d5edfde4b0775fb216b`.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair closes one code-level
pool-capacity leak in offline archive export only. It does not establish an
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
