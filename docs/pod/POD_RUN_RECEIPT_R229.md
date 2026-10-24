# POD run receipt r229 — JSON grant-authority response media type

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`86f2b709a870d60332bcfa101415700c47c9c75c`; Money Factory started from
`516ea716a4a54e4da77b09285b315f2c3ee3c1b4`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. Open pull requests were unrelated draft media/offline work and did
not overlap this repair. The previously failed database-administration path had
no credible access change and was not retried. No resource, credential,
account, network rule or marketplace state was created or changed.

## Repair and regression evidence

Content Control's fresh-grant client accepted an otherwise valid signed Money
Factory authority envelope even when the successful response was labeled
`text/html`, `application/problem+json`, or had no media type. That allowed a
confused or mislabeled response contract to become the current execution grant.
The pre-fix regression reproduced the fault as a missing expected rejection.

[Content Control PR 555](https://github.com/wecreates/content-control/pull/555)
now requires the successful authority response's exact base media type to be
`application/json` before parsing its signed envelope. Media type matching is
case-insensitive and permits parameters such as `charset=utf-8`; HTML, problem
JSON and missing labels fail closed with `GRANT_MEDIA_TYPE_INVALID`. Signature,
audience, scope, permission, revocation and lifetime checks remain unchanged.
The exact remote PR head was
`51102741090f5829b83dac42bea512749861baaa`. Production/documentation/test
blobs were `17013735a3789f39ff4683192848a866c76c4364`,
`0f80c0f97c111d022930d4277266dd4e2e8cd2ec`,
`85fbaa6158077209dca10f9f3b0f7095e4dab2d9`,
`b2b28ac6cc50613a6f634730d1f384e0bdfaa8f1`,
`7d021b2b88028ffefe925e05b1eed8dddda72290`,
`03329e06c009e441589488647c527c8e06e5e7b4`, and
`f63728ec789ddb825b03c081eb8546d8c763b746`; all matched the tested local
contents exactly.

The focused grant/outbox/runtime suites passed 73/73. The dependency-free local
POD Node suite passed 689 tests with two expected skips and zero failures. The
unfiltered local command also demonstrated the runner limitation honestly: six
PostgreSQL/Express test entrypoints could not import packages absent from this
scratch checkout, so no local pass was claimed for them. Exact-head hosted runs
[40082601781](https://github.com/wecreates/content-control/actions/runs/40082601781),
job 120839052506, and
[40082601797](https://github.com/wecreates/content-control/actions/runs/40082601797),
job 120839052919, both passed. They supplied the pinned dependencies,
disposable PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 555 was squash-merged
as `02b0db2a5e3e407940e23a9b98306e49af053edc`.

[Money Factory PR 184](https://github.com/wecreates/Money-factory/pull/184)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`5e3ec5af0dd72847c2510ed302f93dc21ec90d28`, with workflow blob
`e7937b1ffef98ac8d6a3a246ca3a6cbaf811101d`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. Exact-head hosted run
[40082992344](https://github.com/wecreates/Money-factory/actions/runs/40082992344),
job 120840184672, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
184 was squash-merged as `50c801b004f9db16c70de5f2fab4123b270676b0`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe7qh67bikc73auq8i0`, but failed before build at
2026-10-24T09:41:25Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe7qhbphbkc739in65g`,
`pipeline_minutes_exhausted` `evt-dbe7qhbphbkc739in650`, and failed deploy end
`evt-dbe7qhda647c73e3k0j0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one fresh-authority
response boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
