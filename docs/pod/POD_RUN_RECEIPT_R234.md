# POD run receipt r234 — canonical signed JSON numbers

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`6d54d0c07903f1bc3be858ad9487bd3503e7a3f5`; Money Factory started from
`6712b593a664c9cee0dab507b5e587d20a66da46`. The four Content Control commits
after the r233 receipt updated free media/QA, candidate rollback, live-deployment
health and watchdog evidence. Their files did not overlap this POD receiver
repair and were preserved. Current POD completion, implementation-status and
free-deployment documents, open pull requests, workflow results and the
authorized existing Render service were inspected. No open POD pull request
overlapped this work. The previously failed database-administration path had no
credible access change and was not retried. No resource, credential, account,
network rule or marketplace state was created or changed.

## Repair and regression evidence

Money Factory's strict parser rejected duplicate keys, numeric overflow and
unsafe integers, but still admitted other numeric tokens whose authenticated
wire spelling and value would change during native JSON serialization. Examples
included negative zero, nonzero values that underflow to zero, redundant decimal
or exponent spellings, and excess fractional precision. The event inbox hashes
and stores the parsed event, so those values could lose identity before durable
deduplication. The focused pre-fix run passed six tests and failed two: `-0`
produced `Missing expected exception`, while lossy signed fractions reached
ordinary event-scope validation instead of failing at JSON admission.

[Money Factory PR 189](https://github.com/wecreates/Money-factory/pull/189)
now requires every finite safe numeric token to equal native `JSON.stringify`
serialization of its parsed number. Noncanonical tokens fail with
`REQUEST_JSON_NONCANONICAL_NUMBER` after signature authentication but before
scope checks, database acquisition, hashing or storage. Internal POD senders
already use native `JSON.stringify`, so their finite numeric encodings remain
compatible. The exact remote PR head was
`9a26db6a3975cc911de39e4f856a42f036b66e06`. Remote blobs were
`6b08919b6b66e3776b9e45a62672b7b399d69ec7` for the parser,
`21eecc4d4bab330ced9cc64fb9c94c56fbbd6713` for its regression, and
`5d9e1a57391011c55a3cd6e7a0276b8567f60476` for the POD README; they matched
the tested local contents.

The focused strict-parser suite passed 8/8. The paired Money Factory Node suite
against current Content Control reached 115 tests: 114 passed, one expected
PostgreSQL-environment skip and zero failures. All 81 Python tests passed.
Exact-head hosted run
[40105663755](https://github.com/wecreates/Money-factory/actions/runs/40105663755),
job 120906707655, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
189 was squash-merged as `e501df42884f17362b93c948d845fb361eed3283` after
confirming the main base remained unchanged.

## Deployment and acceptance state

This receiver-only Money Factory change did not alter Content Control runtime
bytes and did not trigger a Render deployment. The authorized Render service
remained unsuspended on its existing free Docker plan with commit-triggered
auto-deploy enabled. Its latest observed Content Control attempt was concurrent
commit `6d54d0c07903f1bc3be858ad9487bd3503e7a3f5`, deploy
`dep-dbeccr0473hc738v6cfg`. Deploy-start event
`evt-dbeccrcegpmc73bevaeg` bound that exact commit at
2026-10-24T14:53:33.226083Z; event `evt-dbeccrbphbkc739m6d50` reported exhausted
free pipeline minutes, and deploy-end event `evt-dbeccr9r5j6c73fnr3mg` recorded
failure before build. No manual retry, purchase, plan/cache change, replacement
service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one signed-number
identity ambiguity only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
