# POD run receipt r351 — production database capability binding

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

The production worker now captures its claim, eligibility, failure, review-hold,
completion, transaction, activity, pool-connect, storage-expiry and QA database
capabilities before the caller-owned claim wait. Artifact persistence and every
later production guard or settlement call run through a frozen receiver containing
the original dependencies.

A claim callback can no longer replace `failProduction`, `assertProducible`,
`holdProduction`, `completeProduction`, `tx`, `active`, or `pool.connect`
and redirect or bypass fenced durable state. Descriptor-safe lookup rejects Proxy
or accessor-backed capability paths without invoking their executable traps.
Disabled production, invalid-budget precedence and empty-claim behavior are
preserved.

## Regression and repair evidence

- Pre-fix regression head: `cb117fa8590dc276603f12dc88fe27498a08afea`.
- Failing integration run: [40853377552](https://github.com/wecreates/content-control/actions/runs/40853377552), run number 816, job `123378152068`.
- The new test `production database settlement is bound before the claim callback`
  failed because the original durable settlement ran zero times after the claim
  callback replaced it (actual `0`, expected `1`).
- Functional PR: [wecreates/content-control#834](https://github.com/wecreates/content-control/pull/834).
- Tested PR head: `b8a73f0d708995026e16fd724910de573acac5d2`.
- Functional merge: `f2ba460ed90a4388d8822189e7d9848e29814559`.
- Exact-head integration run [40854129505](https://github.com/wecreates/content-control/actions/runs/40854129505), run number 818: success.
  - 974 Node tests passed.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E passed.
  - Workflow-control, free-review guards and syntax checks passed.
- Exact-head container run [40854129521](https://github.com/wecreates/content-control/actions/runs/40854129521), run number 377: success.
  - Production Docker build, non-root runtime/dependencies, Python rendering,
    Node/PostgreSQL, real print generation/durable review and disabled startup passed.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#306](https://github.com/wecreates/Money-factory/pull/306).
- Tested pin head: `70af34a7665e9855a2defd01e195aa8949e023fa`.
- Cross-repository run [40855178325](https://github.com/wecreates/Money-factory/actions/runs/40855178325), run number 308: success.
- Money Factory merge: `b8fb5352d2253831320560cc5b9e768eb2671c0e`.
- The workflow pins Content Control `f2ba460ed90a4388d8822189e7d9848e29814559`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Render detected functional merge `f2ba460ed90a4388d8822189e7d9848e29814559`
and started deploy `dep-dbhhm3gu01pc73aahfpg`. The deploy ended
`build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhhm3ul5iis738fr9dg`
- pipeline minutes exhausted: `evt-dbhhm3og45ic73btc2gg`
- deploy ended: `evt-dbhhm4323eus73e8ugf0`

The existing service remains the authorized active, unsuspended, one-instance
free-plan Docker service on branch `main` with auto-deploy enabled. This is not
evidence that the repaired commit is live.

## Safety and acceptance status

- Publication was not enabled; no marketplace submission occurred.
- No purchases, paid infrastructure, secret disclosure, social-vault access,
  external messages, network widening or database-administration retry occurred.
- Existing code and hosted test success are not treated as live acceptance.
- All 24 live acceptance areas remain open pending their documented live evidence,
  including successful deployment of the repaired commit and controlled end-to-end
  acceptance.
- The scheduled environment executed only the recorded connector and workflow
  operations; it is not a continuously running self-hosted worker.
