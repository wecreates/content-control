# POD run receipt r216 — publication outcome lease fencing

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed the current repository heads after r215 and read the
current completion, implementation-status and free-deployment documents, open
pull requests, workflow results, and the authorized existing Render service.
Content Control started from
`e944832c4dbff54c23b1983affc462c27d89a739`; Money Factory started from
`381fe0350726b61d97e98bf7826ddbc79886dd25`. The open pull requests did
not overlap this repair. Existing unrelated dirty worktrees were preserved.
Database administration was not retried because no credible access-path change
was present.

## Repaired publication settlement boundary

`PodDB.finish()` previously checked the job identifier, fencing token and
`publishing` state, but did not establish that the five-minute publication
lease was still live. A stale publisher could therefore record a
`submitted`, `ambiguous` or `blocked` outcome after its release lease had
expired but before recovery swept the job.

The pre-fix diagnostic reproduced the gap:

```json
{
  "status": "PRE_FIX_ACCEPTED_EXPIRED_PUBLICATION_COMPLETION",
  "writes": 2
}
```

[Content Control PR 531](https://github.com/wecreates/content-control/pull/531)
merged exact tested head
`65d6f018496df435cc6d3b76c2adadf99a1c8a24` as
`12e3b226596249d211cc329737d82e346f6b13a2`. Publication settlement now
locks the current `publishing` row, checks
`lease_until > clock_timestamp()` after that lock, and retains the same
condition in the final update. Expired leases fail closed with
`LEASE_LOST` for submitted, ambiguous and blocked outcomes. Provider
reconciliation remains the recovery owner for an expired release attempt.
Exact changed blobs were:

- `integrations/pod/LISTING_EVIDENCE.md`:
  `968afc299550512976e4d91954238f1173a4a4d7`
- `pod-db-bridge.js`:
  `3680000bb7e27b3ea2da51a91845dabf5bcdbc2d`
- `tests/pod-postgres.test.mjs`:
  `8f2f00d0d047660825c0930f3142f6016d16358c`
- `tests/pod-production-lease.test.mjs`:
  `67f662597bc2f40813e90a0235f01a09bcac2f95`
- `tests/pod-release-freshness.test.mjs`:
  `897609d83fa3d76f1b0922d42067b6b0e7881e02`

## Verification evidence

The focused release, freshness and KDP weekly-submission matrix passed 42/42,
including six new outcome-by-lease regressions. The real PostgreSQL regression
confirms an expired publish lease cannot record a submitted state or
`pod.submitted` event. JavaScript syntax, workflow-control verification and
`git diff --check` passed; workflow control confirmed publication remained
disabled.

Both exact-head Content Control workflows passed:

- integration run `40025605335`, job `120660895520`, passed the complete
  Node and Python suites, PostgreSQL production E2E, server syntax,
  workflow-control and free-review guards;
- container run `40025605307`, job `120660895159`, built the production
  image and passed non-root dependency, Python QA/rendering, Node/PostgreSQL,
  real print/review and publication-disabled startup stages.

Dependent [Money Factory PR 171](https://github.com/wecreates/Money-factory/pull/171)
pinned verification to Content Control
`12e3b226596249d211cc329737d82e346f6b13a2` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact
tested head `26903d7c7bd3b4a8bfc839b3729c3163bd6daa90` merged as
`c3b924cb0b93d34ff57acd061a9d7e95f33e7d69`. Cross-repository run
`40026645659`, job `120664388601`, passed every selected bridge, review,
recovery, evidence, KDP/editorial and integration stage. The changed workflow
blob was `41bdea7487a6d71097fb1f7b542dc9f0046ccffb`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact application merge as deploy
`dep-dbdt14ei0phs73bgi9ng`. Deploy-start event
`evt-dbdt14a8sjds73f93c8g` bound
`12e3b226596249d211cc329737d82e346f6b13a2` at
2026-10-23T21:24:33.631242Z. Event
`evt-dbdt14c7hfos73dltk30` reported
`pipeline_minutes_exhausted` at 21:24:33.678336Z, and event
`evt-dbdt14ec36kc7380q0f0` recorded the failed deploy at
21:24:33.989688Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs the publication
settlement boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. Both publication flags remain false. Etsy
remains excluded. No approval, clearance, revenue, publication, successful
deployment or continuously running self-hosted worker is claimed.
