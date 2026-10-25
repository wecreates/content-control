# POD run receipt r250 — lossless template provenance text

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`bf4166c917885ea005240e8180e3cbdf321290b9`; Money Factory started from
`7701d9551246aa3a19584e833a377df810c160e5`. The current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
There were no overlapping open pull requests. The previously failed database-
administration route had no credible access change and was not retried. No
resource, credential, account, network rule or marketplace state was created or
changed.

## Repair and regression evidence

Signed official-template provenance accepted product names, source URLs and KDP
archive-member paths containing NUL or unpaired UTF-16 surrogates. Persisted task
template scopes accepted the same lossy product text. PostgreSQL text cannot
store NUL, and Node UTF-8 encoding replaces unpaired surrogates, so validly
signed input could fail or change after verification at URL, path, process or
durable-storage boundaries.

[Content Control PR 596](https://github.com/wecreates/content-control/pull/596)
requires those fields to contain no NUL and round-trip through UTF-8 exactly
before downstream handling. It preserves exact valid Unicode, combining marks,
URL spelling and archive-member names without normalization or repair.

Regression-first verification passed 81 of 83 focused tests and failed the two
new persistence-boundary cases. After repair, the combined template, task,
market and intake suites passed 117/117. The complete local POD Node suite ran
745 tests: 736 passed, nine intentional environment-gated tests skipped and
zero failed. The first hosted integration attempt, job `121102409834`, hit an
unrelated two-second CLI-fixture initialization timeout; the adjacent signal
tests passed. Only that failed job was retried against the unchanged head.
Exact-head
[integration run 40171272376](https://github.com/wecreates/content-control/actions/runs/40171272376),
retry job `121102803647`, and
[production-container run 40171272281](https://github.com/wecreates/content-control/actions/runs/40171272281),
job `121102409624`, completed successfully. The container gate built the
production image and passed dependency/non-root, Python, Node/PostgreSQL, real
print/durable-review and publication-disabled startup stages.

The exact Content Control head was
`7535c6bccdb62b6856bccc8d399d533435724647`; its tree
`b532b565a109d5783989a9ad49eb2a47aa484df2` matched the locally tested tree.
PR 596 merged as `3e74b588a234b4b28ff7722987ccf7c48a1d387c`, whose merge tree remained
exactly `b532b565a109d5783989a9ad49eb2a47aa484df2`.

[Money Factory PR 206](https://github.com/wecreates/Money-factory/pull/206)
pins that immutable Content Control merge while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Local Money
Factory verification passed 117 Node tests and 81 Python tests. Exact tested
head `d2f59e886cf06547e9d65199a2bb00cfbf032db8` and tree
`3c9857a4245d552970fb4304ad526f8d8cf7d0aa` passed
[cross-repository run 40171851133](https://github.com/wecreates/Money-factory/actions/runs/40171851133),
job `121104153693`, including pinned contracts, recovery, rights, templates,
KDP/editorial, Node, Python and bridge stages. PR 206 merged as
`265cefbab29364d559b1e0c3f54c93dcae190965`; its merge tree matched the tested
tree.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbeqmp15efls73b9pjc0`. Deploy-start event
`evt-dbeqmpb8vfls738q28ag` bound exact commit
`3e74b588a234b4b28ff7722987ccf7c48a1d387c`. Event
`evt-dbeqmpcegpmc73bo87sg` reported `pipeline_minutes_exhausted`, and event
`evt-dbeqmpda647c73eg813g` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed template-
provenance persistence boundary only; code and hosted CI are not live source
authorization, database, marketplace or deployment acceptance. Production
restricted database/schema/migrations, retained recovery and expiry resolution,
deployed hybrid dependencies, mounted Money Factory authority and current
grants/revocation, real accounts/sources/rights/templates/reviewers, authorized
KDP/Redbubble/TeePublic/Zazzle/Spreadshirt adapters, actual economics and
provider-statement reconciliation, owner-phone acceptance,
monitoring/recovery drills, measured capacity and a real authorized end-to-end
launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
