# POD run receipt r224 — bounded authority grant transport

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`439fde565d113cfa194ee68d8d1010fba0bc64b9`; Money Factory started from
`9de5236de687cc6dbef98d61326ca931599f6633`. Current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were unrelated draft video/offline-integration work or the
excluded Etsy lane; none overlapped this POD authority transport repair. The
previously failed database-administration path had no credible access change
and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Content Control limits the complete authority response body to 262,144 bytes,
but Money Factory previously placed no bound on the outer signed grant
envelope. A server-loaded snapshot could therefore produce a signed payload
that was individually within the verifier's limit but expanded through outer
JSON escaping beyond the downstream transport limit. The authority returned
HTTP 200 even though Content Control could only reject that response as
`GRANT_TOO_LARGE`. The pre-fix regression reproduced that unusable 200 with a
100,000-character escaped fact value.

[Money Factory PR 179](https://github.com/wecreates/Money-factory/pull/179)
now serializes a successful grant once, verifies that exact outer body is no
larger than 262,144 bytes, and sends those same checked bytes. Oversized
responses fail closed through the existing redacted HTTP 409
`GRANT_BLOCKED` path. This does not truncate, reinterpret or partially deliver
signed authority data.

The exact remote PR head
`c7e15f2fbfc86a4879bdb4f3299bf14d319689c8` had tree
`4bde47752be1def11a79629ddea36760297f8373`; the production-handler blob was
`62a2ee3ed347aa1976ebd91112f78b015f8e728d` and regression blob was
`2b076e5011e0136042454f82a0edd32b5e5a4e63`.

The focused authority suite passed all 18 tests. The full local Money Factory
POD Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. The paired Content Control grant/HTTP
suite passed all 47 tests. Exact-head hosted run
[40062982234](https://github.com/wecreates/Money-factory/actions/runs/40062982234),
job 120780257378, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, KDP/editorial, Node, Python and package-contract
gates. PR 179 was squash-merged as
`56a266f37834b8fdfc9d1bd910f82e26a6d643ea`.

## Deployment and acceptance state

This repair changed only Money Factory. It did not modify Content Control
runtime bytes and therefore did not request another Render application build.
The authorized Render service remained an unsuspended free-plan Docker web
service on `main`, one instance, commit-triggered auto-deploy and `/health`.
Its most recent Content Control application deployment remains
`dep-dbe2oi0473hc73bmd5q0`, which failed before build with
`pipeline_minutes_exhausted` for application merge
`99e4e3f9f8bbecfb5d11f71735ceb29941005792`. The r223 report merge
`439fde565d113cfa194ee68d8d1010fba0bc64b9` was correctly ignored by Render
in event `evt-dbe2qru1egvs73feai80`. No manual retry, purchase, plan/cache
change, replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authority
transport-availability boundary only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained
recovery evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform
adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
