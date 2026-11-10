# November 9, 2026 — require commit evidence for POD diagnostics

Reviewed the 24-area checklist, implementation status, free-deployment runbook,
open PRs, recent CI and the authorized Render service. Initial Content Control
main was `cb3fd8b36094a976963b6bcb9597bff1573c42d6`, a deployment-health update;
Render remained live on `5303a4719d69f19d9ff852048645759513936e27`, deployment
`dep-dbp5236417fc7398oba0`. Money Factory `13a46dd4f0fe6d5f6d2d341860a1df97d288d194`
already contained the tested authority dispatcher. No duplicate POD PR was open.

The metrics and recorded-activity diagnostics accepted an aborted read-only
transaction when PostgreSQL resolved COMMIT with a ROLLBACK command tag. Both
new regressions failed on the old code. These paths now reuse the managed
database bridge's commit-evidence check: only an own data property containing
the exact COMMIT tag permits a report. An unverified result discards the
connection without sending more SQL or returning metrics. Timeouts and awaited
client release remain unchanged. The existing disposable PostgreSQL monitoring
case now aborts each read-only transaction and checks the real ROLLBACK tag.

Local focused checks: 57 Node tests passed, one expected disposable PostgreSQL
skip. Exact hosted gates, merge and Render readback are recorded in the PR.
The dependent Money Factory gate verifies the pinned consumer using its
existing metrics and activity steps.

No production database access, paid resource, marketplace action or network
change. No materially changed database administration path was identified.
Both publication switches stay false. The diagnostic reports remain historical
observations, not measured capacity, proof of storage recovery or acceptance.
All 24 live acceptance areas remain open; free hosting is not an always-on claim.
