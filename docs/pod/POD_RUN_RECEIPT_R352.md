# POD run receipt r352 — evaluator authorization snapshot

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

The stored production-task resolver now snapshots the caller-supplied layout and
editorial evaluator allowlists when the resolver is created. Resolved tasks reuse
the resulting bounded frozen arrays, so later mutation of the caller-owned arrays
cannot silently authorize additional independent-QA evaluators.

Evaluator-list capture is descriptor-safe: only ordinary dense arrays with own
data elements are accepted, identifiers must satisfy the existing opaque-text
bounds, and Proxy, accessor-backed, sparse or extra-property arrays fail closed
without invoking executable traps.

## Regression and repair evidence

- Pre-fix regression head: `39805cd6c4721f677b1e5b933dd50ba90a107b7c`.
- Failing integration run: [40863977717](https://github.com/wecreates/content-control/actions/runs/40863977717), run number 820, job `123413927673`.
- The new test `task resolver snapshots evaluator authorization before caller mutation`
  failed because `late-layout` remained authorized after the caller mutated its
  source array (actual `['trusted-layout', 'late-layout']`, expected
  `['trusted-layout']`).
- Functional PR: [wecreates/content-control#836](https://github.com/wecreates/content-control/pull/836).
- Tested PR head: `9884fb7322dec2a548c412801e48017d7741e6d3`.
- Functional merge: `802f35914ce4454a8e81c4da0f4c713883776ab8`.
- Exact-head integration run [40864180188](https://github.com/wecreates/content-control/actions/runs/40864180188), run number 822, job `123415254551`: success.
  - 976 Node tests passed, including the caller-mutation and executable-list trap regressions.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E passed.
  - Workflow-control, free-review guards and syntax checks passed.
- Exact-head container run [40864180207](https://github.com/wecreates/content-control/actions/runs/40864180207), run number 380, job `123414698266`: success.
  - Production Docker build, non-root runtime/dependencies, Python rendering,
    Node/PostgreSQL, durable review/E2E and disabled startup passed.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#307](https://github.com/wecreates/Money-factory/pull/307).
- Tested pin head: `8f052ec2a94a0cc7490f6bf1a06fdece212809c5`.
- Cross-repository run [40865400479](https://github.com/wecreates/Money-factory/actions/runs/40865400479), run number 309, job `123418776438`: success.
- Money Factory merge: `0751899182eb280256b2c1a872d82310d1b181cc`.
- The workflow pins Content Control `802f35914ce4454a8e81c4da0f4c713883776ab8`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Render detected functional merge `802f35914ce4454a8e81c4da0f4c713883776ab8`
and started deploy `dep-dbhiqjfavr4c739svkhg`. The deploy ended
`build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhiqjh40j4s73fe1j40`
- pipeline minutes exhausted: `evt-dbhiqjml5iis738gpaf0`
- deploy ended: `evt-dbhiqjh40j4s73fe1jag`

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
