# POD run receipt R430

Run completed at `2026-11-03T18:24:36Z` using only the repositories'
existing GitHub Actions workflow and the owner's existing free Render service.
This receipt records code, CI and deployment-state evidence; it does not claim
live marketplace acceptance.

## Reconciled starting state

- Content Control `main` was
  `2b5303837ad8efbe70edd78b8a87e5288164bd36`.
- Money Factory `main` was
  `0330697bd6ce6ce62818b93c29abcfb3934f3373`.
- Content Control commits
  `355f7b765cf04ba870cf1391b060a3858d068a6f` and
  `2b5303837ad8efbe70edd78b8a87e5288164bd36` were concurrent non-POD
  QA/ledger work after the R429 receipt. Their current head was preserved and
  no files from that work were modified.
- Neither repository had an open PR, so no concurrent POD job was duplicated.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one
  of the 24 acceptance areas.

## Confirmed defect and repair

Money Factory's authoritative signed-event inbox directly dereferenced the
PostgreSQL query result's `rows[0].event_sha256` while deciding whether a
replayed Content Control event matched the stored event. Accessor-backed or
Proxy-backed result evidence could therefore execute during the acknowledgement
decision; sparse or missing results also escaped as unscoped JavaScript errors.

An expected-red matrix reproduced all eight missing rejection paths: a result
`rows` accessor, rows Proxy, row Proxy, field accessor, sparse rows, oversized
rows, an extra field and a missing row. All eight failed before the production
repair for the intended reason.

The repair now requires one exact dense result row with one inert own enumerable
data field, rejects result/array/row Proxies, accessors, sparse or oversized
arrays and unexpected fields with the fixed `EVENT_QUERY_UNVERIFIED` error,
and copies accepted evidence into a null-prototype snapshot. Rejected evidence
rolls back and releases the reusable client without committing.

Local verification after the repair:

- focused event/clock suite: 68 passed, one PostgreSQL-only skip, zero failed;
- complete Money Factory POD integration suite with `CONTENT_CONTROL_ROOT`:
  128 passed, one PostgreSQL-only skip, zero failed, 129 total;
- `node --check integrations/pod/event-inbox.mjs` and
  `git diff --check` passed.

## Hosted verification and merge

Money Factory PR 385 contained only
`integrations/pod/event-inbox.mjs` and
`integrations/pod/event-query-evidence.test.mjs`. Its final exact head was
`37d90d74f7e84a078bf990e4b51603c7caa129ef`.

Cross-repository workflow run `41692766103`, job `126115322041`, completed
successfully. It verified pinned contracts, strict Python evidence, recovery,
KDP metadata/editorial QA, independent art/layout/PDF/cover/font/template
evidence, the full Node POD suite and the full Python POD suite. PR 385 was
squash-merged as `3c08677f031c83ac88a33b50f6b40101ec4e1d14`.

The workflow blob remained
`9838d1a44edd8297362dded6e9b121d17014f639` and retained literal
`PUBLICATION_ENABLED: 'false'` and `POD_PUBLICATION_ENABLED: 'false'`.

## Deployment reconciliation

This run changed Money Factory only and did not request or require a Content
Control deployment. The authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained
unsuspended on the free plan with `main` auto-deploy, Docker runtime and
`/health` health check.

Its current live deployment remained `dep-dbl22bdlmcpc73drvbg0` on preserved
Content Control head `2b5303837ad8efbe70edd78b8a87e5288164bd36`. It started
at `2026-11-03T18:03:51.368408Z` and reached `live` at
`2026-11-03T18:05:07.863902Z`. No manual redeploy, cache clear, plan change,
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
