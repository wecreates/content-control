# POD run receipt r245 — lossless provider listing identities

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`ffa5dbec1c195f0ec1d08db57185542312c3686a`. Money Factory was re-read at
current main `c7a1ee1e16be1cfbeb724a5a495be5bd06cb11c7` before its dependent
change. The current completion, implementation-status and free-deployment
documents, open pull requests, workflow results and the authorized existing
Render service were inspected. Open pull requests were unrelated drafts and did
not overlap this work. The previously failed database-administration route had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Provider listing receipt and signed readback identifiers accepted any nonblank
JavaScript string within the length limit. PostgreSQL text cannot store NUL, and
unpaired UTF-16 surrogates are replaced during UTF-8 encoding, so a malformed ID
could fail only after an external submission or lose its exact identity at the
durable boundary.

[Content Control PR 586](https://github.com/wecreates/content-control/pull/586)
adds one shared opaque-text predicate for adapter receipts, direct submitted
settlement and signed listing observations. It rejects NUL and any string that
does not round-trip through UTF-8 exactly while preserving valid case, spacing,
Unicode and the existing 256-character ceiling. Malformed post-submit receipts
continue through the ambiguous-outcome hold instead of being marked submitted.

The new regression cases first failed because NUL and lone-surrogate IDs reached
database access. After repair, the focused settlement, readback and lease suites
passed 49/49. Dependency-free local discovery passed 710 tests; its only load
failure was the clean checkout's absent `express` package, while six
PostgreSQL-dependent entrypoints were excluded locally because `pg` was absent.
Syntax and whitespace checks passed. Exact-head
[integration run 40151234902](https://github.com/wecreates/content-control/actions/runs/40151234902),
job `121043031216`, and
[production-container run 40151234912](https://github.com/wecreates/content-control/actions/runs/40151234912),
job `121043031414`, both completed successfully. The exact remote head was
`6815268c0450260dd5f61acf8436c961bda65022`; its tree
`c113b3794017b653437ce2654f655389071c0fc0` matched the locally tested tree.
PR 586 merged as `da49708e76a0ff9a710c9a4b68ae4bb115d9f12c`, whose tree remained
exactly `c113b3794017b653437ce2654f655389071c0fc0`.

[Money Factory PR 201](https://github.com/wecreates/Money-factory/pull/201)
advanced the cross-repository gate to that immutable Content Control merge while
retaining explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Exact tested head
`941a23afef97903a3a3a32bded90c2ff880483ce` and its final tree
`2f6ac2172d285d505ba5de45f5d5b54086c268b4` contained only the one-line pin
change. Exact-head
[run 40151816198](https://github.com/wecreates/Money-factory/actions/runs/40151816198),
job `121044742016`, passed every recovery, rights, template, editorial,
package, Node, Python and bridge stage. PR 201 merged as
`8d7146772d38eb61b00bc576ee420a12e1e052d1`; its merge tree matched the
tested tree.

## Deployment and acceptance state

Render automatically attempted the runtime merge as deploy
`dep-dbeltguq1p3s73edegpg`, but failed before application build at
`2026-10-25T01:43:32Z` because free pipeline minutes remained exhausted. The
exact events were deploy start `evt-dbelth6bs3rs73c6n20g`,
`pipeline_minutes_exhausted` `evt-dbelth50r1rs73csv5mg`, and failed deploy
end `evt-dbelth3sp5es73c7fsr0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one provider-listing
identity boundary only; code and hosted CI are not live marketplace or deployment
acceptance. Production restricted database/schema/migrations, retained recovery
and expiry resolution, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real accounts/sources/rights/templates/
reviewers, authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual
economics and financial reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
