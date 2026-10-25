# POD run receipt r248 — lossless verified claim text

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`ce6afb17642ac1c48f4bfea2429edfc4cb1cda40`; Money Factory started from
`e66947298cbab60cb7500b656ba62d86fba53f34`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
Open pull requests were older unrelated drafts and did not overlap this work.
The previously failed database-administration route had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

The grant consumer already rejected lossy claim and price evidence identities,
but an authenticated verified-claim value could still contain NUL or unpaired
UTF-16 surrogates. PostgreSQL text/JSON cannot store NUL, and unpaired UTF-16
surrogates are replaced during UTF-8 encoding. A claim could therefore pass
authority verification and then fail or change at the durable boundary.

[Content Control PR 592](https://github.com/wecreates/content-control/pull/592)
requires claim values to round-trip through UTF-8 exactly and contain no NUL
before including them in a brief. It preserves exact case, spacing and valid
Unicode. Claim values retain the signed envelope's 262,144-byte ceiling instead
of inheriting the shorter 256-character identity ceiling.

The new focused Content Control regression first passed four tests and failed
one because NUL claim text was admitted. The actual Money Factory issuer/Content
Control consumer round trip first passed one test and failed one because NUL and
unpaired-surrogate values survived admission. After repair, focused
policy/release suites passed 38/38, the workflow-selected Content Control Node
suites passed 535/535, and the complete Money Factory POD Node suite passed 116
tests with one intentional PostgreSQL environment skip.

Exact-head
[Content Control integration run 40162689465](https://github.com/wecreates/content-control/actions/runs/40162689465),
job `121077366308`, and
[production-container run 40162689505](https://github.com/wecreates/content-control/actions/runs/40162689505),
job `121077366622`, both completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`7ca4c96c091421498fc20b72c40cfbbd296f6cc7`; its tree
`78176c7698a3c359361cc03acdf7568b76011e9b` matched the locally tested tree.
PR 592 merged as `2817e384c15ead82431ca3067e4986e51e54e1d3`, whose merge tree remained
exactly `78176c7698a3c359361cc03acdf7568b76011e9b`.

[Money Factory PR 204](https://github.com/wecreates/Money-factory/pull/204)
pins that immutable Content Control merge, documents the lossless claim-value
contract and carries the issuer/consumer regression. Exact tested head
`035a86b59a17643a61415faa48e889e68f368d75` and tree
`f4c2bb9eb272a800ed913fa9bc5b0dbf7aeb0cdf` retained explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
Exact-head
[run 40163151041](https://github.com/wecreates/Money-factory/actions/runs/40163151041),
job `121078726702`, passed every recovery, rights, template, editorial,
package, Node, Python and bridge stage. PR 204 merged as
`e64be9ac545a1392ff3559600004522198922fff`; its merge tree matched the
tested tree.

## Deployment and acceptance state

Render automatically attempted the runtime merge as deploy
`dep-dbeoja4s728c73cq13r0`, but failed before application build at
`2026-10-25T04:46:33Z` because free pipeline minutes remained exhausted. The
exact events were deploy start `evt-dbeoja04cbqc73dikam0`,
`pipeline_minutes_exhausted` `evt-dbeojaegej5s73a0fk60`, and failed deploy end
`evt-dbeojaebs3rs73c86au0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one verified-claim
text persistence boundary only; code and hosted CI are not live authority,
database, marketplace or deployment acceptance. Production restricted
database/schema/migrations, retained recovery and expiry resolution, deployed
hybrid dependencies, mounted Money Factory authority/current grants and
revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider-statement reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
