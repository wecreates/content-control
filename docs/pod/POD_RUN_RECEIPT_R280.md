# POD run receipt r280 — exact artifact archive membership

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`275c762d5163a3e2166879033e3e7e6fbaeb9205`; Money Factory main was
`1f612027211d2c20e1c4017f56248960e62af9a6`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and authorized existing Render service `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) were inspected before editing. Existing open pull
requests were unrelated to POD artifact archive directory membership, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource,
service setting or publication permission was changed. No live restoration
acceptance was claimed.

## Implemented and merged

[Content Control PR 687](https://github.com/wecreates/content-control/pull/687)
closed an artifact recovery ambiguity: verification and restore authenticated
every catalog-named object but silently ignored other entries in the same
archive directory. An archive therefore did not have to be the exact canonical
file set emitted by the exporter.

The verifier now requires the held archive directory to contain exactly
`catalog.pod` and every digest-named object in its authenticated catalog. It
checks after referenced-object authentication. Restore checks before database
access, again inside its transaction before commit, and again before issuing its
receipt. An unreferenced entry therefore blocks before database access and an
entry added during restore prevents a successful commit or receipt.

Regression-first verification reproduced the old behavior: 54 existing artifact
recovery cases passed while the new unreferenced-entry assertion failed because
verification returned success. After repair, the focused artifact suite passed
55 of 55 tests. The complete local POD Node suite passed 869 tests: 860 passed,
nine expected environment-gated skips and zero failures. Syntax and whitespace
checks were clean. Exact PR head
`f0745c03c343275c22394eb4d6c0560812a15dda`, remote tree
`0acb20a0009263cea19a65117cc5b80735456a20`, passed:

- integration run
  [40329654329](https://github.com/wecreates/content-control/actions/runs/40329654329),
  job `121595383190`;
- production-container run
  [40329654411](https://github.com/wecreates/content-control/actions/runs/40329654411),
  job `121595383923`.

The base remained `275c762d5163a3e2166879033e3e7e6fbaeb9205`, the PR remained
mergeable, and the exact tested head was squash-merged as
`f95c2c970bc460abc9d7e42dabb2941aae77246a` with the same exact tree.

Dependent [Money Factory PR 236](https://github.com/wecreates/Money-factory/pull/236)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Money Factory main advanced concurrently by
one monitoring-receipt commit, `02c051f7fc13f1ec1296cf8f0790336bf5d0c7d1`;
that commit touched only `FREE_MONITOR_EVENTS.json` and
`FREE_MONITOR_STATE.json`, did not overlap the pin, and was preserved as the PR
base. Exact tested head `84c6febd1640847fa726e07fe2a599a83648081f`
passed run
[40330749592](https://github.com/wecreates/Money-factory/actions/runs/40330749592),
job `121599211090`, across all 21 selected review, evidence, recovery, KDP,
rights and adapter-contract stages. It merged as
`2022f19339cc6d1a1908a31c7b70d93cb6e047c8`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`f95c2c970bc460abc9d7e42dabb2941aae77246a` as deploy
`dep-dbfla7dg1s2s73agk3eg`. Event `evt-dbfla7gs76nc739vdqog` records the start,
`evt-dbfla7gs76nc739vdqo0` records `pipeline_minutes_exhausted`, and event
`evt-dbfla7j8vfls739clkug` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain **OPEN**. This format repair is merged code
plus hosted test evidence, not a live retained backup or restoration drill,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone acceptance,
live alert delivery/recovery drills, measured capacity, publication, revenue or
launch readiness. Both publication flags remain false; Etsy remains excluded. No
approval, clearance, provider result or continuously running self-hosted worker
is claimed.
