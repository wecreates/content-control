# POD run receipt r230 — exact signed grant-authority responses

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`9d9f07abb6127396c4e6e771bbe4e6ba97c1f334`; Money Factory started from
`50c801b004f9db16c70de5f2fab4123b270676b0`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. Open pull requests were unrelated draft media/offline work and did
not overlap this repair. The previously failed database-administration path had
no credible access change and was not retried. No resource, credential,
account, network rule or marketplace state was created or changed.

## Repair and regression evidence

Content Control's current-grant client authenticated the `payload` and
`signature` members of a Money Factory authority response but did not require
those to be the response's only root members. A response combining a valid
signed envelope with an unsigned top-level `status: "revoked"` or
`error: "APPROVAL_REVOKED"` was therefore accepted. The pre-fix regression
reproduced the fault as `Missing expected rejection`.

[Content Control PR 557](https://github.com/wecreates/content-control/pull/557)
now requires a non-array ordinary JSON object with exactly two own members,
`payload` and `signature`, before signature and grant-policy validation. Mixed
unsigned status/error responses fail closed with `GRANT_RESPONSE_INVALID`.
Signature, audience, scope, permission, revocation, lifetime and exact JSON
media-type checks remain unchanged. The exact remote PR head was
`76140993b6029be4d7c6963782f31a1ae57a71b6`. The remote blobs were
`b0f950a51b0a4d43c14512e9585cfea4c019c461` for `GRANT_AUTHORITY.md`,
`c38733ce8d422aa8ae10cd696edb439eac1aa8b7` for `OUTBOX.md`,
`4e30ce3421c5fb2c96e790a6591786f83a2b7d38` for `grant-client.mjs`, and
`1ea0c9be05d96848eddd70c3fbffe6f315b8e967` for the HTTP regression; all
matched the tested local contents exactly.

The focused grant/HTTP/runtime suites passed 74/74. The dependency-free local
POD Node suite passed 667 tests with two expected skips and zero failures. The
unfiltered local command reached 690 passed and two skipped; its only six
failures were unchanged import failures because this scratch checkout lacks the
`pg` package, so no local PostgreSQL pass is claimed. Exact-head hosted runs
[40086155126](https://github.com/wecreates/content-control/actions/runs/40086155126),
job 120849406039, and
[40086155127](https://github.com/wecreates/content-control/actions/runs/40086155127),
job 120849405989, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 557 was squash-merged
as `9d7c05f0ae9f81a7bc42c7046a03c7f8c144d3ae`.

[Money Factory PR 185](https://github.com/wecreates/Money-factory/pull/185)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`0f1f797ad1bbf26e6ca05c074b75e5ec54785ab3`, with workflow blob
`2df2b0541e08bed782afd89666eca10852220e02`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-environment skip and
zero failures; all 81 Python tests passed. Exact-head hosted run
[40086643986](https://github.com/wecreates/Money-factory/actions/runs/40086643986),
job 120850838807, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
185 was squash-merged as `d28ae066d15a79879fdbd0796f91bd706c62708a`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe8kess728c73caaldg`, but failed before build at
2026-10-24T10:36:43Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe8keubs3rs73btaijg`,
`pipeline_minutes_exhausted` `evt-dbe8keta647c73e46nk0`, and failed deploy end
`evt-dbe8keta647c73e46nlg`. The existing service remained unsuspended on its
free Docker plan with commit-triggered auto-deploy enabled. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one fresh-authority
response-boundary ambiguity only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
