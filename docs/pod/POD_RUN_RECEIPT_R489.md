# POD run receipt R489

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across `wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded. The run repaired one unblocked database cancellation/resource-safety defect, merged the exact passing implementation and consumer pin, and verified the free Render deployment. This is implementation and verification evidence, not live acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory throughout. The run did not enable publication, spend money, contact a third party, access a social vault, widen network access, or claim marketplace approval, revenue, credentials, or clearance.

## Reconciled starting heads and concurrent work

- Content Control: `93ca4d5c4d689bf9ec646f32541d6e668cead319`
- Money Factory: `a73b3b3de93bd5009e8746e8950b3738bd9f50eb`
- Concurrent Content Control evidence commits `db889ac996d6a39fa090fdf8cb0e4092926b2bc3`, `46b232e33eee0591b05305b1f67fc2cc1d6ba318`, and `93ca4d5c4d689bf9ec646f32541d6e668cead319` were read and preserved. They changed state/evidence/media, not the POD source repaired here.
- Existing open PRs were inspected before creating work; none duplicated R489.

## Defect and repair

`integrations/pod/database-wait.mjs` invoked the database operation before registering its abort listener. If listener registration threw, database work had already started without cancellation control. A throwing listener-removal hook could also strand an otherwise settled database wait.

The pre-repair regression reproduced the first issue: expected zero database calls, observed one (`1 !== 0`). The repair:

- registers the abort listener before starting database work;
- rejects without starting work if registration fails;
- prevents work after synchronous cancellation during registration;
- makes listener removal best-effort so cleanup failure cannot strand settlement;
- preserves late-result handling and the established rollback/sanitize/reuse path when an already-settled operation wins before the caller's cancellation checkpoint.

Three regression tests cover failed registration, synchronous cancellation, and throwing cleanup.

## Content Control verification and merge

Local evidence:

- focused database/archive/recovery/read suite: 161 passed, 0 failed;
- complete sequential Node workflow suite: 1,164 tests; 1,155 passed, 9 expected skips, 0 failed;
- complete Python POD workflow suite: 385 passed, 0 failed;
- separate production E2E boundary: 1 expected skip because live credentials/publication are intentionally unavailable;
- `git diff --check`: passed.

A first default-concurrency Node run recorded 3 failures: two timing-sensitive Python descendant-cleanup cases and one guarded-read cancellation expectation while the repair was still being refined. The two timing cases passed in isolation; the guarded-read case passed after preserving the existing rollback/reuse semantics. The final complete sequential suite above passed with zero failures. The earlier failures are retained here rather than represented as a clean first attempt.

PR [#1090](https://github.com/wecreates/content-control/pull/1090) used immutable head `bffec180560cafe9c4b02dc90f051f934842117f` and passed:

- POD container runtime gates: run `42159986293`, job `127703102813`;
- POD integration gates: run `42159986295`, job `127703103031`.

It merged as `3dc03c2f5c0112f8aea710d5190788c94d18e08c`.

## Free Render deployment

Authorized workspace/service:

- workspace `tea-darsafojo6nc739844hg`;
- service `srv-darsdb8u01pc73dn4i2g` (`content-control-render-worker`);
- free Docker web service, `main`, commit-triggered auto-deploy, not suspended.

Exact functional merge `3dc03c2f5c0112f8aea710d5190788c94d18e08c` deployed as `dep-dbml5avavr4c738skq50`. Build event `evt-dbml5id494ic73a741d0` and deploy-ended event `evt-dbml5qds25qs739p1n50` both succeeded. Fresh public probes showed:

- `/health`: alive; `production_approved=false`; `publication=false`;
- `/livez`: alive; `production_approved=false`; `publication=false`;
- `/readyz`: `ok=false` as required for a held launch, `qaStatus=GREEN`, `hashBound=true`, and exact expected/actual SHA-256 `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`; `captionReady=false`; `renderStatus=v2-validation-complete`.

The live health response is deployment evidence only. It does not establish marketplace acceptance or any of the 24 live acceptance areas.

## Money Factory authority pin

The Money Factory workflow now pins Content Control functional merge `3dc03c2f5c0112f8aea710d5190788c94d18e08c`.

Local bridge evidence:

- Node: 279 tests; 278 passed, 1 expected skip, 0 failed;
- Python: 81 passed, 0 failed;
- `git diff --check`: passed;
- publication flags remained false.

PR [#444](https://github.com/wecreates/Money-factory/pull/444) used immutable head `0638cb6628dab0d540a0b5ed60bdfd94f0b4e68c`. Cross-repository run `42160754322`, job `127705575088`, passed and the PR merged as `f2f09e43c8462a3076d22904d3a9678d0c3fb8bf`.

## Database administration and execution limits

The prior database administration attempts through the connector/browser had failed. No credible changed database administration access path appeared in R489, so the run did not repeat the same failed action. The code and tests above are not a substitute for live database provisioning, backup/restore evidence, account verification, platform preview, or controlled launch acceptance.

This receipt describes one bounded scheduled execution with the tools and permissions actually available to it. It does not claim a continuously running self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. In particular, live dedicated database/durable recovery, current external grants and account records, authorized marketplace intelligence, regional-rights evidence, official-template provenance, independent human/platform QA and remediation, authorized platform-account adapters, live economics/reconciliation, measured capacity, end-to-end live acceptance, and controlled launch readiness still require real evidence. Publication remains held for explicit owner approval, and this automation cannot enable it.

The continuation automation therefore remains enabled.

## Receipt deployment suppression

Documentation merge `920458c668ef3e7df9dc968534586412318fed78` was ignored by Render as intended in event `evt-dbml8j0n74is73b6n1e0`. The verified live deploy therefore remained `dep-dbml5avavr4c738skq50` from functional merge `3dc03c2f5c0112f8aea710d5190788c94d18e08c`.
