# R504: key-free read-only storage check in operations dashboard

CC began at 2116b990e0b24688bbc5f80cb1a896ee7a994c0e; MF at
e73f81aa5c350f3b6ca50d2773d88f4b47b09d73. Current checklist/status/free-deployment
guides, open PRs, workflows and authorized Render service were inspected. Existing
free service was live on db8aa0feb4debf5ff9fce967417e3f1feeba850f, deploy
dep-dbn1r80l69ns73e2a0v0. Narration Transcription Gate failures are outside this
POD lane; no unrelated failure guard or draft was changed. No duplicate POD job
or PR was found.

## Delivered behavior

The configured cutoff was visible in the public JSON API but not the operations
page. The dashboard now has an explicit Check storage cutoff control needing no
operations key. It uses only the existing public GET status endpoint, omits
authorization/cookies, bounds response bytes to 8 KiB and reuses the 30-second
request deadline. Only known labels, scoped unverified evidence and a canonical
UTC cutoff are rendered as text. Malformed/approval-claiming/error responses show
unavailable. A valid configured window is explicitly not storage acceptance.

Checking clears protected panels; session clearing/key change/page exit abort
pending checks and prevent late repaint. Preview and protected operations retain
their existing authentication and limits. There is no activation/publication
button, mutation, credential persistence, database access or provider access.

Tests cover key-free credentialless fetch, scope/date/status validation, warning
states, hostile markup, response-size and error redaction, stale session repaint,
and stalled headers/bodies. Exact local/hosted/rollout results are recorded in the
PR and final receipt update. This is new operations capability, not a claimed
baseline-red defect.

## Local verification

The final dashboard suite passed 33/33. The complete final Node suite passed
1,210 tests with 9 expected environment skips (1,219 total), zero failures.
The full Python OCR/rendering suite passed 385 tests in 361.220 seconds; MuPDF
printed warnings for hostile annotation fixtures, not test failures. Syntax and
whitespace checks passed. All five changed blobs matched the remote candidate;
the local worktree lacks only unrelated concurrent QA/ledger output changes,
which the remote tree preserves. No whole-tree equivalence is claimed.

Money Factory bridge checks against this consumer passed 279 Node tests with
one expected database skip (280 total), and all 81 Python tests. These checks
are fixtures, not live authority, financial, marketplace or throughput acceptance.

## Hosted and merge evidence

[CC PR1130](https://github.com/wecreates/content-control/pull/1130), head
9f73330097d9bcc9a2c152223bcfe3dc994c40da, passed integration
[42274895623](https://github.com/wecreates/content-control/actions/runs/42274895623),
job 128088580949: all 1,219 Node/PostgreSQL tests, all 385 Python tests,
durable production E2E, server syntax, workflow control and all four free-review
guards passed. No hosted Node skips. Production-image
[42274895670](https://github.com/wecreates/content-control/actions/runs/42274895670),
job 128088581257, also passed all 385 Python and 1,219 Node/PostgreSQL tests
without skips, plus container startup and durable E2E checks. Fresh unchanged base/head and mergeability checks
preceded guarded squash merge 3a052f4f6e53386255c7dd1cfa66a91c7d846f41.

[MF PR459](https://github.com/wecreates/Money-factory/pull/459) changes only the
consumer checkout pin to that CC merge, preserving both literal false publication
flags and concurrent monitoring outputs. Its exact remote workflow blob matches
the locally checked file (f690bcbe99dae64bd9e7096792030a88e359ea5e).
Exact head 7643390c9751083a9e42b0021210d1fd53cff322 passed hosted cross-repository
[42276734532](https://github.com/wecreates/Money-factory/actions/runs/42276734532),
job 128094849662: 896 selected CC Node contracts, 280 MF Node/PostgreSQL tests,
all selected CC Python stages and all 81 MF Python tests passed without skips.
Fresh unchanged main/head and mergeability were checked before
guarded squash merge 332d5459d279e3bbb83e19b3e76cc338d2301362. The tested CC
consumer pin and literal false publication flags remain unchanged at merge.

## Live deployment and browser evidence

Existing authorized service srv-darsdb8u01pc73dn4i2g in workspace
tea-darsafojo6nc739844hg retained free Docker/main, one instance, /health and
automatic commit deployment. No duplicate rollout was triggered. Automatic deploy
dep-dbn2a7942hec73fdnlb0 of exact CC merge 3a052f4f6e53386255c7dd1cfa66a91c7d846f41
reached live at 2026-11-06T19:07:17.311265Z.

The connected local-browser tool was unavailable (Unknown tool); the available
cloud browser was used only for the independent deployed public UI check. Initial
free-host wake-up interstitial cleared on reload. With the Operations key blank,
clicking Check storage cutoff visibly rendered “Within configured window · Cutoff
(UTC): 2026-12-01T00:00:00.000Z · Storage acceptance remains unverified.” The
configuration-only disclaimer remained visible. Clear session restored the initial
prompt; rechecking produced the same unverified display. No key was supplied and
no protected job, preview, database, grant or marketplace was accessed.

The public /api/print/status page independently showed service/production/outbox
DISABLED, publication_enabled=false, publication_requested=false,
adapters_verified=false and scoped storage acceptance_verified=false. /health
showed alive=true, production_approved=false and publication=false with readiness
separate at /readyz. This is cloud-browser deployment evidence, not owner-phone
acceptance, green evidence readiness or continuous operation.

## Unfinished acceptance

All 24 live acceptance areas remain OPEN, including actual owner-phone acceptance.
Automated browser/fixture evidence is not the owner's mobile acceptance or proof
of retention/recovery, real grants/rights/QA/adapters/capacity/end-to-end jobs.
The failed database-administration path has not changed and was not retried.
Etsy is excluded; both publication flags remain false. No paid resource, purchase,
secret disclosure, social-vault access, widened network or continuous worker claim.

The automation remains enabled because the 24-area completion condition is not
met. Scheduled runs execute only with available per-run tools; this receipt does
not imply a continuously running self-hosted worker. Continue from the current
checklist and fresh heads; do not duplicate this completed dashboard/pin rollout
or retry unchanged database-administration failures.
