# POD run receipt r355 — production child-stage environment snapshot

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

The production worker now captures a bounded, data-only environment before any
claim, grant, task or review callback can run. Every Python stage uses that frozen
snapshot, so a callback cannot replace the interpreter, signing keys or stage
configuration after production begins. The caller-owned
`POD_PRODUCTION_ENABLED` value remains a live stop control before and after
asynchronous work.

## Regression and repair evidence

- Pre-fix regression head: `751d5d71d636c8ef7cac50e3638e5649b7c01614`.
- Failing integration run: [40886401852](https://github.com/wecreates/content-control/actions/runs/40886401852), run number 830, job `123491169390`.
- The new test `production snapshots child-stage environment before authority callbacks`
  was the sole Node failure: a grant callback replaced `POD_PYTHON`, the
  replacement executable ran, and the assertion observed `true` instead of
  `false` (978 passed, 1 failed).
- Functional PR: [wecreates/content-control#842](https://github.com/wecreates/content-control/pull/842).
- Tested PR head: `8f102cc80ed1e7d4af53fc9ba5524569da142e49`.
- Functional merge: `0999551d19a52f08138fc171940391ed89cebe97`.
- Exact-head integration run [40886636618](https://github.com/wecreates/content-control/actions/runs/40886636618), run number 831, job `123492006352`: success.
  - 979 Node tests passed, including the interpreter-replacement regression.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E, workflow-control and free-review guards passed.
- Exact-head container run [40886636623](https://github.com/wecreates/content-control/actions/runs/40886636623), run number 386, job `123492336302`: success.
  - The production Docker build, 979 Node tests, 385 Python/rendering tests,
    PostgreSQL/E2E and disabled startup smoke passed.
  - Startup reported publication false, production disabled and outbox disabled.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#310](https://github.com/wecreates/Money-factory/pull/310).
- Tested pin head: `d51bdbbe90775b534ac1c8f4770a7924ffe53ca1`.
- Cross-repository run [40887776742](https://github.com/wecreates/Money-factory/actions/runs/40887776742), run number 312, job `123496009875`: success.
- Money Factory merge: `d00005c7198f1a90560dfd5deb684fd553ba57c0`.
- The workflow pins Content Control `0999551d19a52f08138fc171940391ed89cebe97`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Render detected functional merge `0999551d19a52f08138fc171940391ed89cebe97`
and started deploy `dep-dbhl4da9lscs739sie1g`. The deploy ended
`build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhl4dj23eus73ec4nng`
- pipeline minutes exhausted: `evt-dbhl4dr23eus73ec4npg`
- deploy ended: `evt-dbhl4e6l5iis738j2bgg`

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
