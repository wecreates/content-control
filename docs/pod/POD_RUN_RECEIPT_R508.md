# R508: current expiry alerts after diagnostic cleanup

Fresh CC mainbefee394ee0a0f2033a48a9c2191e060fb0f7eba and MF
main3e798635969472455375d6d73cb1d9be249356d0 were reconciled with current
checklist/status/free-deployment guides, open PRs and workflows. No duplicate POD
job or PR exists. Latest POD gates passed; unrelated MF monitor/browser failures
were not weakened or reported passed. All concurrent work is preserved.

Authorized existing free Docker/main service remains unsuspended, one instance,
/health, automatic commit deployment. Latest live functional revision is
20175c25a8ca26f44b1e3467f0d79d0283a304fc, deploy dep-dbn4mj4s728c73ecqfc0.
No environment, credential, network or activation setting was changed.

## Confirmed defect and repair

Storage health was calculated before COMMIT and release, and manual snapshots
returned that health after owned-pool shutdown. Delays at those boundaries could
cross the 24-hour blocking threshold or actual expiry while returning stale alerts.
Nine new regressions all fail baseline (31 existing pass,9 fail): two expiry
boundaries and an invalid final clock at each of commit/release/pool shutdown.

Metrics preserve pre-commit validation, then recompute time-sensitive health after
successful commit and client release. Manual snapshots recompute it again after
owned-pool shutdown. Exact queue/financial/storage counts remain the original
read-only transaction snapshot, not a claimed new database observation. Final
invalid clocks reject with the existing fixed code. Earlier failures cannot be
turned into a successful report. No write, approval, production or publication
capability is added; diagnostic scope and acceptance_verified=false are unchanged.

Focused operational-health suite passed40/40 after repair, zero skips. Syntax and
whitespace pass. Full local Node passed1,232 with nine expected environment skips
(1,241 total), zero failures. MF local POD bridge passed279 Node with one expected
database skip (280 total), and all81 Python. Full Python/hosted, dependent pin and
rollout evidence follow below.
Full local Python passed all385 tests in236.890 seconds; hostile-annotation MuPDF
warnings were not failures.
Remote trees use fresh main, preserving unrelated QA/ledger outputs absent only
from the local source worktree. Changed blobs are checked exactly, not whole trees.

## Hosted verification and dependent pin

[CC PR1138](https://github.com/wecreates/content-control/pull/1138), exact head
2d2ba6103de419322a5ca8a2ea2e1a5f7aad2141, passed integration
[42306212598](https://github.com/wecreates/content-control/actions/runs/42306212598),
job128196059046, and container
[42306212610](https://github.com/wecreates/content-control/actions/runs/42306212610),
job128196059176. Both passed all1,241 Node/PostgreSQL tests without skips and all385
Python tests, plus durable E2E; container startup also passed. Fresh unchanged
main/head and mergeability checks preceded guarded squash merge
35a22d35af1e453914b406aa5e044a771fde0f1b. All four changed blobs match local.

[MF PR465](https://github.com/wecreates/Money-factory/pull/465) pins that consumer;
the existing health step already exercises the expanded40-test suite. Only checkout
ref changes; old remote workflow hash was checked before editing. New workflow blob
0198f15fbe02378e65e4c4c1ff6abc55e8788ab7 matches local. Both publication flags
remain literal false; all unrelated browser/monitor source and outputs preserved.
Exact headf9e45b1fab66820e8c4e6def5dab3d251dbd642a passed cross-repository
[42307190166](https://github.com/wecreates/Money-factory/actions/runs/42307190166),
job128199384669:898 selected CC Node tests,40 health tests,280 MF Node/PostgreSQL,
all selected CC Python stages and81 MF Python tests, zero failures/skips.
Fresh unchanged base/head and mergeability checks preceded guarded squash merge
5f6f486dff0270514c54c1d28f924bdc5058c739.

## Live rollout evidence

Automatic deploy dep-dbn5h6p42hec73fijse0 of exact functional merge
35a22d35af1e453914b406aa5e044a771fde0f1b reached live at
2026-11-06T22:47:04.343634Z. No duplicate deployment or setting change was made.
The local-browser tool returned Unknown tool; independent public cloud-browser
/api/print/status showed service/production/outbox DISABLED,
publication_enabled=false, publication_requested=false, adapters_verified=false
and scoped storage acceptance_verified=false. The configured cutoff remains
December1, not provider-retention proof. /health showed alive=true,
production_approved=false and publication=false; evidence readiness stays separate.
No key was entered and no protected metric, job, database, grant or marketplace
was accessed. This is public rollout evidence, not a live authenticated expiry
boundary test, accepted production readiness or actual owner-phone acceptance.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Expiry observations, fixture QA and
liveness do not prove live database authority, rights/grants, adapters, revenue,
recovery, measured capacity or owner-phone acceptance. No changed database-admin
access path was found, so that failed path was not retried. Etsy is excluded.
Both publication flags remain false. No paid resource, purchase, secret disclosure,
social-vault access, network widening or invented approval. Per-run execution
does not imply a continuous self-hosted worker. Automation remains enabled because
the completion condition is unmet.
