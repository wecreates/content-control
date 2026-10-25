# POD run receipt r247 — lossless grant evidence identities

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`6ee8c853cc48d091b0d81b023452e866e398a937`; Money Factory started from
`8e1d0825aa4cbaf978a47a44dfbdd1bef426f33d`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
The open pull requests were older unrelated drafts and did not overlap this POD
work. The previously failed database-administration route had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

The signed grant consumer accepted claim names, claim evidence references and
price evidence references that contained NUL or unpaired UTF-16 surrogates.
Money Factory's grant issuer also accepted these strings in durable job,
business, account and approval-event identities. PostgreSQL text/JSON cannot
store NUL, and unpaired UTF-16 surrogates are replaced during UTF-8 encoding.
An authenticated identity could therefore fail at durable storage or lose its
exact spelling after authority verification.

[Content Control PR 590](https://github.com/wecreates/content-control/pull/590)
reuses the shared opaque-text predicate for grant evidence identities. Invalid
claim entries and prices are omitted before they enter a Content Control brief;
valid case, spacing, Unicode and the existing 256-character limit remain exact.

The new Content Control regressions first passed two tests and failed three:
malformed claim keys, claim evidence references and price evidence references
were accepted. After repair, focused policy/release suites passed 42/42 and the
workflow-selected Node suites passed 535/535. Exact-head
[integration run 40161284024](https://github.com/wecreates/content-control/actions/runs/40161284024),
job `121073189963`, and
[production-container run 40161283988](https://github.com/wecreates/content-control/actions/runs/40161283988),
job `121073190199`, both completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`3f73ee4143ef6f8756aa0c6818c32d7335ee13a5`; its tree
`8c69253a4040be2128e7f4672a3247f1f89b62cc` matched the locally tested tree.
PR 590 merged as `986aa3799630106f1128949d78f9f8d64defd883`, whose merge tree remained
exactly `8c69253a4040be2128e7f4672a3247f1f89b62cc`.

[Money Factory PR 203](https://github.com/wecreates/Money-factory/pull/203)
reuses the same predicate before signing durable grant scope and approval-event
identities, adds issuer/consumer round-trip coverage and advances the immutable
Content Control pin. Its pre-repair authority regressions passed four tests and
failed two. After repair, the complete Money Factory POD Node suite passed 116
tests with one intentional PostgreSQL environment skip. Exact tested head
`3d6c412fc62518fdc2e10b99f5b57f55d490b189` and tree
`a00ed51da263537b63a1b9aa4632e0530b09ae97` retained explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`.
Exact-head
[run 40161627888](https://github.com/wecreates/Money-factory/actions/runs/40161627888),
job `121074226473`, passed every recovery, rights, template, editorial,
package, Node, Python and bridge stage. PR 203 merged as
`e66947298cbab60cb7500b656ba62d86fba53f34`; its merge tree matched the
tested tree.

## Deployment and acceptance state

Render automatically attempted the runtime merge as deploy
`dep-dbeo7h6q1p3s73ef8isg`, but failed before application build at
`2026-10-25T04:21:25Z` because free pipeline minutes remained exhausted. The
exact events were deploy start `evt-dbeo7hatgp5s739ak9eg`,
`pipeline_minutes_exhausted` `evt-dbeo7hegej5s73a099ig`, and failed deploy end
`evt-dbeo7hegej5s73a099k0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed grant and
evidence identity boundary only; code and hosted CI are not live authority,
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
