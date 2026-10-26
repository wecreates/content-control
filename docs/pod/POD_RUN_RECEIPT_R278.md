# POD run receipt r278 — canonical artifact-only catalog shape

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`828359b94fc799d523476393c5082bebd666b50f`; Money Factory main was
`848b1fa0451c9b6a1aa0d9f2c8bb989b44d08a84`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and authorized existing Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) were inspected before editing. Existing open pull
requests were unrelated to POD artifact recovery catalog canonicality, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource,
service setting or publication permission was changed. No live restoration
acceptance was claimed.

## Implemented and merged

[Content Control PR 681](https://github.com/wecreates/content-control/pull/681)
closed the remaining authenticated artifact-only recovery-format ambiguity.
Artifact verification previously accepted extra or reordered fields at the
catalog and artifact-descriptor levels even though canonical exports never emit
those shapes. An archive-key holder could therefore alter authenticated catalog
form and still obtain `VERIFIED`, leaving room for different recovery tools to
interpret the same claimed format differently.

Catalog admission now requires the exact ordered fields emitted by the exporter
at both levels. A regression reproduced the old behavior as a missing expected
rejection before the repair and covers added and reordered fields. Focused
artifact recovery verification passed 53 of 53 tests. The complete local POD
Node suite passed 867 tests: 858 passed, nine expected environment-gated skips
and zero failures. Syntax and whitespace checks were clean. Exact PR head
`c2a4a24dd40fe9ff7fa10462ebdbe2e9727e59ee`, remote tree
`5abc22e60c9dff9e84571f3840ecac8049e7dd64`, passed:

- integration run
  [40312045954](https://github.com/wecreates/content-control/actions/runs/40312045954),
  job `121535354726`;
- production-container run
  [40312045928](https://github.com/wecreates/content-control/actions/runs/40312045928),
  job `121535354881`.

The base remained `828359b94fc799d523476393c5082bebd666b50f`, the PR remained
mergeable, and the exact tested head was squash-merged as
`af5879ef3bb89327fed73e241f48c80801e74b62`.

Dependent [Money Factory PR 234](https://github.com/wecreates/Money-factory/pull/234)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`cef9574be8365b8bb090576611376cb51f872437`, remote tree
`aada0b1c16d0fe3e3ee6de836efd34bc86f86e8e`, passed run
[40313162141](https://github.com/wecreates/Money-factory/actions/runs/40313162141),
job `121539085997`, across all 21 selected review, evidence, recovery, KDP,
rights and adapter-contract stages. Its base remained
`848b1fa0451c9b6a1aa0d9f2c8bb989b44d08a84`; it merged as
`5bafd7e087aca998a93115b2000d51db7249fe61`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`af5879ef3bb89327fed73e241f48c80801e74b62` as deploy
`dep-dbfja195efls73c2c5s0`. Event `evt-dbfja1j8vfls739asvo0` records the
start, `evt-dbfja1jsp5es73cr4mk0` records `pipeline_minutes_exhausted`, and
`evt-dbfja1jphbkc73ag76cg` records the failed deploy. The failure occurred before
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
`evt-dbfjefdg1s2s73ae1bkg` verifies exact merge
`49e70b3e26ce06e98bc1ace52ec87e278972f623` was ignored rather than deployed.
