# POD run receipt r221 — signed event creation-time boundary

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`becce3b2e1e5b114f5c1031b6cce9bb5fe8142ff`; Money Factory started from
`a61f14d55619b810419847d8b3b7b992ff52363d`. Current completion,
implementation-status and free-deployment documents, open pull requests,
workflow results and the authorized existing Render service were inspected.
No open pull request overlapped this POD receiver repair. The previously failed
database-administration path had no credible access change and was not retried.
No resource, credential, account, network rule or marketplace state was created
or changed.

## Repair and regression evidence

Money Factory's authenticated Content Control event receiver required a
canonical event `created_at`, but did not bind that event time to the signed
envelope's `issued_at_ms`. A valid signer could therefore issue an envelope and
place its event arbitrarily far in the future. The pre-fix regression reproduced
the case with `created_at` 300,001 milliseconds after envelope issue time and
reached an unexpected database acquisition.

[Money Factory PR 176](https://github.com/wecreates/Money-factory/pull/176)
now rejects that event before database access. Canonical event creation time may
be at most 300,000 milliseconds after signed envelope issue time, preserving a
bounded five-minute clock-skew allowance. Older signed backlog events remain
admissible subject to the existing envelope freshness and replay controls. Tests
cover the inclusive 300,000-millisecond boundary and the 300,001-millisecond
rejection without database access.

The exact final remote head
`8ca839c737c6512dcd5a45a85a81481d9abad702` had tree
`a5c234064f9e89a0a4bc54d54f81b1378aa11e83`; the production receiver blob was
`6c13a00cb05f3c70b78cd3737c01f0ab9c77c01c`, the event-shape regression blob
was `08e4f31f9f81e892f7849ca352e962ec1d5f4a29`, and the clock-contract fixture
blob was `c2de387ce3244dffc674a357930839bd50a6ee2d`.

The focused event-contract suite passed all 31 tests. The full local Node POD
suite passed 110 tests with one expected PostgreSQL-only skip and zero failures
using the pinned Content Control checkout. The full local Money Factory Python
POD suite passed 81 tests. Exact-head hosted run
[40050228922](https://github.com/wecreates/Money-factory/actions/runs/40050228922),
job 120741045248, passed the disposable PostgreSQL round trip, full Money Factory
Node/Python suites and all pinned Content Control review, recovery, template,
rights, KDP/editorial, QA and package-contract gates. PR 176 was squash-merged as
`842d094205a50935422243d7abf97f650fe0fb90` after remote Money Factory main
remained at the reviewed base.

## Render and acceptance state

This was a Money Factory-only runtime contract repair and did not change the
Content Control application. Before this receipt, the authorized Render service
remained an unsuspended free-plan Docker web service on `main`, one instance,
commit-triggered auto-deploy and `/health`. Its newest event was
`evt-dbe0g7flot8c73b97d20`, a `commit_ignored` event at
2026-10-24T01:21:33.265949Z for Content Control correction commit
`becce3b2e1e5b114f5c1031b6cce9bb5fe8142ff`; no application build or rollout
occurred for that commit. The free build pipeline remains exhausted from the
earlier documentation-only r220 deploy attempt. No retry, purchase, replacement
service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes one authenticated
event-ingress time boundary only; merged code and hosted CI are not live
acceptance. Production restricted database/schema/migrations, retained recovery
evidence, deployed hybrid dependencies, mounted Money Factory authority/current
grants and revocation, real accounts/sources/rights/templates/reviewers,
authorized five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
