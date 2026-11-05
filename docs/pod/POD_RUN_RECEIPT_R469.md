# POD run receipt R469

Date: 2026-11-05 UTC (2026-11-05 America/Los_Angeles)

## Reconciled starting state

- Money Factory `main` was `88e120ee0a9b7b5cbe4624cd76b4417d30670918`,
  the R468 authority request-admission repair.
- Content Control `main` was `d4bcd59ed58ba11da6fd637ef99452f4c669488b`,
  a concurrent accepted-candidate rollback-ledger update layered after the R468
  receipt and watchdog evidence. That work was preserved.
- No later commit, overlapping POD/KDP pull request or duplicate R469 job existed.
  Existing unrelated draft pull requests and excluded Etsy work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` were reread. All 24 areas still require attributable
  live acceptance evidence; code and tests alone do not complete them.

## Confirmed defect and repair

The Money Factory event receiver bounded request bodies and unresolved PostgreSQL
connection acquisition, and installed server-side lock and statement timeouts after
opening a transaction. It did not bound a query promise after a client had been
acquired. A broken client or network path could therefore leave a query promise,
the HTTP request-admission lease and the transaction unsettled indefinitely.
Thirty-two such stalls could permanently saturate the receiver. PostgreSQL's
server-side timeouts cannot settle a client promise when the connection path itself
is broken.

The expected-red regression completed its 100 ms observation window on the prior
implementation with the handler still unsettled. Its only test failed because the
receiver had not returned by the required transaction deadline.

Money Factory PR 424 applies one monotonic deadline across the complete authenticated
inbox transaction. The default is 15 seconds and the validated maximum is 30 seconds.
Every `BEGIN`, deadline setup, insert, readback and `COMMIT` shares that same budget.
A timeout is privately identified, exposed only as the existing redacted retryable
HTTP 503, and forces the uncertain client to be destroyed without further SQL.
Handler admission is released after settlement, allowing a healthy retry. Invalid
direct and HTTP configuration is rejected before connection work. Ordinary domain
rejections still use the existing bounded rollback path.

The focused five-file diff contained only the receiver deadline, configuration
validation and regression coverage. Review found no material correctness, security,
compatibility or missing-test issue. Exact PR head
`8cf667910289d84fc043b788a485e6178769b22e` was cleanly mergeable on the
reconciled Money Factory base and was squash-merged under the standing authorization
as `6fba073913b4f76f85ea7f9936b539ea08c908cb`.

## Verification evidence

Local verification against the reconciled Content Control checkout:

- expected-red transaction-stall regression: 1 test failed because the prior
  handler remained unsettled after 100 ms;
- repaired focused receiver/configuration suite: 62 total, 61 passed and the
  PostgreSQL-only test skipped because no disposable local database URL was supplied;
- full Money Factory POD Node suite: 268 total, 267 passed, 1 PostgreSQL-only local
  skip and 0 failures;
- Money Factory POD Python suite: all 81 tests passed; and
- `git diff --check`: passed.

Exact-head hosted workflow `POD cross-repository review verification`, run
`41994706570` (run number 426), job `127134975104`, completed successfully.
Every reported step succeeded. Hosted logs recorded all 825 pinned Content Control
Node tests passed; the pinned Content Control Python/KDP groups of 34, 23, 40, 28,
28, 93, 5, 6 and 23 tests passed; all 268 Money Factory Node/PostgreSQL tests passed
with no failures or skips against disposable PostgreSQL 18, including the new
transaction-stall regression; and all 81 Money Factory bridge Python tests passed.

The hosted environment recorded `PUBLICATION_ENABLED: false` and
`POD_PUBLICATION_ENABLED: false` throughout. The merged workflow retains both
literal false values.

## Live service observation

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg` remained an
unsuspended, one-instance, free-plan Docker web service with auto-deploy enabled.
Deploy `dep-dbm3135petos738pddeg` completed `live` on Content Control revision
`d4bcd59ed58ba11da6fd637ef99452f4c669488b` and deactivated the earlier state-only
deploys.

This proves rollout liveness for that exact Content Control revision only. The
current report-only `state/live-deployment-health.json` still records `FAIL`, an
incomplete probe and false readiness checks. The live Content Control service does
not contain or validate the separate Money Factory receiver repair. The available
Render connector verified service/deploy state but did not independently verify a
green `/readyz` response. This documentation-only R469 receipt uses `[skip render]`
and must not trigger another deployment.

## Remaining boundaries and execution limits

All 24 live acceptance areas remain **OPEN**. This repair establishes a bounded
authenticated Money Factory event transaction only. It does not create or validate
the dedicated live database, prove durable storage and independent recovery, mount
and authenticate the live Money Factory authority, provide current grants/revocation
or marketplace account records, supply authorized intelligence and regional rights,
establish accepted generation, official templates, KDP editorial/preview evidence,
independent QA or verified remediation, demonstrate authorized submission and
readback on KDP, Redbubble, TeePublic, Zazzle and Spreadshirt, reconcile actual
economics or financial statements, demonstrate mobile operations and monitoring in
production, measure production capacity, complete an authorized end-to-end job, or
grant controlled launch approval. Publication remains held for explicit approval
after every acceptance requirement is satisfied. Etsy remains excluded.

Database administration was not retried because this run had no credible changed
access path after the previously recorded connector and browser failures. The run
used only its actually available repository, hosted workflow and authorized Render
inspection capabilities; it did not have a continuously running self-hosted worker,
database shell, marketplace session or authority to widen network access. It did not
use or disclose credentials, contact anyone, purchase resources, access the social
vault, evade bot detection, or enable production or publication.

Useful unblocked work remains, so the automation stays enabled. It must be disabled
only after all 24 acceptance areas are verifiably complete with publication still
held for explicit approval.
