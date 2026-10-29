# POD run receipt r353 — grant authority configuration snapshot

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

The current-grant resolver now captures the validated authority bearer credential
and upstream signing key when the resolver is constructed. Each later authority
request uses only those captured values.

Mutation of a caller-owned environment object can no longer replace the outbound
bearer credential or redefine which Money Factory grant signatures are trusted
after configuration validation.

## Regression and repair evidence

- Pre-fix regression head: `964f35f93616cd2aef40a04e565a35c2bde5d752`.
- Failing integration run: [40866631583](https://github.com/wecreates/content-control/actions/runs/40866631583), run number 824, job `123422923473`.
- The new test `grant resolver snapshots authority credentials before caller mutation`
  failed with `Missing expected rejection`: after construction, replacing the
  caller-owned upstream key caused a grant signed by the replacement key to be
  accepted.
- Functional PR: [wecreates/content-control#838](https://github.com/wecreates/content-control/pull/838).
- Tested PR head: `b20b4054e6c31021d3722e46a066fc0e9385f9db`.
- Functional merge: `a75c28eac5ba2b69045da7b267d119136095bf1c`.
- Exact-head integration run [40866882390](https://github.com/wecreates/content-control/actions/runs/40866882390), run number 825, job `123423771335`: success.
  - 977 Node tests passed, including the authority-configuration mutation regression.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E passed.
  - Workflow-control, free-review guards and syntax checks passed.
- Exact-head container run [40866882403](https://github.com/wecreates/content-control/actions/runs/40866882403), run number 382, job `123423893723`: success.
  - Production Docker build, non-root runtime/dependencies, Python rendering,
    Node/PostgreSQL, durable review/E2E and disabled startup passed.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#308](https://github.com/wecreates/Money-factory/pull/308).
- Tested pin head: `eb6f39e09442cab08164cf9c7cd3b0b6d303ede1`.
- Cross-repository run [40867738195](https://github.com/wecreates/Money-factory/actions/runs/40867738195), run number 310, job `123426670339`: success.
- Money Factory merge: `6a57d3d2257895f4c7e0bccbc9edaa5cfd188ff1`.
- The workflow pins Content Control `a75c28eac5ba2b69045da7b267d119136095bf1c`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Render detected functional merge `a75c28eac5ba2b69045da7b267d119136095bf1c`
and started deploy `dep-dbhj3615efls738t0i90`. The deploy ended
`build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhj36140j4s73fe9ei0`
- pipeline minutes exhausted: `evt-dbhj361iimcc73efbpo0`
- deploy ended: `evt-dbhj3699q7ns73d0n82g`

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
