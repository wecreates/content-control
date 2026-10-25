# POD run receipt r255 — bounded review-route admission

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`d5beb8535d6c97ffad0e3f91c004a68fba1dbe07`; Money Factory started from
`1706a1f266ddf9af2266449317820f6e12fe91b5`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no open POD pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

The authenticated artifact endpoint already bounded its review job route before
PostgreSQL, but package retrieval and signed review acceptance did not apply the
same contract. Out-of-contract route values could therefore acquire the pool or
reach query parameter binding before the database rejected them. Review
acceptance authenticated its QA envelope first, but did not reject the malformed
target until after transaction admission. This was an operational/security
admission gap; no unauthorized live review or database mutation is claimed.

[Content Control PR 611](https://github.com/wecreates/content-control/pull/611)
applies the existing 1–100 character ASCII letter, digit, underscore and hyphen
review-job contract to package retrieval and signed review acceptance before
database access. Review authentication still runs first so malformed targets
cannot mask an invalid signature. Stored hold state, manifest identity, rights,
package/template hashes, platform, current QA expiry and transactional
revalidation remain mandatory.

The regression-first focused suite ran 22 tests: the authentication-order and
valid-target controls passed, while 20 malformed package/review targets failed
because they reached a database boundary. After repair, the combined review,
release and expiry suites passed 57/57. The complete local POD Node suite ran
806 tests: 797 passed, nine intentional environment-gated tests skipped and zero
failed. The production end-to-end command retained its one intentional
environment skip. JavaScript syntax, workflow control, four free-review guards
and diff checks also passed. Exact-head
[integration run 40189416296](https://github.com/wecreates/content-control/actions/runs/40189416296),
job `121157027456`, and
[production-container run 40189416279](https://github.com/wecreates/content-control/actions/runs/40189416279),
job `121157027431`, completed successfully. The container gate built the
production image and passed dependency/non-root, full Python,
Node/PostgreSQL, durable review and publication-disabled startup stages.

The exact Content Control head was
`05a79ee82b0e2360f7fd9e7ba39637c1679cfe6a`; its tree
`a140b07b1ada35e92585beee3669303d33ebb3f8` matched the locally tested tree.
PR 611 merged as `ecec45ce8d7c74b142968db05372890938233b5b`, whose merge tree remained
exactly `a140b07b1ada35e92585beee3669303d33ebb3f8`.

[Money Factory PR 211](https://github.com/wecreates/Money-factory/pull/211)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification ran 117 Node tests: 116 passed, one intentional PostgreSQL
environment skip and zero failed; its Python suite passed 81/81. Exact tested
head `59dd08b67624651dcfd9bf44356d3df58ec7209f` and tree
`5e6522109d7a513a6aa77c328b78898ea06763ea` passed
[cross-repository run 40189984699](https://github.com/wecreates/Money-factory/actions/runs/40189984699),
job `121158712760`, including all pinned contracts, recovery, rights,
templates, KDP/editorial, Node, Python and bridge stages. PR 211 merged as
`78e8fb2c91e7188b924e3e21c1ab8a736a4e9540`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbeulmm7bikc73bk774g`. Deploy-start event
`evt-dbeulmjphbkc73a1shug` bound exact commit
`ecec45ce8d7c74b142968db05372890938233b5b`. Event
`evt-dbeulmr4qb4c73a1j15g` reported `pipeline_minutes_exhausted`, and event
`evt-dbeulmr4qb4c73a1j180` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one review-route
admission boundary only; code and hosted CI are not live source authorization,
database, marketplace or deployment acceptance. Production restricted
database/schema/migrations, retained recovery and expiry resolution, deployed
hybrid dependencies, mounted Money Factory authority and current
grants/revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider-statement reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
