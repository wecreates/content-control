# POD run receipt r275 — canonical archive creation clocks

Date: 2026-10-26 (America/Los_Angeles)

## Reconstructed state

Content Control main was
`89ea1eaf365e331fea27260f88311be1ebb6f6cd`; Money Factory main was
`2334d15b996a97ca02bbec8fc03c2702a7e808c1`. The current completion,
implementation and free-deployment records, open pull requests, workflow results
and the authorized existing Render service were inspected before editing. The
open pull requests were unrelated to archive catalog creation clocks, so no
duplicate implementation or verification job was created.

The prior database-administration path still had no credible access change and
was not retried. No network rule, database identity, secret, paid resource or
service setting was changed. No live restoration acceptance was claimed.

## Implemented and merged

[Content Control PR 672](https://github.com/wecreates/content-control/pull/672)
closed an archive-boundary timestamp normalization gap. Encrypted artifact and
full-state archive catalog readers previously passed `created_at` directly to
permissive `Date.parse`. Date-only, offset, alternate-separator, variable
fractional, invalid rollover and `24:00` values could therefore be normalized
into a plausible instant even though both exporters emit exact UTC millisecond
ISO text.

A shared validator now accepts only exact `YYYY-MM-DDTHH:mm:ss.sssZ` text whose
parsed instant round-trips byte-for-byte through `Date#toISOString()`. Both
catalog readers enforce it before verification or restore. Publication and
production permissions are unchanged.

Regression-first verification reproduced the prior acceptance in both archive
readers. After the repair, the focused artifact and state archive suites passed
98/98. The complete local POD Node suite passed 864 tests: 855 passed, nine
expected environment-gated skips and zero failures. Syntax and whitespace checks
were clean. Exact PR head
`3e30c503a489ff95c870ccd3c54cb7f1df8d360f` passed:

- integration run
  [40290057202](https://github.com/wecreates/content-control/actions/runs/40290057202),
  job `121462731089`;
- production-container run
  [40290057164](https://github.com/wecreates/content-control/actions/runs/40290057164),
  job `121462731555`.

The base remained `89ea1eaf365e331fea27260f88311be1ebb6f6cd`, the PR remained
mergeable, and the exact tested head was squash-merged as
`ccc7e39f042e4dc1943f7855adf6b4ade8afb0f0`.

Dependent [Money Factory PR 231](https://github.com/wecreates/Money-factory/pull/231)
pinned cross-repository verification to that exact Content Control merge and
retained explicit `PUBLICATION_ENABLED: 'false'` and
`POD_PUBLICATION_ENABLED: 'false'`. Exact head
`810735b9a68cf5a5d974c73e149ec622d47bee38` passed run
[40291003640](https://github.com/wecreates/Money-factory/actions/runs/40291003640),
job `121465779534`, across the selected review, evidence, recovery, KDP, rights
and adapter contract stages. Its base remained
`2334d15b996a97ca02bbec8fc03c2702a7e808c1`; it merged as
`8c66ce2b8251f9b3cd3e37e3e14052ce12933bf9`.

## Deployment evidence and remaining acceptance

Render automatically attempted executable merge
`ccc7e39f042e4dc1943f7855adf6b4ade8afb0f0` as deploy
`dep-dbfgnh6k1f9s7388o8kg`. Event `evt-dbfgnh8s76nc739rl030` records the start,
`evt-dbfgnh8s76nc739rl04g` records `pipeline_minutes_exhausted`, and
`evt-dbfgnhb4qb4c73adv3pg` records the failed deploy. The failure occurred before
an application build; no manual retry or quota workaround was attempted.

All 24 live acceptance areas remain OPEN. This archive-clock repair is merged
code plus hosted test evidence, not live database retention or restoration,
deployment, real account/source/rights/template/reviewer evidence, authorized
marketplace submission, actual economics/reconciliation, owner-phone
acceptance, live alert delivery/recovery drills, measured capacity, publication,
revenue or launch readiness. Both publication flags remain false; Etsy remains
excluded. No approval, clearance, provider result or continuously running
self-hosted worker is claimed.

The documentation-only receipt merge carried `[skip render]`. Render event
`evt-dbfgrss9v7es73dep480` verifies exact merge
`5f62b5e5d638b56e9ff8616e4868461cd3eea2dc` was ignored rather than deployed.
