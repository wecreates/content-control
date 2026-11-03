# POD run receipt R433

Run completed at `2026-11-03T20:39:09Z` using only the repositories'
existing GitHub Actions workflow and the owner's existing free Render service.
This receipt records code, CI and deployment-state evidence; it does not claim
live marketplace acceptance.

## Reconciled starting state

- Content Control `main` was
  `ef840a948ae1678726c70a62a614f5fe5413c485`.
- Money Factory `main` was
  `cd07d99d71b03d799585e4bd54e780d26cff71d0`.
- Content Control commits
  `2605c5df2d0c95348583542adcedb2aa92a8606d`,
  `e171f517b43646fd7e05834ca1b87ec3a9d659c9`,
  `f01930b00c206e35c275df744a14471e9127fc15` and
  `ef840a948ae1678726c70a62a614f5fe5413c485` were concurrent mobile-health,
  watchdog, QA and rollback-ledger work after the R432 receipt. All were
  preserved.
- Neither repository had an open PR, so no concurrent POD job was duplicated.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one
  of the 24 acceptance areas.

## Confirmed defect and repair

R432 made the HTTP authority handler copy loader-returned snapshots through
descriptor-only validation, but Money Factory's exported `issuePodGrant`
signer still destructured, read and signed direct authoritative inputs without
the same evidence boundary. A direct caller could therefore provide
Proxy-backed or accessor-backed job, readiness, approval or verified-fact
evidence outside the HTTP handler.

An expected-red matrix reproduced six missing rejection paths: a top-level
input Proxy, a top-level `job` accessor, a nested `job` Proxy, a
`readiness.businesses` accessor, an `approval` Proxy and a
`verifiedFacts` Proxy. Before the production repair all six executable
shapes were accepted instead of throwing
`AUTHORITY_SNAPSHOT_UNVERIFIED`.

The repair moves the existing bounded descriptor-only copier into the grant
signing module. The HTTP handler reuses it in strict JSON-like mode before the
request/snapshot identity check. The exported signer independently copies
direct inputs before any authority decision and rejects Proxies, accessors,
cycles, unsupported prototypes and excessive depth/object counts without
invoking executable members. Its direct-call mode preserves the existing
readiness, approval and mode error classification for inert malformed values.

Local verification after the repair:

- the focused authority and economics matrix passed 56 tests with zero
  failures;
- the complete Money Factory POD integration suite with
  `CONTENT_CONTROL_ROOT` passed 148 tests, skipped one PostgreSQL-only test
  and had zero failures, 149 total;
- syntax checks for both changed runtime modules and `git diff --check`
  passed.

## Hosted verification and merge

Money Factory PR 388 contained only
`integrations/pod/authority-handler.mjs`,
`integrations/pod/readiness-grant.mjs` and
`integrations/pod/authority-grant-evidence.test.mjs`. Its exact base was
`cd07d99d71b03d799585e4bd54e780d26cff71d0` and its final exact head was
`704ec9f32d3eb2553b46d03f287d937dbd52695e`.

Cross-repository workflow run `41713720135`, job `126188130891`, completed
successfully. Every step passed, including pinned contracts, strict Python
evidence, bounded JSON and export handling, recovery, output safety, original
art and independent layout, KDP PDF/cover pairing, font rights, retained
official templates, comprehensive KDP metadata/editorial QA, the full Node POD
suite and the full Python POD suite. PR 388 was squash-merged as
`035576e748f8a850ba39456ec45e1d29275bd3e3`.

The Money Factory production workflow at the merged commit retained literal
`PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`.

## Deployment reconciliation

This run changed Money Factory only and did not request or require a Content
Control deployment. The authorized Render service
`content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) remained
unsuspended on the free plan with `main` auto-deploy, Docker runtime and
`/health` health check.

The preserved concurrent Content commits deployed in order. Deployment
`dep-dbl44tebk0kc73fqgbbg` on current Content Control head
`ef840a948ae1678726c70a62a614f5fe5413c485` started at
`2026-11-03T20:23:40.647895Z` and reached `live` at
`2026-11-03T20:25:15.825555Z`, superseding the earlier concurrent deploys.
No manual redeploy, cache clear, plan change, purchase or secret access was
used. This proves service deployment liveness, not canonical `/readyz`,
accepted review evidence, marketplace connectivity or end-to-end acceptance.

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
  canonical review artifact remains unaccepted, `/readyz` is not verified
  green and the saved deployment-health receipt remains fail-closed.
- All 24 acceptance areas remain OPEN. Publication remains disabled pending the
  owner's explicit approval only after every criterion has verifiable live
  evidence.
- The completion automation therefore remains enabled.
