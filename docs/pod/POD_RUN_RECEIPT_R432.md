# POD run receipt R432

Run completed at `2026-11-03T19:55:17Z` using only the repositories'
existing GitHub Actions workflow and the owner's existing free Render service.
This receipt records code, CI and deployment-state evidence; it does not claim
live marketplace acceptance.

## Reconciled starting state

- Content Control `main` was
  `e87d8b49dcab7b3a432d6c2f1afdb8a674a218ec`.
- Money Factory `main` was
  `d68e3d650c981311148641ecdf4e544b88502b89`.
- Neither repository had an open PR, so no concurrent POD job was duplicated.
  The R431 receipt and all earlier concurrent security, watchdog, QA, ledger
  and monitoring work were preserved.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one
  of the 24 acceptance areas.

## Confirmed defect and repair

Money Factory's authority handler accepted the object returned by
`loadSnapshot` and then read, spread and signed nested `job`, `readiness`,
`approval`, `verifiedFacts` and related members without first proving that
the evidence was inert. Accessor-backed or Proxy-backed snapshot members could
therefore execute while the authority service was deciding and signing a
grant.

An expected-red matrix reproduced eight missing rejection paths: a top-level
`job` accessor, a `job` Proxy, a nested job-field accessor, a top-level
`readiness` accessor, a `readiness` Proxy, a `businesses` accessor, an
`approval` Proxy and a `verifiedFacts` Proxy. Before the production repair,
all eight cases returned HTTP 200 instead of failing closed, and their
executable members were invoked.

The repair copies loader-returned evidence through descriptor-only recursive
validation before any authority decision. It accepts only finite JSON-like
primitives, plain or null-prototype objects and dense ordinary arrays; rejects
Proxies, accessors, symbols, unsupported prototypes, cycles, sparse or
ambiguous arrays, excessive depth and excessive object counts; and signs only
the inert copied snapshot. Rejection remains redacted as HTTP 409
`GRANT_BLOCKED`, without invoking the executable evidence.

Local verification after the repair:

- the focused authority and economics matrix passed 54 tests with zero
  failures;
- the complete Money Factory POD integration suite with
  `CONTENT_CONTROL_ROOT` passed 142 tests, skipped one PostgreSQL-only test
  and had zero failures, 143 total;
- `node --check integrations/pod/authority-handler.mjs` and
  `git diff --check` passed.

## Hosted verification and merge

Money Factory PR 387 contained only
`integrations/pod/authority-handler.mjs` and
`integrations/pod/authority-snapshot-evidence.test.mjs`. Its exact base was
`d68e3d650c981311148641ecdf4e544b88502b89` and its final exact head was
`7b4684fa4acaa1ee7c0d90b75cc8144601f112b0`.

Cross-repository workflow run `41706893237`, job `126164478174`, completed
successfully. Every step passed, including pinned contracts, strict Python
evidence, bounded JSON and export handling, recovery, output safety, original
art and independent layout, KDP PDF/cover pairing, font rights, retained
official templates, comprehensive KDP metadata/editorial QA, the full Node POD
suite and the full Python POD suite. PR 387 was squash-merged as
`cd07d99d71b03d799585e4bd54e780d26cff71d0`.

The Money Factory production workflow at the merged commit retained literal
`PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`.

## Deployment reconciliation

This run changed Money Factory only and did not request or require a Content
Control deployment. The authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained
unsuspended on the free plan with `main` auto-deploy, Docker runtime and
`/health` health check.

Deployment `dep-dbl2o5tlmcpc73dsmatg` remained `live` on preserved Content
Control functional head
`8aa4c5e6d8120e34cacef3c3fa336a2b25bc8406`. It started at
`2026-11-03T19:00:25.486601Z` and reached `live` at
`2026-11-03T19:02:34.963136Z`. The later R431 receipt commit was marked
`[skip render]`, and no redundant deployment appeared. No manual redeploy,
cache clear, plan change, purchase or secret access was used. This proves
service deployment liveness, not canonical `/readyz`, accepted review
evidence, marketplace connectivity or end-to-end acceptance.

## Boundaries and unfinished work

- No marketplace adapter was contacted and no KDP, Redbubble, TeePublic,
  Zazzle, Spreadshirt or Etsy submission occurred.
- No purchase, paid resource, message, secret disclosure, social-vault access,
  bot-detection evasion or network widening occurred.
- Database administration was not retried because no credible changed access
  path appeared. The prior connector/browser limitation remains unchanged.
- Scheduled execution used only the tools and permissions actually present for
  this run; it is not evidence of a continuously running self-hosted worker.
- Existing code, CI and deployment liveness do not close live acceptance. The
  canonical review artifact remains unaccepted and the saved deployment-health
  receipt remains fail-closed.
- All 24 acceptance areas remain OPEN. Publication remains disabled pending the
  owner's explicit approval only after every criterion has verifiable live
  evidence.
- The completion automation therefore remains enabled.
