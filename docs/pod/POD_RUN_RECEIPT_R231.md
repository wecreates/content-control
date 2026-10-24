# POD run receipt r231 — exact durable grant-request scope

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`6e4990d06fcae2a2051ab449447ec3cb2cd5065e`; Money Factory started from
`d28ae066d15a79879fdbd0796f91bd706c62708a`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. Open pull requests were unrelated draft media/offline work and did
not overlap this repair. The previously failed database-administration path had
no credible access change and was not retried. No resource, credential,
account, network rule or marketplace state was created or changed.

## Repair and regression evidence

Content Control's current-grant client serialized the durable job ID directly
into its Money Factory authority request without first requiring the ID to be a
primitive value matching the brief. A boxed string, one-item array, or object
with `toJSON` could therefore normalize into a valid remote lookup string even
though the durable local identity itself was malformed. The authority still
signed a valid string scope, and the prior client accepted the object-normalized
case. The pre-fix regression reproduced this as `Missing expected rejection`.

[Content Control PR 559](https://github.com/wecreates/content-control/pull/559)
now requires the durable ID to be a primitive 1–100 character authority
identifier and to match the brief ID exactly before any authority transport is
started. Arrays, boxed strings, `toJSON` objects, unsupported characters,
overlong IDs and durable/brief mismatches fail closed with
`GRANT_REQUEST_INVALID`; JSON serialization cannot choose or normalize the
scope. Existing transport, exact-response, signature, audience, permission,
revocation and lifetime checks remain unchanged. The exact remote PR head was
`87d27be6b14ff8017b4c09e389b1b2b0a2ebbdd8`. The remote blobs were
`4afcbd84737155da7991600d4cb9468ee4d07b92` for `GRANT_AUTHORITY.md`,
`a00963778f781dafa769b985c0d7cfc381b7e7fc` for `grant-client.mjs`,
`43d03e67e8605b11030196e42689893ce3a36102` for the grant-client regression,
and `71d6b38d02c5b8b1207d47a69e036e50185261b6` for the transport fixtures; all
matched the tested local contents exactly.

The focused authority/transport/resolver suites passed 73/73. The
dependency-free local POD Node suite passed 668 tests with two expected skips
and zero failures. The unfiltered local command reached 691 passed and two
skipped; its only six failures were unchanged import failures because this
scratch checkout lacks the `pg` package, so no local PostgreSQL pass is claimed.
Exact-head hosted runs
[40093005500](https://github.com/wecreates/content-control/actions/runs/40093005500),
job 120869375551, and
[40093005535](https://github.com/wecreates/content-control/actions/runs/40093005535),
job 120869375707, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 559 was squash-merged
as `7c70d680d739ec9321ca55061b832aeaff261e6b`.

[Money Factory PR 186](https://github.com/wecreates/Money-factory/pull/186)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`b2e94be78b6c015aecbcb3090f6ee348ff9f19c2`, with workflow blob
`2b1f1c4d034b1a821221a360c8e4c7e837df9447`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-environment skip and
zero failures; all 81 Python tests passed. Exact-head hosted run
[40093521152](https://github.com/wecreates/Money-factory/actions/runs/40093521152),
job 120870904652, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
186 was squash-merged as `97c9cf232850865e39a98ad32ea670c11f72de3a`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbea4luq1p3s73e17ig0`, but failed before build at
2026-10-24T12:19:35Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbea4lr4qb4c739k11lg`,
`pipeline_minutes_exhausted` `evt-dbea4loa6lpc73e3hqp0`, and failed deploy end
`evt-dbea4lsegpmc73bd7n8g`. The existing service remained unsuspended on its
free Docker plan with commit-triggered auto-deploy enabled. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one current-authority
request-scope ambiguity only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
