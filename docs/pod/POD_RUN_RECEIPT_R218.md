# POD run receipt r218 — exact provider readback evidence

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current state after r217 and read the completion,
implementation-status and free-deployment documents, open pull requests,
workflow results, and the authorized existing Render service. Content Control
started from `1f2b8821fda2cc0a318026dd3d96daeb1398f91f`; Money Factory
started from `6caaaf1bb4fc4afb114e46db3f232b7718987f0f`. The intervening
heads were independent monitor/evidence ticks. Open pull requests did not
overlap this repair, and unrelated dirty worktrees were preserved. Database
administration was not retried because no credible access-path change existed.

## Repaired provider readback boundary

The authenticated listing-observation path validated required fields but
accepted additional signed properties, then wrote the entire decoded envelope
payload to `pod_provider_inbox.payload`. The pre-fix diagnostic proved an extra
private field crossed that durable boundary:

```json
{"status":"PRE_FIX_PERSISTED_UNBOUNDED_READBACK","writes":3}
```

[Content Control PR 535](https://github.com/wecreates/content-control/pull/535)
merged exact tested head
`3979731f04d1552e999c6eebbd8e72d498233746` as
`4e261aef7c67872c436a0854a8c52652ee65cef0`. Schema-v1 listing
observations now require the exact signed-envelope and listing fields, reject
unsupported platforms before database access, and persist a reconstructed
allowlisted payload. Adapter bodies, headers, URLs, credentials, extra fields,
and private diagnostics cannot silently become provider evidence. Exact changed
blobs were:

- `integrations/pod/LISTING_EVIDENCE.md`:
  `8f7d36fba87cfa8d701e04f5e1b304e4f9f54279`
- `integrations/pod/reconcile.mjs`:
  `e46ce0994af56aff24757827100a6487e3e54856`
- `tests/pod-postgres.test.mjs`:
  `9bfd11533a094e833a6a0364297973b7ebaf392d`
- `tests/pod-reconcile.test.mjs`:
  `11e5f73f31ce25d82af7d6be83c2c8264964a577`

## Verification evidence

Focused reconciliation, expiry, release-freshness and settlement suites passed
62/62. The new isolated regression proves extra fields and Etsy fail before
database access and verifies the retained payload is exact. The PostgreSQL
regression proves an invalid observation leaves the job submitted and creates
no inbox entry. After installing the repository's locked dependencies, the full
local POD Node suite passed 699 tests with nine expected environment-gated skips
and zero failures. Syntax, workflow-control verification and `git diff --check`
passed; workflow control confirmed publication remained disabled.

Both exact-head Content Control workflows passed:

- integration run `40038259913`, job `120702954028`, passed the Node and
  Python suites, PostgreSQL production E2E, server syntax, workflow-control and
  free-review guards;
- container run `40038260033`, job `120702954487`, built the production image
  and passed non-root dependency, Python QA/rendering, Node/PostgreSQL, real
  print/review and publication-disabled startup stages.

Dependent [Money Factory PR 173](https://github.com/wecreates/Money-factory/pull/173)
pinned verification to Content Control
`4e261aef7c67872c436a0854a8c52652ee65cef0` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `9be72f5bb4cba8e914e23ac58302b893e470943e` merged as
`2a87ec5e03d2c8044dd55ef80ca5007629b7aeed`. Cross-repository run
`40038977215`, job `120705279030`, passed every selected bridge, review,
recovery, evidence, official-template, original-identity, layout, KDP/editorial
and integration stage. The changed workflow blob was
`6fb867b0a8b66f878352ccda9b3bbd74f31e6162`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact application merge as deploy
`dep-dbdumhu1egvs73faqc6g`. Deploy-start event
`evt-dbdumi2d6m0s73894l2g` bound
`4e261aef7c67872c436a0854a8c52652ee65cef0` at
2026-10-23T23:18:32.121066Z. Event `evt-dbdumi6c36kc73820vv0`
reported `pipeline_minutes_exhausted` at 23:18:32.150082Z, and event
`evt-dbdumi28sjds73fabmv0` recorded the failed deploy at
23:18:32.408913Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs one provider-
evidence security boundary only; merged code and passing hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates and reviewers,
authorized five-platform adapters, actual economics and reconciliation, owner-
phone acceptance, monitoring and recovery drills, measured capacity, and a real
authorized end-to-end launch remain unverified. Both publication flags remain
false. Etsy remains excluded. No approval, clearance, revenue, publication,
successful deployment, or continuously running self-hosted worker is claimed.
