# POD run receipt r256 — held-manifest event provenance

Date: 2026-10-25

## Reconstructed state and scope

Content Control started from main
`df2c1b1895e06ef094bf9c28acaa7606ea5420ca`; Money Factory started from
`2e9dcbb3a0a590023422abee3b1684ef517c2ce8`, including the newer concurrent
free-monitor cadence commit. The current completion, implementation-status and
free-deployment documents, open pull requests, workflow results and the
authorized existing Render service were inspected. There were no open POD pull
requests, and the concurrent Money Factory commit did not overlap this repair.
The previously failed database-administration route had no credible access
change and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Authenticated review-package and review-artifact retrieval selected a stored
`manifest_sha256` from the newest event for the held job without constraining
the event kind. A later unrelated event carrying a field with that generic name
could shadow the immutable review-hold event, making a valid held package
unavailable and disconnecting the retrieval decision from its provenance. This
was a durable-review/security provenance gap; no unauthorized live review or
database mutation is claimed.

[Content Control PR 614](https://github.com/wecreates/content-control/pull/614)
binds both retrieval queries to `pod.production.review_required` while retaining
the exact held queue state, reason, platform, current stored manifest and
artifact-membership checks. The storage contract now records that event-kind
binding. A structural regression test covers both queries, and the real
disposable-PostgreSQL production test inserts a later unrelated shadow event and
then verifies that package and artifact retrieval still resolve the held
manifest.

Before the repair, the focused structural test failed 1/1 because neither query
specified the review-hold event kind. After repair, the combined review,
release and expiry suites passed 47/47. The complete local POD Node suite ran
807 tests: 798 passed, nine intentional environment-gated tests skipped and zero
failed. The production end-to-end command retained its one intentional local
environment skip. JavaScript syntax, workflow control, four free-review guards
and diff checks also passed. Exact-head
[integration run 40196568155](https://github.com/wecreates/content-control/actions/runs/40196568155),
job `121178551987`, and
[production-container run 40196568178](https://github.com/wecreates/content-control/actions/runs/40196568178),
job `121178552065`, completed successfully. The integration gate exercised the
new PostgreSQL shadow-event regression; the container gate built the production
image and passed dependency/non-root, Python, Node/PostgreSQL, durable review and
publication-disabled startup stages.

The exact Content Control head was
`886cac4037680fb6ecc40f85241b7702a318d8e6`; its tree
`604524953218651c52bcbff903ad8db8afca8e3a` matched the locally tested tree.
PR 614 merged as `abf947be68b4a92c13fff8bbb85f1619d6eef854`, whose merge tree remained
exactly `604524953218651c52bcbff903ad8db8afca8e3a`.

[Money Factory PR 212](https://github.com/wecreates/Money-factory/pull/212)
pins that immutable Content Control merge while preserving the concurrent
monitor-cadence update and explicit `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false`. Local Money Factory verification ran 117 Node
tests: 116 passed, one intentional PostgreSQL environment skip and zero failed;
its Python suite passed 81/81. Exact tested head
`9861aeeb72f04fd48490cdc311083a406a371489` and tree
`b03b5d488656bf8639785caa59c19ec5c0e382d3` passed
[cross-repository run 40197161520](https://github.com/wecreates/Money-factory/actions/runs/40197161520),
job `121180382264`, including pinned contracts, recovery, rights, templates,
KDP/editorial, Node, Python and bridge stages. PR 212 merged as
`05791c97665d3a0c3418d4cd40271c46c05e34e1`; its merge tree matched the tested
tree and both publication flags remained false.

## Deployment and acceptance state

Render automatically attempted the Content Control runtime merge as deploy
`dep-dbf03fek1f9s73fnqlvg`. Deploy-start event
`evt-dbf03fcegpmc73brrocg` bound exact commit
`abf947be68b4a92c13fff8bbb85f1619d6eef854`. Event
`evt-dbf03fegej5s73a5d45g` reported `pipeline_minutes_exhausted`, and event
`evt-dbf03fbsp5es73cdr9p0` recorded the failed deploy. The application build did
not run, so hosted runtime behavior remains unverified. No manual retry,
purchase, plan/cache change, replacement service, secret access or network
widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one held-manifest
provenance boundary only; code and hosted CI are not live source authorization,
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
