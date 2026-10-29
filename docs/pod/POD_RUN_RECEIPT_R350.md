# POD run receipt r350 — production claim settlement isolation

Date: 2026-10-29  
Lane: Amazon KDP/POD (Etsy excluded)

## Outcome

Content Control now snapshots the exact fenced identity of each claimed production row before any authority resolver, task resolver, or database callback can retain or mutate caller-visible state. Proxy/accessor-backed or otherwise unsnapshotable claimed rows stop with the fixed `PRODUCTION_SETTLEMENT_UNCERTAIN` signal and are left for durable lease recovery; they do not reach immediate settlement. Each valid callback receives a fresh bounded plain-data copy, so it cannot redirect later settlement.

The snapshot preserves the database contract for `id`, `account_id`, `platform`, `fencing_token`, and `brief`. PostgreSQL `bigint` fences are accepted only as bounded positive canonical decimal strings (or positive safe integers used by synthetic fixtures) and are never coerced.

## Regression and repair evidence

- Pre-fix failing regression: Content Control integration run [40846575808](https://github.com/wecreates/content-control/actions/runs/40846575808), job `123355423729`, run number 807. The new test `unsnapshotable production claims never reach callbacks or settlement` failed because both caller-owned callbacks executed (`actual 2`, expected `0`).
- Functional PR: [wecreates/content-control#832](https://github.com/wecreates/content-control/pull/832).
- Tested PR head: `676d35a6e39df50c808267f488d0d03ea96caa9c`.
- Functional merge: `240dc50f00a82e3a7952d1c36bc5b8bd679c3f0c`.
- Exact-head integration run [40848875614](https://github.com/wecreates/content-control/actions/runs/40848875614), run number 814: success.
  - 973 Node tests passed.
  - 385 Python/OpenCV/rendering tests passed.
  - PostgreSQL-backed production E2E passed.
  - Workflow-control, free-review guards, and syntax checks passed.
- Exact-head container run [40848875797](https://github.com/wecreates/content-control/actions/runs/40848875797), run number 374: success.
  - Non-root runtime/dependencies, Python rendering, Node/PostgreSQL, real print generation/durable review, and disabled-startup checks passed.

## Money Factory authority pin

- Pin PR: [wecreates/Money-factory#305](https://github.com/wecreates/Money-factory/pull/305).
- Tested pin head: `611052f72a93100495bc3e0eee8a95aed8cdbd1c`.
- Cross-repository run [40849669208](https://github.com/wecreates/Money-factory/actions/runs/40849669208), run number 307: success.
- Money Factory merge: `4fe47d07d9100ebf23db1201575ba7f9c3baddfe`.
- The workflow pins Content Control `240dc50f00a82e3a7952d1c36bc5b8bd679c3f0c`.
- `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remain literal `'false'`.

## Render deployment observation

Authorized service: `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`) in workspace `tea-darsafojo6nc739844hg`.

Render detected functional merge `240dc50f00a82e3a7952d1c36bc5b8bd679c3f0c` and started deploy `dep-dbhh298473hc73cic5fg`. The deploy ended `build_failed` before build because free pipeline minutes were exhausted:

- deploy started: `evt-dbhh29h40j4s73fcj500`
- pipeline minutes exhausted: `evt-dbhh29gg45ic73bsskl0`
- deploy ended: `evt-dbhh29h40j4s73fcj54g`

The service remains active, unsuspended, one free-plan instance, branch `main`, Docker runtime, and auto-deploy enabled. This is not evidence that the repaired commit is live.

## Safety and acceptance status

- Publication was not enabled; no marketplace submission occurred.
- No purchases, paid infrastructure, secret disclosure, social-vault access, external messages, or database-administration retry occurred.
- Existing code and hosted test success are not treated as live acceptance.
- All 24 live acceptance areas remain open pending their documented live evidence, including successful deployment of the repaired commit and controlled end-to-end acceptance.
- The scheduled environment executed only the recorded connector and workflow operations; it is not a continuously running self-hosted worker.
