# R509: verified cleanup for recorded production activity

Fresh CC main7f482e2ef17d22c83c3360d6030c580293d2bbab and MF
main5f6f486dff0270514c54c1d28f924bdc5058c739 were reconciled with current
checklist/status/free-deployment docs, open PRs and workflows. No duplicate POD
PR or job exists. Unrelated narration/watchdog and MF browser/monitor failures
were not weakened or marked passed. Current POD gates were inspected separately.

CC concurrent changes since the previous receipt affect the review MP4, QA audio,
frames/contact/receipts/history and health/rollback-ledger outputs, not POD source.
Remote commits use fresh main and preserve all those changes. Local source differs
in unrelated media/QA/ledger outputs, so no whole-tree identity is claimed.

Authorized existing free Docker/main Render service remains unsuspended, one
instance, /health, automatic deployment. Latest live ledger revision
7f482e2ef17d22c83c3360d6030c580293d2bbab is dep-dbn6905i0u2s73ccs2v0.
No environment, credential, account, network or activation setting changed.

## Confirmed defect and repair

Recorded productionActivity ignored asynchronous client.release completion,
although metrics had been repaired separately. A failed or stalled release could
still return activity; late-client asynchronous destruction was not consumed.
Five new cases produce8 pass/4 fail against baseline (12 total), with fixture
rejections consumed safely rather than generating unhandled test-process noise.

Activity now initiates release even after cancellation and awaits it only within
the existing diagnostic deadline. A report cannot return before successful cleanup;
late-acquisition destruction consumes synchronous/asynchronous errors. Historical
counts/window, read-only SQL, transaction/discard policy and all explicit false
capacity/acceptance/publication flags remain unchanged. This cannot manufacture
measured100/1,000-concept capacity from recorded history.

Final focused capacity suite passed12/12, zero skips. Syntax and whitespace pass.
Full local/hosted, dependent consumer and rollout evidence follow below. Changed
blobs are checked exactly; tests and code are not live acceptance evidence.
Full local Node passed1,237 with nine expected environment skips (1,246 total),
zero failures. MF local POD bridge passed279 Node with one expected database skip
(280 total), and all81 Python. The existing /capacity router catch maps failures
to fixed POD_CAPACITY_UNAVAILABLE, without backend details.
Full local Python passed all385 tests in236.130 seconds; hostile-annotation MuPDF
warnings were not failures. A workflow-specific fetch URL was unsupported by the
connector; the supported repository-run listing confirmed the latest POD gates.

## Hosted verification and dependent pin

[CC PR1140](https://github.com/wecreates/content-control/pull/1140), exact head
8185b2b6d9338712acc4f33fd77b4609eeeb2b88, passed integration
[42318095765](https://github.com/wecreates/content-control/actions/runs/42318095765),
job128235642267, and container
[42318095790](https://github.com/wecreates/content-control/actions/runs/42318095790),
job128235642534. Both passed all1,246 Node/PostgreSQL tests without skips and all385
Python tests, plus durable E2E; container startup also passed. Fresh unchanged
main/head and mergeability checks preceded guarded squash merge
dbddb961cabeb04a35b62be7ca329ead5bd5717f. All three changed blobs match local.

[MF PR466](https://github.com/wecreates/Money-factory/pull/466) pins that consumer
and adds an explicit12-test capacity step. Only POD workflow changes; prior remote
workflow hash was checked before editing. New blobdea09cf52e51335623c7030aa3989acb9334ce0a
matches local; both publication flags remain literal false. Fresh remote base
c4ba4ed98975cb8708fd3b6e5715ac6071952931 preserves concurrent work rather than
overwriting it with the older local whole tree.
The concurrent MF difference is limited to FREE_MONITOR_EVENTS.json and
FREE_MONITOR_STATE.json; both were preserved from the fresh base.
Exact headef08540a65b99f553145fdf0c7ed811618bd2e67 passed cross-repository
[42318960428](https://github.com/wecreates/Money-factory/actions/runs/42318960428),
job128238539490:898 selected CC Node tests,40 health tests,12 dedicated capacity
tests,280 MF Node/PostgreSQL, selected CC Python stages and81 MF Python tests,
zero failures/skips. Fresh unchanged main/head and mergeability checks preceded
guarded squash mergecd0d91b825a78933529eb96e1202c0133afc6350.

## Live rollout evidence

Automatic deploy dep-dbn73efavr4c73dmng70 of exact functional merge
dbddb961cabeb04a35b62be7ca329ead5bd5717f reached live at
2026-11-07T00:33:59.052409Z. No duplicate rollout or setting change was made.
The local-browser tool returned Unknown tool; independent public cloud-browser
/api/print/status showed service/production/outbox DISABLED,
publication_enabled=false, publication_requested=false, adapters_verified=false
and scoped storage acceptance_verified=false. Configured cutoff remains December1,
not provider-retention proof. /health showed alive=true, production_approved=false
and publication=false, with accepted evidence readiness kept separate.
No key was entered; no protected activity, job, database, grant or marketplace
was accessed. This is public deployment evidence, not a live authenticated release
failure drill, measured capacity or actual owner-phone acceptance.

## Unfinished acceptance

All24 live acceptance areas remain OPEN. No new live database/grant/account/rights,
QA/adapter/economics/recovery/capacity or owner-phone acceptance is claimed.
No changed database-admin path was found, so that failed path was not retried.
Etsy excluded; both publication flags stay false. No paid resource, purchase,
secret disclosure, social-vault access, network widening or fabricated approval.
Per-run tools do not imply a continuous self-hosted worker. Completion condition
is unmet; automation remains enabled.
