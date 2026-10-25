# POD run receipt r249 — lossless market evidence text

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`b4a21e0f3eeb730a175ad1eba734ed7485c26737`; Money Factory started from
`e64be9ac545a1392ff3559600004522198922fff`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

The authenticated market intake accepted signed source URLs, categories and
nested observations-JSON strings containing NUL or unpaired UTF-16 surrogates.
PostgreSQL text/JSONB cannot store NUL, and Node UTF-8 encoding replaces
unpaired surrogates. Validly signed evidence could therefore reach SQL and then
fail or change at the durable boundary.

[Content Control PR 594](https://github.com/wecreates/content-control/pull/594)
requires the source URL and category, plus every string key and value in the
observations JSON, to round-trip through UTF-8 exactly and contain no NUL before
transaction entry. It preserves exact valid Unicode, URL spelling, JSON keys,
array order and values without normalization or repair.

Regression-first verification on current main passed 20 focused market tests
and failed the two new persistence-boundary tests. After repair, the combined
market/identity suites passed 47/47, and the complete local POD Node suite passed
734 tests with nine intentional environment-gated skips and zero failures.
Exact-head
[integration run 40168647332](https://github.com/wecreates/content-control/actions/runs/40168647332),
job `121094800253`, and
[production-container run 40168647365](https://github.com/wecreates/content-control/actions/runs/40168647365),
job `121094800263`, both completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`ba371c0f594d31cf18809a35b08fa672f19d0e38`; its tree
`de836b4d6fbe57f1c3bbe93691f3e26379423ce3` matched the locally tested tree.
PR 594 merged as `d7af6cb719f3ffefc7f9ddfc53042a447f590155`, whose merge tree remained
exactly `de836b4d6fbe57f1c3bbe93691f3e26379423ce3`.

[Money Factory PR 205](https://github.com/wecreates/Money-factory/pull/205)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. The complete
local Money Factory POD Node suite passed 116 tests with one intentional
PostgreSQL environment skip and zero failures. Exact tested head
`0654b331ba3b1ebc2862e5f75ccc33a2535992fd` and tree
`0c1b765774d34f253bd5f8f6985554fe94ae0ebe` passed
[cross-repository run 40169119379](https://github.com/wecreates/Money-factory/actions/runs/40169119379),
job `121096182417`, including the selected Content Control market regression,
recovery, rights, templates, KDP/editorial, Node, Python and bridge stages. PR
205 merged as `1df45ea7a8fb27338795186a91691039bba73786`; its merge tree matched the
tested tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbeq1rqjnfac73e26910`. Deploy-start event
`evt-dbeq1rrphbkc739uvfgg` bound exact commit
`d7af6cb719f3ffefc7f9ddfc53042a447f590155`. Event
`evt-dbeq1rrsp5es73c9raog` reported `pipeline_minutes_exhausted`, and event
`evt-dbeq1ro4cbqc73djgm50` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authenticated
market-evidence persistence boundary only; code and hosted CI are not live
source authorization, database, marketplace or deployment acceptance.
Production restricted database/schema/migrations, retained recovery and expiry
resolution, deployed hybrid dependencies, mounted Money Factory authority and
current grants/revocation, real accounts/sources/rights/templates/reviewers,
authorized KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics
and provider-statement reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
