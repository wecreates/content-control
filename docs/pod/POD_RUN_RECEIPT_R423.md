# POD run receipt R423

Run completed at `2026-11-03T11:31:45Z` using only the repositories'
existing GitHub Actions workflows and the owner's existing free Render service.
This receipt records code and deployment evidence; it does not claim live
marketplace acceptance.

## Reconciled starting state

- Content Control `main` began at receipt merge
  `0b7a489dc12fb5065efdf9bd15736f9216ed152e`.
- Money Factory `main` began at
  `a4fbdc1e5b70b54700e08ccba87482c0af736008`.
- Render deployment `dep-dbkre8rbc2fs7387fomg` was live on exact functional
  merge `9e31ad9c1372d9b61e350e61a182aed21992e9b8`.
- No open POD/KDP implementation PR duplicated this work. Content Control draft
  PR 378 explicitly excludes POD changes. Money Factory PR 170 is an unrelated
  offline-adapter draft; Etsy remains excluded from this lane.
- `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and
  `POD_FREE_DEPLOYMENT.md` still require actual live evidence for every one of
  the 24 acceptance areas.

## Confirmed defect and repair

`acceptReview` selected `q.*`, trusted `result.rows[0]`, and then read the
returned manifest, platform and manifest hash before promoting the queue row to
`qa_passed` and writing the review audit event. Accessor-backed database result
or manifest evidence could therefore execute and influence the independent-QA
durable promotion.

Two expected-red regressions covered executable `rows` and `manifest`
evidence. Before the repair, the focused file ran five tests: three passed and
both new cases failed with `Missing expected rejection`. The repair replaces
the broad projection with the exact four required fields, requires an inert
exact row and job identity, and snapshots structured manifest JSON before any
write. Both accessors are rejected as `POD_QUERY_UNVERIFIED` without invocation
or writes.

After the repair:

- review-event-provenance, QA-expiry and review-admission suites: 38 passed,
  zero failed;
- complete local `npm run test:pod`: 1,081 passed, nine environment-gated
  skips, zero failed, 1,090 total;
- `git diff --check` and `node --check pod-db-bridge.js` passed.

## Hosted verification and merges

Content Control PR 982 used exact head
`a528e6a824d83855002e62287d5900e1ad7e89d5`. Remote blobs matched the locally
tested files:

- `pod-db-bridge.js`: `38f421c50953483f4ecdb62aa5fd302e7b5dd1cf`;
- `tests/pod-qa-expiry.test.mjs`:
  `f691cb9668f136728591b144c46f252ceec36862`;
- `tests/pod-review-event-provenance.test.mjs`:
  `715cd9a1234a260a016440e3c2786272ef952f00`.

Exact-head integration run `41626649779`, job `125885577160`, and container
run `41626650059`, job `125885577942`, both completed successfully. PR 982
merged as `1c2217530304485ceac0b8a3c6c60fd12943d6fe`.

Concurrent Content Control work was preserved. Main included watchdog evidence
commit `4557e44df8bd88b3df50d563f08396512ae10aea`, zero-credit V10 QA evidence
commit `8c8265938090b975ba7084f27e3dd9f9d6c752b8`, and accepted-candidate
rollback-ledger commit `cf20b95c91ab59bda1488d99a45a3e3894db9f60` before the functional
merge. This receipt is based on that resulting current main rather than an
older branch head.

The authorized Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) automatically created deployment
`dep-dbks9vh23ouc738v1010` for the exact functional merge. It reached `live` at
`2026-11-03T11:28:57.456832Z`; the preceding concurrent deployment was
deactivated. No manual redeploy, cache clear, plan change, purchase or secret
access was used. This proves deployment liveness for the repaired image, not
canonical `/readyz`, accepted review evidence, marketplace connectivity or
end-to-end acceptance.

Money Factory PR 378 changed only `.github/workflows/pod-production.yml`,
pinning exact Content Control merge
`1c2217530304485ceac0b8a3c6c60fd12943d6fe` and adding
`tests/pod-review-event-provenance.test.mjs` to the cross-repository gate.
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `false`.
Exact head `b8537bee4373b1a9cab1675e282ab61ac9c66a7f` passed cross-repository
run `41627691169`, job `125889108289`, including every verification step, and
PR 378 merged as `e1f520a55783a0d8a3644631d487b4780995ed5a`.

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
