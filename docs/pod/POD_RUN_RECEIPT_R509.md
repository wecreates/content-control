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

## Unfinished acceptance

All24 live acceptance areas remain OPEN. No new live database/grant/account/rights,
QA/adapter/economics/recovery/capacity or owner-phone acceptance is claimed.
No changed database-admin path was found, so that failed path was not retried.
Etsy excluded; both publication flags stay false. No paid resource, purchase,
secret disclosure, social-vault access, network widening or fabricated approval.
Per-run tools do not imply a continuous self-hosted worker. Completion condition
is unmet; automation remains enabled.
