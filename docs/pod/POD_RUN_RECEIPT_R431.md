# POD run receipt R431

Run completed at `2026-11-03T19:15:10Z` using only the repositories'
existing GitHub Actions workflow and the owner's existing free Render service.
This receipt records code, CI and deployment-state evidence; it does not claim
live marketplace acceptance.

## Reconciled starting state

- Content Control `main` was
  `8aa4c5e6d8120e34cacef3c3fa336a2b25bc8406`.
- Money Factory `main` was
  `2cc324a61a764ecb79e7dd794697b6770e4eafe7`.
- Content Control commits
  `c0265d8f7dce02dcab1817865f1b5dcf52d58049`,
  `9a330e9768c3e373cd83a8b65fced72569476bc0`,
  `fb0951704e153615448d48b3dd692a239df59306` and
  `8aa4c5e6d8120e34cacef3c3fa336a2b25bc8406` were concurrent
  security-audit, watchdog, QA and ledger work after the R430 receipt.
  Money Factory commit `2cc324a61a764ecb79e7dd794697b6770e4eafe7`
  was a concurrent free-monitor cadence update. All were preserved.
- Neither repository had an open PR, so no concurrent POD job was duplicated.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one
  of the 24 acceptance areas.

## Confirmed defect and repair

Money Factory's authoritative signed-event receiver validated and later invoked
the database pool's `connect` capability and acquired clients' `query` and
`release` capabilities through ordinary property access. Accessor-backed or
Proxy-backed capabilities could therefore execute during receiver construction,
transaction acquisition, acknowledgement or cleanup, and a mutable capability
could differ after construction validation.

An expected-red matrix reproduced all six missing rejection paths: a pool Proxy,
a pool `connect` accessor, client `query` and `release` accessors, plus
handler construction with the executable pool Proxy and accessor. All six tests
failed before the production repair because the receiver accepted the shapes
instead of rejecting them.

The repair resolves each capability only from an inert data descriptor on the
verified object/prototype chain, rejects Proxies and accessors without invoking
them, binds the accepted method to its original receiver and caches the verified
pool connection function so construction and request processing use the same
capability. Invalid evidence fails with
`EVENT_DATABASE_CAPABILITY_UNVERIFIED` before database work.

Local verification after the repair:

- focused event capability, query, connection, HTTP and transaction matrix:
  48 passed, zero failed;
- complete Money Factory POD integration suite with `CONTENT_CONTROL_ROOT`:
  134 passed, one PostgreSQL-only skip, zero failed, 135 total;
- `node --check` for the receiver and handler plus `git diff --check`
  passed.

## Hosted verification and merge

Money Factory PR 386 contained only
`integrations/pod/event-inbox.mjs`,
`integrations/pod/event-handler.mjs` and
`integrations/pod/event-capability-evidence.test.mjs`. Its exact base retained
the concurrent free-monitor commit and its final exact head was
`d922caf8e4f4bcfb0b4345a358cd38f69f5922ce`.

Cross-repository workflow run `41700598628`, job `126142553218`, completed
successfully. It verified pinned contracts, strict Python evidence, recovery,
KDP metadata/editorial QA, independent art/layout/PDF/cover/font/template
evidence, the full Node POD suite and the full Python POD suite. PR 386 was
squash-merged as `d68e3d650c981311148641ecdf4e544b88502b89`.

The workflow blob remained
`9838d1a44edd8297362dded6e9b121d17014f639` and retained literal
`PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Deployment reconciliation

This run changed Money Factory only and did not request or require a Content
Control deployment. The authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained
unsuspended on the free plan with `main` auto-deploy, Docker runtime and
`/health` health check.

The watchdog-evidence deployment `dep-dbl2ldss728c739dbeqg` ended
`update_failed`, but it was superseded by deployment
`dep-dbl2o5tlmcpc73dsmatg` on preserved current Content Control head
`8aa4c5e6d8120e34cacef3c3fa336a2b25bc8406`. The latter started at
`2026-11-03T19:00:25.486601Z` and reached `live` at
`2026-11-03T19:02:34.963136Z`. No manual redeploy, cache clear, plan change,
purchase or secret access was used. This proves service deployment liveness,
not canonical `/readyz`, accepted review evidence, marketplace connectivity
or end-to-end acceptance.

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
