# POD run receipt r235 — exact durable outbox event shape

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`5173607d38eac4f7b19524f863c2ccaf683a6ca2`; Money Factory started from
`e501df42884f17362b93c948d845fb361eed3283`. Current POD completion,
implementation-status and free-deployment documents, the r234 receipt, open
pull requests, exact-head workflow results and the authorized existing Render
service were inspected. The only open PR matching the POD query was unrelated
draft OpenFilm media work and did not overlap this repair. The previously failed
database-administration path had no credible access change and was not retried.
No resource, credential, account, network rule or marketplace state was created
or changed.

## Repair and regression evidence

Content Control validated a durable outbox row's payload values before signing,
but did not validate the complete event shape. A malformed row could therefore
be sent, receive an acknowledgement naming its event ID, and be marked delivered
even though Money Factory's inbox would reject its UUID/job scope, kind, payload
root, timestamp or member set. The focused pre-fix run passed 22 tests and
failed the new regression with `Missing expected rejection` after the malformed
row was acknowledged.

[Content Control PR 566](https://github.com/wecreates/content-control/pull/566)
now requires the receiver's exact five-member durable event contract before
serialization, signing or network access: UUID event and optional job IDs, a
bounded lowercase `pod.*` kind, a plain-object payload, and an exact canonical
UTC creation timestamp no more than five minutes ahead of issuance. Extra,
missing, accessor, non-enumerable or symbolic event members and malformed field
values fail with `OUTBOX_EVENT_SCOPE_INVALID`; no request or delivered-marker
write occurs. The exact remote PR head was
`505701d5c2002a35bb3bddcded3fbc6efe3ce190`. Remote blobs were
`260b2c6f3cff7d7b73b6537b5666ca368ab5dfd4` for `outbox.mjs`,
`9da85c99e311c35fa80834b97bda70a754024dd7` for the runtime regression, and
`3a306e32fb16fef1c4c608125f9c9a94c7b3cec7` for `OUTBOX.md`; they matched the
tested local contents.

The focused outbox/HTTP/grant suites passed 75/75. The broad dependency-free
local POD Node suite reached 696 tests: 694 passed, two expected skips and zero
failures. The unfiltered local command reached 694 passed and two skipped; its
only six failures were unchanged import failures because this scratch checkout
lacks the `pg` package, so no local PostgreSQL pass is claimed. Exact-head hosted
runs
[40108688772](https://github.com/wecreates/content-control/actions/runs/40108688772),
job 120915648452, and
[40108688840](https://github.com/wecreates/content-control/actions/runs/40108688840),
job 120915648534, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 566 was squash-merged
as `cd73646183f241efb5dc1c6d155fab36163edb5d`.

[Money Factory PR 190](https://github.com/wecreates/Money-factory/pull/190)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`a3458d3bbf9c212bbae1428ffd4e131c22549cb7`, with workflow blob
`59868a95f895ed982948d63e248141965061faf0`. Exact-head hosted run
[40109252559](https://github.com/wecreates/Money-factory/actions/runs/40109252559),
job 120917327757, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
190 was squash-merged as `6005b3196ee056397d8e8807235af821ab6e386d`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbeda2ek1f9s73f6td70`, but failed before build at
2026-10-24T15:55:54Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbeda2kegpmc73bfm4j0`,
`pipeline_minutes_exhausted` `evt-dbeda2mgej5s739p83dg`, and failed deploy end
`evt-dbeda2jphbkc739mtnn0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one sender/receiver
event-shape ambiguity only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
