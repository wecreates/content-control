# POD run receipt r225 — fixed outbox authority endpoint

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`fbb494e25e27644dfe097efbb3f86d5db130ebdc`; Money Factory started from
`56a266f37834b8fdfc9d1bd910f82e26a6d643ea`. Current POD completion,
implementation-status and free-deployment documents, open pull requests,
exact-head workflow results and the authorized existing Render service were
inspected. No open POD pull request overlapped this repair. A concurrent Money
Factory monitor-state commit `853d94e3ac921152b520f7fcd00285a55cb85375`
changed only the free-monitor event/state files and was preserved. The
previously failed database-administration path had no credible access change
and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

The Content Control grant client already required a fixed authority URL, but
the direct outbox sender accepted query-bearing and fragment-bearing variants;
the long-running outbox validator also accepted a query string. A mutable
endpoint variant could therefore reach durable storage before the configured
authority endpoint contract was rejected. The pre-fix regression reproduced
this behavior: the query variant reached the database and the focused suite
failed 1 of 19 tests.

[Content Control PR 547](https://github.com/wecreates/content-control/pull/547)
now rejects URL search and fragment components in both configuration paths,
before database or network access. The exact remote PR head was
`b5fa4639050d7bbecd615efc84e5aff5c66832a3`; production blobs were
`0211c8b798500af41b4838d7d3323d758cb4e977` (direct sender) and
`e0d94459098199370897c50f238f3cabec2d882c` (runtime), with regression blob
`7be9f9efdf8a40b4dae11e94797a355efb07b259`. The focused suite passed all 19
tests after the repair. The dependency-free local POD Node suite passed 685
tests with two expected skips and zero failures; all 93 local POD book-bounds
Python tests passed. Exact-head hosted runs
[40068144072](https://github.com/wecreates/content-control/actions/runs/40068144072),
job 120795607567, and
[40068144027](https://github.com/wecreates/content-control/actions/runs/40068144027),
job 120795607334, both passed, including the production-image PostgreSQL,
rendering, review-path and disabled-publication startup gates. PR 547 was
squash-merged as `77b4393b08457c8c982236beaf346d3d6f59fe38`.

[Money Factory PR 180](https://github.com/wecreates/Money-factory/pull/180)
pinned its cross-repository production gate to that immutable Content Control
merge. Its exact remote head was
`a6feea68567a422793800f7aa7d9d4ba193f4838`, with workflow blob
`c480efe2cd9ee1b20a5e7c720d2cf3ae0f32a72a`. The local Money Factory POD
Node suite passed 112 tests with one expected PostgreSQL-only skip and zero
failures; all 81 Python tests passed. Exact-head hosted run
[40068648304](https://github.com/wecreates/Money-factory/actions/runs/40068648304),
job 120797120385, passed the disposable PostgreSQL round trip and all pinned
review, recovery, rights, template, editorial, Node, Python and package
contract gates. PR 180 was squash-merged as
`884f2876311afdc3f75683ebc9776e3a1c474881`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbe4jngu01pc73e4lj4g`, but failed before build at
2026-10-24T06:02:07Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbe4jnqqqsrs73dcn7sg`,
`pipeline_minutes_exhausted` `evt-dbe4jnuc36kc7385snpg`, and failed deploy end
`evt-dbe4jnose3cs73f9okug`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one endpoint
integrity boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
