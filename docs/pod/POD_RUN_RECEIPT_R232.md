# POD run receipt r232 — valid outbox issuer clock

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`419756dc8c71dc8e36e97b12fc4615d15f8b4883`; Money Factory started from
`97c9cf232850865e39a98ad32ea670c11f72de3a`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. Open pull requests were unrelated draft media/offline work and did
not overlap this repair. The previously failed database-administration path had
no credible access change and was not retried. No resource, credential,
account, network rule or marketplace state was created or changed.

## Repair and regression evidence

Content Control's outbox sender put `Date.now()` directly into its signed JSON
envelope. A non-finite clock could therefore normalize to JSON `null`, while a
negative, fractional or unsafe integer could be signed and dispatched. A
receiver that acknowledged the stable event ID could then cause the durable
event to be marked delivered despite an invalid issuer timestamp. The pre-fix
regression reproduced the behavior as `Missing expected rejection` after the
malformed event was dispatched.

[Content Control PR 561](https://github.com/wecreates/content-control/pull/561)
now captures and validates the issuer clock as a nonnegative safe integer
before serialization, signing or network dispatch. Invalid clocks fail closed
with `OUTBOX_CLOCK_INVALID`; no request is sent and no delivered marker is
written. The exact remote PR head was
`38b581c2b5ec294d11e7dd05579bf83de753e45e`. Remote blobs were
`ecc5a0d004e651d15880172aa0a3451ad8db961c` for `OUTBOX.md`,
`9784b535b7ea80b3822bbf11ead44566d1b0f5ee` for `outbox.mjs`, and
`257027020dce7c988ef7eefc38d50f6a8f2c4f10` for the runtime regression; they
matched the tested local contents.

The focused outbox/HTTP/envelope suites passed 77/77. The dependency-free local
POD Node suite passed 669 tests with two expected skips and zero failures. The
unfiltered local command reached 692 passed and two skipped; its only six
failures were unchanged import failures because this scratch checkout lacks the
`pg` package, so no local PostgreSQL pass is claimed. Exact-head hosted runs
[40094858499](https://github.com/wecreates/content-control/actions/runs/40094858499),
job 120874868238, and
[40094858505](https://github.com/wecreates/content-control/actions/runs/40094858505),
job 120874868291, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 561 was squash-merged
as `6584a975a64ed61673c01b21e727414dadbee9ee`.

[Money Factory PR 187](https://github.com/wecreates/Money-factory/pull/187)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`3b4e174d918b82e9f8eb435cd0502bbb334f1415`, with workflow blob
`8b98bc255a1036fa5b095d3c7a763f390891a8c3`. The correctly configured local
Money Factory POD Node suite passed 112 tests with one expected
PostgreSQL-environment skip and zero failures; all 81 Python tests passed. An
initial Node invocation without `CONTENT_CONTROL_ROOT` produced three expected
configuration errors and was not counted as a pass. Exact-head hosted run
[40095312645](https://github.com/wecreates/Money-factory/actions/runs/40095312645),
job 120876181231, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
187 was squash-merged as `e90ccc79ee28bd0a585538698890ade72f91c85d`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbeagr95efls73aq9d60`, but failed before build at
2026-10-24T12:45:34Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbeagrhr5j6c73fmd2mg`,
`pipeline_minutes_exhausted` `evt-dbeagrj4qb4c739k9790`, and failed deploy end
`evt-dbeagrhr5j6c73fmd2q0`. The existing service remained unsuspended on its
free Docker plan with commit-triggered auto-deploy enabled. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed-outbox
issuer-clock ambiguity only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
