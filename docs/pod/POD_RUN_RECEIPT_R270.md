# POD run receipt r270 — shared transaction storage guard

Date: 2026-10-25 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`52e498193eb58a67e0bc2f2124b3b3b322c27917`; Money Factory main was
`f3be281b0ba86d55abb34b49989758e8e197f961`. Current completion,
implementation and free-deployment records, open pull requests, workflow results
and the authorized existing Render service were inspected before editing. Open
drafts were unrelated to this POD transaction work; no duplicate job or PR was
created.

The failed database-administration path still had no credible access change and
was not retried. No allowlist, database identity, secret, paid resource or
service setting was changed.

## Implemented and merged

[Content Control PR 657](https://github.com/wecreates/content-control/pull/657)
hardened the shared `PodDB.tx` boundary. Storage retention is now rechecked after
connection acquisition, `BEGIN`, both local timeout statements and every query
made by a transaction callback. A cutoff crossed in an earlier wait cannot reach
a later concept, queue, review, settlement, recovery, evidence or archive SQL
statement. Open transactions still roll back; expiry before `BEGIN` releases the
connection without issuing SQL.

All four new regressions failed on reconstructed main and passed after repair. A
focused transactional, authorization, evidence, review, KDP and publishing set
passed 53/53. The complete local POD Node suite passed 853 tests: 844 passed,
nine expected environment-gated skips and zero failures. Exact PR head
`ddde66b8ba255239ddfaa0be4c3bbe0560ab545d` passed:

- integration run
  [40260426359](https://github.com/wecreates/content-control/actions/runs/40260426359),
  job `121371422110`;
- production-container run
  [40260426399](https://github.com/wecreates/content-control/actions/runs/40260426399),
  job `121371421980`.

The base remained `52e498193eb58a67e0bc2f2124b3b3b322c27917`; the exact
tested head was cleanly squash-merged as
`691a3003d54ee265d1ad802902ce0944055722c3`.

Dependent [Money Factory PR 226](https://github.com/wecreates/Money-factory/pull/226)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`a4cfedc9844b09f4343e11cc21acc331fbee4c54` passed run
[40261036483](https://github.com/wecreates/Money-factory/actions/runs/40261036483),
job `121373275594`, across review, evidence, recovery, KDP, rights and adapter
contract stages. Its base remained
`f3be281b0ba86d55abb34b49989758e8e197f961`; it merged as
`28abe8141e4ff94b3c28e239703958cdfc6abc6b`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`691a3003d54ee265d1ad802902ce0944055722c3` as deploy
`dep-dbfbvbp5efls73br8iu0`. Event `evt-dbfbvbsegpmc73c4db8g` records the start,
`evt-dbfbvbubs3rs73cli6ag` records `pipeline_minutes_exhausted`, and
`evt-dbfbvc38vfls7396624g` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This shared transaction repair is
merged code plus hosted test evidence, not live database retention, deployment,
real account/source/rights/template/reviewer evidence, authorized marketplace
submission, actual economics/reconciliation, owner-phone acceptance, measured
capacity, publication, revenue or launch readiness. Both publication flags
remain false; Etsy remains excluded. No approval, clearance, provider result or
continuously running self-hosted worker is claimed.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbfc2tijnfac73ek57e0` verifies exact merge
`fd74d69ab6f5307d59bde14851521e785eda77f1` was ignored rather than deployed.
