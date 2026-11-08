# R507: fail diagnostics when client release is unverified

Current CC main9122e69f893af87cf23f7df34e92b441891505be and MF
main0f4fd6397861924f69c95adaaca5134667afd807, current acceptance/status/free
deployment guides, open PRs and workflows were reconciled. No duplicate POD work
was open; latest POD gates passed. Unrelated MF monitor/browser failures are not
POD acceptance and were not weakened or reported passed. Concurrent work remains.

Authorized existing free Docker/main Render service is unsuspended, one instance,
automatic commit deployment, /health. Latest functional3900103fc3642ef0fa0cb5058eaa9ffc75f7df4d
is live as dep-dbn4d3gae00c739lf1og. No settings or credentials were changed.

## Confirmed defect and repair

Metrics previously ignored the promise returned by client.release. An asynchronous
release rejection or stall could therefore return successful metrics; a rejected
late-client destruction could be unhandled. Six new cases yielded27 pass/4 fail
against baseline (31 total), safely consuming fixture rejections to avoid process
noise. The four failures reproduce false success or missing late-rejection handling.

Metrics now initiate release even after cancellation and consume its rejection,
then await it only within the existing shared diagnostic deadline. Failed or
unsettled cleanup cannot return a successful report. Late acquisition destruction
consumes both synchronous and asynchronous cleanup errors. Existing transaction,
rollback, expiry, read-only SQL and discard decisions remain unchanged. Manual
snapshot tests verify owned-pool shutdown still runs after client-release failures.
No new activation, mutation, credentials, signing or publication capability added.

Final focused health suite passed31/31 with no skips; syntax and whitespace pass.
Full local Node passed1,223 with nine expected environment skips (1,232 total),
zero failures. MF local POD bridge passed279 Node with one database skip (280
total) and all81 Python tests. A standalone stalled-release snapshot probe returned
POD_DIAGNOSTIC_TIMEOUT after40,009ms and attempted pool shutdown exactly once;
no test-runner handle kept it alive. This is bounded receipt evidence, not proof
underlying remote I/O is stopped. Full local Python passed all385 tests in274.274
seconds; hostile-annotation MuPDF warnings were not test failures. Hosted and
dependent pin results follow below. Remote commits are based on fresh main and
changed blobs checked exactly; no whole-tree equivalence is
claimed for a local source tree lacking unrelated prior QA/ledger outputs.

## Hosted verification and dependent pin

[CC PR1136](https://github.com/wecreates/content-control/pull/1136), exact head
fc33641057815cc4ae1d400275e18209ab292ed8, passed integration
[42298476975](https://github.com/wecreates/content-control/actions/runs/42298476975),
job128169782070, and container
[42298477103](https://github.com/wecreates/content-control/actions/runs/42298477103),
job128169782324. Both passed all1,232 Node/PostgreSQL tests without skips and all385
Python tests, plus durable E2E; container startup also passed. Fresh unchanged
main/head and mergeability checks preceded guarded squash merge
20175c25a8ca26f44b1e3467f0d79d0283a304fc. All three changed blobs match local.

[MF PR464](https://github.com/wecreates/Money-factory/pull/464) pins that consumer;
the existing health step already runs the expanded31-test suite. Only checkout
ref changes; remote old workflow hash checked before editing. New workflow blob
ef21cc91e6717ddbe76ace02b7f358b447b98354 matches local. Both publication flags
remain literal false. Concurrent browser/monitor source and output changes remain.
Exact head96c7bce6ff292d9062c4f52248f1ef8163485260 passed cross-repository
[42299865826](https://github.com/wecreates/Money-factory/actions/runs/42299865826),
job128174542672:898 selected CC Node tests,31 health/lifecycle tests,280 MF
Node/PostgreSQL tests, selected CC Python stages and81 MF Python tests, zero
failures/skips. Fresh unchanged main/head and mergeability checks preceded guarded
squash merge3e798635969472455375d6d73cb1d9be249356d0.

## Live deployment evidence

Automatic deploy dep-dbn4mj4s728c73ecqfc0 of exact functional merge
20175c25a8ca26f44b1e3467f0d79d0283a304fc reached live at
2026-11-06T21:49:53.468061Z. No duplicate rollout or configuration change occurred.
The connected local-browser tool returned Unknown tool; cloud-browser public
observations independently showed /api/print/status service/production/outbox
DISABLED, publication_enabled=false, publication_requested=false,
adapters_verified=false and scoped storage acceptance_verified=false. Configured
cutoff remains December1, not provider-retention proof. /health showed alive=true,
production_approved=false and publication=false, with evidence readiness separate.
No key was entered. No protected metric, job, database, grant or marketplace was
accessed. This is public rollout evidence, not an authenticated live release-failure
probe, owner-phone acceptance or verified evidence readiness.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. Fixtures, merged code and liveness are
not live database/grant/account/rights/QA/adapter/economics/capacity/owner-phone
acceptance. No changed database-admin access path was found; that failure was not
retried. Etsy excluded. Both publication flags remain false. No paid resource,
purchase, secret disclosure, social-vault access, network widening or fabricated
approval. Per-run execution is not a continuously running self-hosted worker.
Completion condition remains unmet; automation stays enabled.
