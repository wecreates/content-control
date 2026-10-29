# POD run receipt r354 — production signature-authority snapshot

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

The production worker now captures the rights-evidence and official-template
signature keys before any claim, grant or task callback can run. Rights, cover
template, KDP interior template and retained template-source verification use only
those captured authority values for the entire job.

A caller-owned callback can no longer replace `POD_RIGHTS_KEY` or
`POD_TEMPLATE_KEY` after production begins and thereby redefine which task
evidence or official templates are trusted. The production-enabled flag remains a
live stop control.

## Regression and repair evidence

- Pre-fix regression head: `4b96b76097b014c454f6b45b797f881f71aa37a3`.
- Failing integration run: [40878309462](https://github.com/wecreates/content-control/actions/runs/40878309462), run number 827, job `123462766845`.
- The new test `production snapshots rights and template authority keys before callbacks`
  failed because a grant callback replaced the rights key, evidence signed by the
  replacement key was accepted, template access occurred, and the worker returned
  `PRODUCTION_BLOCKED` instead of `SOURCE_RIGHTS_INVALID`.
- Functional PR: [wecreates/content-control#840](https://github.com/wecreates/content-control/pull/840).
- Tested PR head: `576794f1b6135ba9bf02974f7aa8cec1e410a8aa`.
- Functional merge: `86cb216dc89b1cf47cef7017cd1bc104f1755fe3`.
- Exact-head integration run [40878498147](https://github.com/wecreates/content-control/actions/runs/40878498147), run number 828, job `123463415616`: success.
  - 978 Node tests passed, including the authority-mutation regression.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E passed.
  - Workflow-control, free-review guards and syntax checks passed.
- Exact-head container run [40878498164](https://github.com/wecreates/content-control/actions/runs/40878498164), run number 384, job `123463564411`: success.
  - Production Docker build, non-root runtime/dependencies, Python rendering,
    Node/PostgreSQL, durable review/E2E and disabled startup passed.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#309](https://github.com/wecreates/Money-factory/pull/309).
- Tested pin head: `a78a524c6a6fc54b1f2a07c6c746e01f31305d31`.
- Cross-repository run [40879615065](https://github.com/wecreates/Money-factory/actions/runs/40879615065), run number 311, job `123467306425`: success.
- Money Factory merge: `fd467f39fa79ae319746905b49edef9cc1480caf`.
- The workflow pins Content Control `86cb216dc89b1cf47cef7017cd1bc104f1755fe3`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker`
(`srv-darsdb8u01pc73dn4i2g`) in workspace
`tea-darsafojo6nc739844hg`.

Render detected functional merge `86cb216dc89b1cf47cef7017cd1bc104f1755fe3`
and started deploy `dep-dbhkbmp5efls738ut8g0`. The deploy ended
`build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhkbn1iimcc73egj230`
- pipeline minutes exhausted: `evt-dbhkbn0g45ic73bvpnb0`
- deploy ended: `evt-dbhkbn1rl4tc739ji1lg`

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
