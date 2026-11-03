# POD run receipt R424

Run completed at `2026-11-03T12:00:20Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at R423 receipt merge
  `6a8a5b360967a2aed4030be56cddbb6949fb4e5a`.
- Money Factory `main` began at
  `e1f520a55783a0d8a3644631d487b4780995ed5a`.
- Render deployment `dep-dbks9vh23ouc738v1010` was live on exact functional
  merge `1c2217530304485ceac0b8a3c6c60fd12943d6fe`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Money Factory PRs 80 and 81 are Etsy work and remain
  excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

Owner-facing `reviewPackage` and `reviewArtifact` retrieval trusted
`result.rows[0]` and directly read returned manifest and artifact body fields.
Accessor-backed database result rows or nested evidence could therefore
execute during independent-QA retrieval, and an ordinary mutable Buffer could
remain caller-owned after the query boundary.

Four expected-red regressions covered executable package `rows`, package
`manifest`, artifact `rows` and artifact `body` evidence. Before the repair,
the focused file ran nine tests: five passed and all four new cases failed with
`Missing expected rejection`. The repair adds exact projected-row snapshots,
requires inert evidence with the expected route identity, snapshots structured
manifest JSON, rejects executable bodies without invocation, and copies an
ordinary Buffer before caller use. Existing `PACKAGE_UNAVAILABLE` and
`ARTIFACT_UNAVAILABLE` route-mismatch behavior remains intact.

After the repair:

- the focused review, admission, release, expiry and operations suites: 126
  passed, zero failed;
- an additional relevant verification set: 67 passed, zero failed;
- complete local `npm run test:pod`: 1,085 passed, nine environment-gated
  skips, zero failed, 1,094 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 984 used exact head
`e9e00347048fd2741444d4dbea5d66096a80a2fe`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `f944296052deef1c11f399ebf9520a495cf2f2d0`;
- `tests/pod-review-event-provenance.test.mjs`:
  `68b834e80f7220b4574c706b7eeb6869552ba440`;
- `tests/pod-review-storage-expiry.test.mjs`:
  `99a129cb2e7b7b69e1947d3d3ec0377593edf158`.

Exact-head integration run `41630475612`, job `125898443799`, and container
run `41630475646`, job `125898444081`, both completed successfully. PR 984
merged as `8fdf8a39d1901432a87e8435ae67734e716dc7f7`.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbksnbss728c73933f5g` for that exact functional merge. It started at
`2026-11-03T11:55:27.088947Z` and reached `live` at
`2026-11-03T11:56:40.85715Z`; the preceding deployment was deactivated. No
manual redeploy, cache clear, plan change, purchase or secret access was used.
This proves deployment liveness for the repaired image, not canonical
`/readyz`, accepted review evidence, marketplace connectivity or end-to-end
acceptance.

Money Factory PR 379 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`8fdf8a39d1901432a87e8435ae67734e716dc7f7` and adding
`tests/pod-review-storage-expiry.test.mjs` to the existing review-provenance
cross-repository gate. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED`
remain literal `false`. Exact head
`866338c41ec48ba2a9eb6b2a1a931c26b0f1ddef` passed cross-repository run
`41631483248`, job `125901871258`, including the final metadata/editorial QA,
Node POD integration suite and Python POD suite. PR 379 merged as
`f7f43f69c2200865dd9cacc715eb30176533547f`. Its current base preserved the
concurrent `free monitor cadence tick` commit
`2b1a54fa72c8b8fc9d2258ceaf3fc414eae6eaa7`.

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
