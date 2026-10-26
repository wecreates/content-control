# POD run receipt r276 — canonical recovery snapshot identity

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`a69cdec8efe107f0d5bf6553ec891d9a0ad8e871`; Money Factory main was
`8c66ce2b8251f9b3cd3e37e3e14052ce12933bf9`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and the authorized existing Render service were inspected before editing. The
open pull requests were unrelated to POD recovery snapshot identity, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource or
service setting was changed. No live restoration acceptance was claimed.

## Implemented and merged

[Content Control PR 675](https://github.com/wecreates/content-control/pull/675)
closed an authenticated recovery-identity gap. A full-state archive catalog
previously accepted any 36-character lowercase hex/hyphen string as its
`snapshot_id`, even though the exporter always emits a canonical lowercase
UUIDv4. A holder of the archive key could rebind every record's authenticated
data to a non-UUID identifier and obtain a successful offline verification or
restore receipt with an ambiguous snapshot identity.

Catalog admission now requires the exact UUIDv4 shape emitted by
`crypto.randomUUID()`, including fixed hyphen positions, version 4 and the RFC
variant. That validation occurs before record admission or database access.
Publication and production permissions are unchanged.

Regression-first verification reproduced the prior acceptance after the catalog
and record authenticated-data bindings were changed together. After the repair,
the focused state archive suites passed 47 tests with one expected
PostgreSQL-environment skip and zero failures. The complete local POD Node suite
passed 865 tests: 856 passed, nine expected environment-gated skips and zero
failures. Syntax and whitespace checks were clean. Exact PR head
`96c1ce8481e7df04cb25e843898263807408a0a6` passed:

- integration run
  [40296707243](https://github.com/wecreates/content-control/actions/runs/40296707243),
  job `121484414795`;
- production-container run
  [40296707191](https://github.com/wecreates/content-control/actions/runs/40296707191),
  job `121484414550`.

The base remained `a69cdec8efe107f0d5bf6553ec891d9a0ad8e871`, the PR remained
mergeable, and the exact tested head was squash-merged as
`2a4f2802aa29717b503ef43321ed88382b46513f`.

Dependent [Money Factory PR 232](https://github.com/wecreates/Money-factory/pull/232)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`f322b6c1dd59d33d313438f3d4ce2a2de7cb103b` passed run
[40297647065](https://github.com/wecreates/Money-factory/actions/runs/40297647065),
job `121487505634`, across the selected review, evidence, recovery, KDP, rights
and adapter contract stages. Its base remained
`8c66ce2b8251f9b3cd3e37e3e14052ce12933bf9`; it merged as
`508e701010080c7841f7bf1628290e968fc5552d`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`2a4f2802aa29717b503ef43321ed88382b46513f` as deploy
`dep-dbfhi0ajnfac73ep4u8g`. Event `evt-dbfhi0bphbkc73aer1fg` records the start,
`evt-dbfhi0ebs3rs73cou8v0` records `pipeline_minutes_exhausted`, and
`evt-dbfhi0j4qb4c73aehdo0` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This recovery-identity repair is
merged code plus hosted test evidence, not a live backup or restoration drill,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone
acceptance, live alert delivery/recovery drills, measured capacity, publication,
revenue or launch readiness. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, provider result or continuously running
self-hosted worker is claimed.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbfhlcuk1f9s7389nuh0` verifies exact merge
`b697156f8140a00fa2ea7b8e0d64162eff52eca5` was ignored rather than deployed.
