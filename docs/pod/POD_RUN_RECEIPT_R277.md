# POD run receipt r277 — canonical full-state catalog shape

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`2b3923602507280812cb531bd6d57c9f31c16dad`; Money Factory main was
`508e701010080c7841f7bf1628290e968fc5552d`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and authorized existing Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) were inspected before editing. Existing open pull
requests were unrelated to POD recovery catalog canonicality, so no duplicate
implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource,
service setting or publication permission was changed. No live restoration
acceptance was claimed.

## Implemented and merged

[Content Control PR 678](https://github.com/wecreates/content-control/pull/678)
closed an authenticated recovery-format ambiguity. Full-state verification
previously accepted extra or reordered fields at the catalog, record-descriptor
and column-descriptor levels even though canonical exports never emit those
shapes. An archive-key holder could therefore alter authenticated catalog form
and still obtain `VERIFIED`, leaving room for different recovery tools to
interpret the same claimed format differently.

Catalog admission now requires the exact ordered fields emitted by the exporter
at all three levels. A regression reproduced the old behavior as a missing
expected rejection before the repair and covers both added and reordered fields.
Focused recovery verification passed 49 tests: 48 passed, one expected
PostgreSQL-environment skip and zero failures. The complete local POD Node suite
passed 866 tests: 857 passed, nine expected environment-gated skips and zero
failures. Syntax and whitespace checks were clean. Exact PR head
`3102a1c6a5c1ed2df127d494d410e570cf3b00cc`, remote tree
`91a870cf8f680d276442d7cce6b81ee6687f3deb`, passed:

- integration run
  [40304089161](https://github.com/wecreates/content-control/actions/runs/40304089161),
  job `121508777606`;
- production-container run
  [40304089454](https://github.com/wecreates/content-control/actions/runs/40304089454),
  job `121508778654`.

The base remained `2b3923602507280812cb531bd6d57c9f31c16dad`, the PR remained
mergeable, and the exact tested head was squash-merged as
`2487fee912df8c195a9e896daaa957fb6c0799dd`.

Dependent [Money Factory PR 233](https://github.com/wecreates/Money-factory/pull/233)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`f5438c542b992ceecd53bcbb73d78648bf53e3de`, remote tree
`f0e2370ea7f175c00f3c4b7cff5dd111eafb3def`, passed run
[40305562079](https://github.com/wecreates/Money-factory/actions/runs/40305562079),
job `121513677568`, across the selected review, evidence, recovery, KDP, rights
and adapter-contract stages. Its base remained
`508e701010080c7841f7bf1628290e968fc5552d`; it merged as
`848b1fa0451c9b6a1aa0d9f2c8bb989b44d08a84`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`2487fee912df8c195a9e896daaa957fb6c0799dd` as deploy
`dep-dbfieh6q1p3s73f8tru0`. Event `evt-dbfieh34qb4c73af7p4g` records the start,
`evt-dbfieh04cbqc73e44a7g` records `pipeline_minutes_exhausted`, and
`evt-dbfieh84cbqc73e44abg` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain **OPEN**. This format repair is merged code
plus hosted test evidence, not a live retained backup or restoration drill,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone acceptance,
live alert delivery/recovery drills, measured capacity, publication, revenue or
launch readiness. Both publication flags remain false; Etsy remains excluded. No
approval, clearance, provider result or continuously running self-hosted worker
is claimed.
