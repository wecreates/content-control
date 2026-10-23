# POD run receipt r217 — publication settlement evidence boundary

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current state after r216 and read the completion,
implementation-status and free-deployment documents, open pull requests,
workflow results, and the authorized existing Render service. Content Control
started from `1af469e9df4749aef850d8b00d0be239586eaa99`; Money Factory
started from `c3b924cb0b93d34ff57acd061a9d7e95f33e7d69`. Open pull
requests did not overlap this repair. Existing unrelated dirty worktrees were
preserved. Database administration was not retried because there was no
credible change to the previously failed access path.

## Repaired durable settlement evidence

`PodDB.finish()` previously accepted extra receipt fields and arbitrary reason
strings, then persisted them to `pod_events.payload` and
`pod_production_queue.reason_code`. The pre-fix diagnostic proved that an
adapter result containing an opaque provider ID plus an additional private
field, and a private URL-shaped reason, crossed the durable evidence boundary:

```json
{"status":"PRE_FIX_ACCEPTED_UNBOUNDED_SETTLEMENT"}
```

[Content Control PR 533](https://github.com/wecreates/content-control/pull/533)
merged exact tested head
`39b303d92de6e42d96003bae63a78d9a37433145` as
`4730529d7f02937a9ee532e0a6233ff10f148ab1`. Settlement now accepts only
three exact plain-object outcomes before database access: submitted has one
bounded opaque `id` and no reason; ambiguous has an empty receipt plus
`SUBMISSION_UNCERTAIN`; blocked has an empty receipt plus `RELEASE_BLOCKED`.
The persisted event payload is reconstructed from that validated result, so
adapter response bodies, headers, URLs, credentials, extra fields, and private
failure text cannot become settlement evidence. Exact changed blobs were:

- `integrations/pod/LISTING_EVIDENCE.md`:
  `a8f890253fd01caa1c899235463ea7f20daa9879`
- `pod-db-bridge.js`:
  `40bb0706619dd0a1237cc0f0bf6af0d76ee4c1cc`
- `tests/pod-postgres.test.mjs`:
  `6f2c52ad20c59d09e9c6f8f6ee451e2e0ba3d24a`
- `tests/pod-production-lease.test.mjs`:
  `5cdaa5f34f62805e497f82dac39eea49e6f1d3c4`

## Verification evidence

The focused publication-lease, release-freshness and KDP weekly-submission
matrix passed 43/43. The isolated regression covers seven invalid receipt and
reason shapes and confirms zero database access or writes. The real PostgreSQL
regression confirms invalid submitted and blocked outcomes leave the job in
`publishing` and emit no POD event. JavaScript syntax, workflow-control
verification and `git diff --check` passed; workflow control confirmed
publication remained disabled.

Both exact-head Content Control workflows passed:

- integration run `40027932433`, job `120668689788`, passed the Node and
  Python suites, PostgreSQL production E2E, server syntax, workflow-control and
  free-review guards;
- container run `40027932452`, job `120668689873`, built the production image
  and passed non-root dependency, Python QA/rendering, Node/PostgreSQL, real
  print/review and publication-disabled startup stages.

Dependent [Money Factory PR 172](https://github.com/wecreates/Money-factory/pull/172)
pinned verification to Content Control
`4730529d7f02937a9ee532e0a6233ff10f148ab1` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `00ad530faceb833b7e61d3b20d7743d588229480` merged as
`572698276124e9f6fd82246e50784a79ed1e182c`. Cross-repository run
`40028804947`, job `120671602707`, passed every selected bridge, review,
recovery, evidence, official-template, original-identity, layout, KDP/editorial
and integration stage. The changed workflow blob was
`5271668e3eac1557a9d8d580599844f9e1184c14`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact application merge as deploy
`dep-dbdt9l6k1f9s73ej0qcg`. Event `evt-dbdt9laqqsrs73d7r3g0` reported
`pipeline_minutes_exhausted` for commit
`4730529d7f02937a9ee532e0a6233ff10f148ab1` at
2026-10-23T21:42:45.252408Z; deploy-start event
`evt-dbdt9lc0a7sc7395h0g0` followed at 21:42:45.266317Z, and event
`evt-dbdt9lec36kc73810kng` recorded the failed deploy at
21:42:45.577695Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs one publication
safeguard and security boundary only; merged code and passing hosted CI are not
live acceptance. Production restricted database/schema/migrations, retained
recovery evidence, deployed hybrid dependencies, mounted Money Factory
authority/current grants and revocation, real accounts/sources/rights/templates
and reviewers, authorized five-platform adapters, actual economics and
reconciliation, owner-phone acceptance, monitoring and recovery drills,
measured capacity, and a real authorized end-to-end launch remain unverified.
Both publication flags remain false. Etsy remains excluded. No approval,
clearance, revenue, publication, successful deployment, or continuously
running self-hosted worker is claimed.
