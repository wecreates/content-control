# POD run receipt r215 — report-only live health deploy policy

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current repository heads after r214 and read the current
completion, implementation-status and free-deployment documents, open pull
requests, workflow results, and the authorized existing Render service. Content
Control started from
`bffae8bc935d354f67d00e0ea881e4e51f744f56`; Money Factory started from
`bb35b393f7e36e5ad73fbec3905efacd4c4234a6`. No open pull request
overlapped this repair. Database administration was not retried because no
credible access-path change was present.

## Repaired observation-only deployment boundary

The preceding application merge
`c5b650fa5f4ed93878563d829901f1f428a2575c` caused intended Render deploy
`dep-dbdquvgu01pc73dqj7jg`. The live smoke workflow then committed only
`state/live-deployment-health.json` as
`5c4f7ba92989bc530488af76aca90f53a1af4e1a`, but its commit did not use the
staged Render policy. Render consequently attempted redundant deploy
`dep-dbdr026q1p3s73evcb40` for identical runtime bytes. Both attempts failed
before build because pipeline minutes were exhausted; the second attempt could
not make the recorded probe pass.

The pre-fix diagnostic reproduced the policy gap:

```json
{
  "status": "PRE_FIX_REPRODUCED",
  "report_allowlisted": false,
  "generated_commit_message": "Update live Render deployment health",
  "workflow_uses_staged_policy": false,
  "observed_application_deploy": "dep-dbdquvgu01pc73dqj7jg",
  "observed_report_only_deploy": "dep-dbdr026q1p3s73evcb40"
}
```

[Content Control PR 527](https://github.com/wecreates/content-control/pull/527)
merged exact tested head
`3bd3c74429d8a171d5a7c36b17972275b0a4e755` as
`e924103df1635df5aa6ccac0703be810f4f5f2cf`. The live smoke workflow now
derives its commit message from the staged policy. The exact observation path
`state/live-deployment-health.json` is report-only, so an otherwise report-only
commit receives `[skip render]`. Any mixed application, health, completion or
operations change remains a normal deployment candidate. Exact changed blobs
were:

- `.github/workflows/live-render-deployment-smoke.yml`:
  `6c96672754ec4b06bd4756e7f1a2430157fdb68a`
- `POD_FREE_DEPLOYMENT.md`:
  `77e53b0ca1b38132b3e6ed3bc9c6162d02da2785`
- `scripts/pod_deploy_commit_policy.mjs`:
  `d459399bf352669554b524a0d372b46d6dfc0313`
- `tests/pod-deploy-commit-policy.test.mjs`:
  `fb82d3a498bfee8fc05e165de1b27908b01c8570`

## Verification evidence

The focused staged-policy test passed 7/7, including synthetic Git commits
confirming a live-health-only receipt skips Render while the same receipt mixed
with `state/content-control-health.json` does not. Review-smoke input tests
passed 10/10. Script syntax, workflow-control verification and
`git diff --check` passed; workflow control confirmed publication remained
disabled.

Both exact-head Content Control workflows passed:

- container run `40012125216`, job `120614874417`, built the production
  image and passed non-root dependency, Python QA/rendering, Node/PostgreSQL,
  real print/review and publication-disabled startup stages;
- integration run `40012125342`, job `120614875151`, passed the complete
  Node and Python suites, PostgreSQL production E2E, server syntax,
  workflow-control and free-review guards.

Dependent [Money Factory PR 169](https://github.com/wecreates/Money-factory/pull/169)
pinned verification to Content Control
`e924103df1635df5aa6ccac0703be810f4f5f2cf` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested
head `25af94a3f9da30d7843dd06da81655b7fb8b88b6` merged as
`381fe0350726b61d97e98bf7826ddbc79886dd25`. Cross-repository run
`40013298688`, job `120618868202`, passed every selected bridge, review,
recovery, evidence, KDP/editorial and integration stage. The changed workflow
blob was `3da10242a67724607df86eeccafb726fec78f5a8`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact application merge as deploy
`dep-dbdrfr3m8hqs73ct0nsg`. Deploy-start event
`evt-dbdrfra8sjds73f7mt80` bound
`e924103df1635df5aa6ccac0703be810f4f5f2cf` at
2026-10-23T19:39:25.352071Z. Event
`evt-dbdrfrad6m0s7386hnkg` reported
`pipeline_minutes_exhausted` at 19:39:25.359594Z, and event
`evt-dbdrfr8k84hc73eatd90` recorded the failed deploy at
19:39:25.761257Z. No application build ran. No manual retry, paid workaround,
replacement service, credential access, widened network, or unchanged
database-administration retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs the report-only
deployment boundary only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. Both publication flags remain false. Etsy remains
excluded. No approval, clearance, revenue, publication, successful deployment or
continuously running self-hosted worker is claimed.
