# POD run receipt r222 — fresh-grant final clock boundary

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`6d507404624daa98290641feb2bca78ccb70a8e5`; Money Factory started from
`842d094205a50935422243d7abf97f650fe0fb90`. Current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were unrelated draft video/offline-integration work or the
excluded Etsy lane; none overlapped this POD authority repair. The previously
failed database-administration path had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state
was created or changed.

## Repair and regression evidence

Content Control's fresh-grant client verified the signed authority envelope
with one valid wall-clock value, then used a second unchecked `Date.now()` value
for its 30-second remaining-lifetime gate. If that second read became `NaN`, the
comparison evaluated false and the client returned the grant. A rollback before
the signed `issued_at_ms` also passed. The pre-fix reproduction recorded
`PRE_FIX_ACCEPTED_INVALID_FINAL_CLOCK job clock_calls=2`.

[Content Control PR 542](https://github.com/wecreates/content-control/pull/542)
now requires the final clock read to be a nonnegative safe integer at or after
the signed issuance time before evaluating remaining lifetime. Invalid or
pre-issuance rollback values fail closed as `GRANT_CLOCK_INVALID`; revocation,
scope, signature, expiry and the existing shared request deadline remain in
force. This does not create or renew authority and does not enable production or
publication.

The exact remote PR head
`b3c8f10ba0a39060bd4fb2029a0baa338f1bc773` had tree
`25b71b1e3f4322f28236ec02b762fba259bd0c7a`; the production client blob was
`57e3dcce0f79818e8f41b30753db671cf68e60e1` and the regression blob was
`87f387ae33b83d9fe562caefad8d09eebe809cbe`.

The focused grant/HTTP bridge suite passed 47 tests. The dependency-free local
Node POD suite passed 684 tests with two expected database-only skips and zero
failures. The KDP book-bounds Python suite passed all 93 tests. Six local
PostgreSQL/Express-backed files and two OpenCV-dependent Python modules were not
counted as passing in the clean worktree because those dependencies were not
installed. Exact-head hosted integration run
[40057027697](https://github.com/wecreates/content-control/actions/runs/40057027697),
job 120762152557, and container run
[40057027676](https://github.com/wecreates/content-control/actions/runs/40057027676),
job 120762152102, both passed. The hosted evidence includes disposable
PostgreSQL, the full Node/Python suites, print/recovery checks, the exact Docker
image and startup with production and publication disabled. PR 542 was
squash-merged as `1282452378fbf61657ca6c4e4d23a614f303c6d8` after remote
main remained at the reviewed base.

## Dependent Money Factory verification

[Money Factory PR 177](https://github.com/wecreates/Money-factory/pull/177)
pinned the cross-repository verifier to Content Control merge
`1282452378fbf61657ca6c4e4d23a614f303c6d8`. Its exact remote head
`6e61370616f9a1be72496f96624342d1e6c8a042` had tree
`c1e20d4855d2fc4d130b138c3b733c5997e60dac` and workflow blob
`85ac0403113202df2ec266388fd4ca363843242e`. Local dependent verification
passed 110 Node tests with one expected PostgreSQL-only skip and 81 Python
tests. Exact-head hosted run
[40057473182](https://github.com/wecreates/Money-factory/actions/runs/40057473182),
job 120763532137, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, KDP/editorial, Node, Python and package-contract
gates. PR 177 was squash-merged as
`55dd1d419003c27b3dab74359cccc6075587660c` after remote Money Factory main
remained at the reviewed base. Both workflow publication flags remain `false`.

## Render and acceptance state

The authorized Render service remained an unsuspended free-plan Docker web
service on `main`, one instance, commit-triggered auto-deploy and `/health`.
Render detected Content Control merge
`1282452378fbf61657ca6c4e4d23a614f303c6d8` and created deployment
`dep-dbe24evlot8c73bahms0`. Deploy-started event
`evt-dbe24f40a7sc7398mob0` occurred at 2026-10-24T03:13:00.193006Z;
`pipeline_minutes_exhausted` event `evt-dbe24f0k84hc73efo8a0` followed at
03:13:00.251470Z; deploy-ended event `evt-dbe24f40a7sc7398moc0` recorded failed
status at 03:13:00.639477Z. No application build or rollout occurred. No manual
retry, purchase, plan/cache change, replacement service, secret access or
network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one fresh-grant clock
boundary only; merged code and hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
