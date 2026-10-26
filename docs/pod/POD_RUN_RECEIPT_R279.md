# POD run receipt r279 — canonical artifact descriptor order

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`c8651d73af4b1657490af0d4a6fe87d89837de1b`; Money Factory main was
`5bafd7e087aca998a93115b2000d51db7249fe61`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and authorized existing Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) were inspected before editing. Existing open pull
requests were unrelated to POD artifact recovery descriptor ordering, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource,
service setting or publication permission was changed. No live restoration
acceptance was claimed.

## Implemented and merged

[Content Control PR 684](https://github.com/wecreates/content-control/pull/684)
closed a remaining authenticated artifact-only recovery-format ambiguity.
Artifact verification required canonical fields but still accepted descriptor
lists reordered from the exporter’s strict digest order. An archive-key holder
could therefore alter authenticated catalog form and still obtain `VERIFIED`,
leaving different recovery tools room to interpret the same claimed format
differently.

Catalog admission now requires artifact descriptors in the strict increasing
SHA-256 order emitted by the exporter. A regression reproduced the old behavior
as a missing expected rejection before the repair. Focused artifact recovery
verification passed 54 of 54 tests. The first clean-worktree full-suite attempt
correctly exposed that dependencies had not been installed there: six
PostgreSQL-facing files could not import the locked `pg` package while 837 tests
passed. After reusing the repository’s existing installed locked dependency
tree, the complete local POD Node suite passed 868 tests: 859 passed, nine
expected environment-gated skips and zero failures. Syntax and whitespace checks
were clean. Exact PR head
`6875f0a8b5a428c94dbd22a448efef34b68d55f5`, remote tree
`858d202c190b4da1b7db5a2c5c5e427560470614`, passed:

- integration run
  [40323087023](https://github.com/wecreates/content-control/actions/runs/40323087023),
  job `121572730999`;
- production-container run
  [40323087188](https://github.com/wecreates/content-control/actions/runs/40323087188),
  job `121572731818`.

The base remained `c8651d73af4b1657490af0d4a6fe87d89837de1b`, the PR remained
mergeable, and the exact tested head was squash-merged as
`9d529603b2a8cf0a4a888e005ef44d4368868518`.

Dependent [Money Factory PR 235](https://github.com/wecreates/Money-factory/pull/235)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`bb64965e3cc2b9324f77349d83e7c5392ec71b7c`, remote tree
`da67f599945eda6df726aadb9d3a8fd74ed30576`, passed run
[40324365291](https://github.com/wecreates/Money-factory/actions/runs/40324365291),
job `121577124261`, across all 21 selected review, evidence, recovery, KDP,
rights and adapter-contract stages. Its base remained
`5bafd7e087aca998a93115b2000d51db7249fe61`; it merged as
`1f612027211d2c20e1c4017f56248960e62af9a6`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`9d529603b2a8cf0a4a888e005ef44d4368868518` as deploy
`dep-dbfkk32jnfac73et16hg`. Event `evt-dbfkk3gs76nc739uov80` records the
start, `evt-dbfkk3mbs3rs73crds90` records `pipeline_minutes_exhausted`, and
`evt-dbfkk3o4cbqc73e5vg60` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain **OPEN**. This format repair is merged code
plus hosted test evidence, not a live retained backup or restoration drill,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone acceptance,
live alert delivery/recovery drills, measured capacity, publication, revenue or
launch readiness. Both publication flags remain false; Etsy remains excluded. No
approval, clearance, provider result or continuously running self-hosted worker
is claimed.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbfknvks728c73dm7el0` verifies exact merge
`401685e39568dcf52e9494b90025185ef67f1089` was ignored rather than deployed.
