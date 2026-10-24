# POD run receipt r223 — encoded-byte authority-key isolation

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`3e5ba24b5a539c233065d65083e7394063b92852`; Money Factory started from
`55dd1d419003c27b3dab74359cccc6075587660c`. Current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were unrelated draft video/offline-integration work or the
excluded Etsy lane; none overlapped this POD authority repair. The previously
failed database-administration path had no credible access change and was not
retried. No resource, credential, account, network rule or marketplace state
was created or changed.

## Repair and regression evidence

Both direct grant-transport constructors required the Bearer authentication
secret and HMAC signing secret to differ, but compared JavaScript strings
rather than the UTF-8 bytes actually used by HTTP and HMAC. Distinct strings
containing repeated unpaired surrogates therefore encoded to the same 33-byte
replacement-character sequence and were accepted. The pre-fix reproduction on
both current mains recorded `PRE_FIX_ACCEPTED_BYTE_EQUAL_KEYS`.

[Content Control PR 544](https://github.com/wecreates/content-control/pull/544)
now compares the encoded secret bytes in the grant client and rejects equality
as `GRANT_AUTHORITY_INVALID`. Its exact remote head
`faf99a39dc679dd2dd127403af9f129b7fb20dbb` had tree
`6520544b0dcc40775de0e84a5a03b45538bdb3b8`; the production client blob was
`b15553b512ecfc858a9276813c370d79270d5d61` and regression blob was
`bc84fce61777ee2ab4dce2b53ccc9afb8d32770c`.

The focused grant/HTTP bridge suite passed 47 tests. The dependency-free local
Node POD suite passed 684 tests with two expected database-only skips and zero
failures. The KDP book-bounds Python suite passed all 93 tests. Exact-head
hosted integration run
[40059858830](https://github.com/wecreates/content-control/actions/runs/40059858830),
job 120770813963, and container run
[40059858831](https://github.com/wecreates/content-control/actions/runs/40059858831),
job 120770813699, both passed. The hosted evidence includes disposable
PostgreSQL, full Node/Python suites, print/recovery checks, the exact Docker
image and startup with production and publication disabled. PR 544 was
squash-merged as `99e4e3f9f8bbecfb5d11f71735ceb29941005792` only after
both exact-head gates passed.

## Dependent Money Factory verification

[Money Factory PR 178](https://github.com/wecreates/Money-factory/pull/178)
applies the same encoded-byte isolation at the authority server boundary,
rejecting equality as `AUTHORITY_CONFIG_INVALID`, and pins the
cross-repository verifier to Content Control merge
`99e4e3f9f8bbecfb5d11f71735ceb29941005792`. Its exact remote head
`e6472e83dbdaee0e19ebb1f493c5e75c5e4c0e84` had tree
`d055ae299d932f127a01179c1f318ba912d1e591`; the production-handler blob was
`fdb6030e9993f606297df64f470756ee22e25daa`, regression blob was
`5ae48f405aa340ae94ffb38d4f495e3b7fd7c7e6`, and workflow blob was
`c41eef8cb999c3132f65be32c8fa8065f4595f17`.

Local dependent verification passed 111 Node tests with one expected
PostgreSQL-only skip and all 81 Python tests. Exact-head hosted run
[40060350270](https://github.com/wecreates/Money-factory/actions/runs/40060350270),
job 120772281878, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, KDP/editorial, Node, Python and package-contract
gates. PR 178 was squash-merged as
`9de5236de687cc6dbef98d61326ca931599f6633`. Both workflow publication flags
remain `false`.

## Render and acceptance state

The authorized Render service remained an unsuspended free-plan Docker web
service on `main`, one instance, commit-triggered auto-deploy and `/health`.
Render detected Content Control merge
`99e4e3f9f8bbecfb5d11f71735ceb29941005792` and created deployment
`dep-dbe2oi0473hc73bmd5q0`. Deploy-started event
`evt-dbe2oie4uq4c739mc0m0` occurred at 2026-10-24T03:55:53.232841Z;
`pipeline_minutes_exhausted` event `evt-dbe2oic0a7sc73994bb0` followed at
03:55:53.339845Z; deploy-ended event `evt-dbe2oic0a7sc73994bd0` recorded
failed status at 03:55:53.651958Z. No application build or rollout occurred. No
manual retry, purchase, plan/cache change, replacement service, secret access
or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authority-key
isolation boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
