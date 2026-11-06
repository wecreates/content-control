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
whitespace pass. Full local/hosted, dependent pin and rollout evidence follow below.
Remote trees use fresh main, preserving unrelated QA/ledger outputs absent only
from the local source worktree. Changed blobs are checked exactly, not whole trees.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Expiry observations, fixture QA and
liveness do not prove live database authority, rights/grants, adapters, revenue,
recovery, measured capacity or owner-phone acceptance. No changed database-admin
access path was found, so that failed path was not retried. Etsy is excluded.
Both publication flags remain false. No paid resource, purchase, secret disclosure,
social-vault access, network widening or invented approval. Per-run execution
does not imply a continuous self-hosted worker. Automation remains enabled because
the completion condition is unmet.
