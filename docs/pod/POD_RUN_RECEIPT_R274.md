# POD run receipt r274 — canonical storage expiry boundary

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`801884a7d5ac02ea40fef414d200dcf9e57adf5b`; Money Factory main was
`ec46730f852eef27f0363cb2f529dbfc9e6c7e99`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and the authorized existing Render service were inspected before editing. The
open pull requests were unrelated to the POD storage-expiry boundary, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource or
service setting was changed. The separately reported local full-database export
was unavailable to this execution environment and no isolated restore target was
available, so no restoration acceptance was claimed.

## Implemented and merged

[Content Control PR 669](https://github.com/wecreates/content-control/pull/669)
closed a retention-boundary normalization gap. Runtime activation, protected
database deployment and preflight previously passed `POD_STORAGE_EXPIRES_AT`
directly to permissive `Date.parse`. Date-only, offset, alternate-separator,
noncanonical fractional and padded values could therefore be normalized into a
different UTC instant. Database deployment and preflight also allowed a numeric
string wall clock through subtraction coercion. Read-only diagnostics presented
normalized invalid expiry text as a plausible healthy timestamp.

A shared parser now accepts only canonical UTC whole-second text or the exact
millisecond form emitted by `Date#toISOString()`. All runtime, deployment,
preflight and diagnostic consumers use it. Invalid configured expiry blocks
activation/deployment/preflight and remains explicitly
`STORAGE_EXPIRY_UNKNOWN` in read-only diagnostics. Exact bounded integer wall
clocks are required wherever those safety decisions are made. Publication and
production permissions are unchanged.

Regression-first verification reproduced the prior acceptance in database
deployment, preflight and manual diagnostics. After the repair, focused expiry,
preflight, deployment and monitoring coverage passed 72/72. The complete local
POD Node suite passed 862 tests: 853 passed, nine expected environment-gated
skips and zero failures. Syntax and whitespace checks were clean. Exact PR head
`219fa0f787e54659d03f4dd0593a4b018f7bb047` passed:

- integration run
  [40285063325](https://github.com/wecreates/content-control/actions/runs/40285063325),
  job `121446651223`;
- production-container run
  [40285063353](https://github.com/wecreates/content-control/actions/runs/40285063353),
  job `121446651297`.

The base remained `801884a7d5ac02ea40fef414d200dcf9e57adf5b`, the PR remained
mergeable, and the exact tested head was squash-merged as
`803b01e5322b25f9f6a623c53bf7ec3e83294a1e`.

Dependent [Money Factory PR 230](https://github.com/wecreates/Money-factory/pull/230)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`2be4b614cdfd3345d1274ccccdc46a451aabc8ee` passed run
[40285782629](https://github.com/wecreates/Money-factory/actions/runs/40285782629),
job `121448975132`, across the selected review, evidence, recovery, KDP, rights
and adapter contract stages. Its base remained
`ec46730f852eef27f0363cb2f529dbfc9e6c7e99`; it merged as
`2334d15b996a97ca02bbec8fc03c2702a7e808c1`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`803b01e5322b25f9f6a623c53bf7ec3e83294a1e` as deploy
`dep-dbfg0js9v7es73ddugd0`. Event `evt-dbfg0jubs3rs73cnsns0` records the start,
`evt-dbfg0jrphbkc73adp8eg` records `pipeline_minutes_exhausted`, and
`evt-dbfg0k4egpmc73c6nd30` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This storage-clock repair is merged
code plus hosted test evidence, not live database retention or restoration,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone
acceptance, live alert delivery/recovery drills, measured capacity, publication,
revenue or launch readiness. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, provider result or continuously running
self-hosted worker is claimed.
