# POD run receipt R490

Date: 2026-11-06 UTC

## Scope and result

This scheduled run continued the Amazon KDP/POD lane across `wecreates/content-control` and `wecreates/Money-factory`. Etsy remained excluded. The run repaired one unblocked diagnostic cancellation/resource-safety defect, merged the exact passing implementation and consumer pin, and verified the free Render deployment. This is implementation and verification evidence, not live acceptance: all 24 acceptance areas remain **OPEN**.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remained mandatory throughout. The run did not enable publication, spend money, contact a third party, access a social vault, widen network access, or claim marketplace approval, revenue, credentials, or clearance.

## Reconciled starting heads and concurrent work

- Content Control: `d32280a75e94dfdd8d73320da1117c2162802df6`
- Money Factory: `f2f09e43c8462a3076d22904d3a9678d0c3fb8bf`
- Existing open pull requests and current repository heads were inspected before creating work. None duplicated R490; unrelated and Etsy work was preserved.

## Defect and repair

`integrations/pod/diagnostic-deadline.mjs`, which bounds live capacity and metrics diagnostics, invoked the database operation before registering its abort listener. If listener registration threw, database work had already started without cancellation control. A throwing listener-removal hook could also replace or strand an otherwise settled diagnostic.

The pre-repair focused regression failed by exposing the private listener error (`private listener failure`) instead of the fixed diagnostic timeout, after the operation had already been admitted. The repair:

- registers the abort listener before starting database work;
- rejects with the fixed `POD_DIAGNOSTIC_TIMEOUT` result without starting work if listener registration fails;
- prevents work after synchronous cancellation during registration;
- makes listener removal best-effort so cleanup failure cannot strand success or failure settlement;
- preserves the established late-result `onLate` path.

Three regression tests cover failed registration, synchronous cancellation, and throwing cleanup.

## Content Control verification and merge

Local evidence:

- focused capacity, metrics, operations, dashboard and deadline suite: 82 passed, 0 failed;
- complete Node POD workflow suite: 1,167 tests; 1,158 passed, 9 expected skips, 0 failed;
- complete Python POD workflow suite: 385 passed, 0 failed;
- separate production E2E boundary: 1 expected skip because live credentials/publication are intentionally unavailable;
- `git diff --check`: passed.

PR [#1093](https://github.com/wecreates/content-control/pull/1093) used immutable head `09e025f3500d7a56f80417ac120d3c9a5d8a75a0` and passed:

- POD integration gates: run `42164188483`, job `127716677170`;
- POD container runtime gates: run `42164188544`, job `127716677753`.

It merged as `da8f85bf47524c0c822b4755014a0fa46af5a669`.

## Free Render deployment

Authorized workspace/service:

- workspace `tea-darsafojo6nc739844hg`;
- service `srv-darsdb8u01pc73dn4i2g` (`content-control-render-worker`);
- free Docker web service, `main`, commit-triggered auto-deploy, not suspended.

Exact functional merge `da8f85bf47524c0c822b4755014a0fa46af5a669` deployed as `dep-dbmlp66c6qcc73b8p9qg`. Build-started event `evt-dbmlp6jfnrrc739unbs0`, successful build-ended event `evt-dbmlpf1uqbhc73b01890`, deploy-started event `evt-dbmlp65494ic73a7fhgg`, and successful deploy-ended event `evt-dbmlpn47j7js73bciiqg` all bind the exact merge. Fresh public probes showed:

- `/health`: alive; `production_approved=false`; `publication=false`;
- `/livez`: alive; `production_approved=false`; `publication=false`;
- `/readyz`: `ok=false` as required for a held launch, `qaStatus=GREEN`, `hashBound=true`, and exact expected/actual SHA-256 `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`; `captionReady=false`; `renderStatus=v2-validation-complete`.

The live health response is deployment evidence only. It does not establish marketplace acceptance or any of the 24 live acceptance areas.

## Money Factory authority pin

The Money Factory workflow now pins Content Control functional merge `da8f85bf47524c0c822b4755014a0fa46af5a669`.

Local bridge evidence:

- Node: 279 tests; 278 passed, 1 expected skip, 0 failed;
- Python: 81 passed, 0 failed;
- `git diff --check`: passed;
- publication flags remained false.

PR [#445](https://github.com/wecreates/Money-factory/pull/445) used immutable head `7891d0c2404dff9742205ff3c6621a2d6698eeee`. Cross-repository run `42165089901`, job `127719582842`, passed and the PR merged as `b6cdfe812dd08afda88e27a17bb0ee2071b80998`.

## Database administration and execution limits

The prior database administration attempts through the connector/browser had failed. No credible changed database administration access path appeared in R490, so the run did not repeat the same failed action. The code and tests above are not a substitute for live database provisioning, backup/restore evidence, account verification, platform preview, or controlled launch acceptance.

This receipt describes one bounded scheduled execution with the tools and permissions actually available to it. It does not claim a continuously running self-hosted worker.

## Acceptance status

All 24 acceptance areas in `POD_COMPLETION_CHECKLIST.md` remain **OPEN**. In particular, live dedicated database/durable recovery, current external grants and account records, authorized marketplace intelligence, regional-rights evidence, official-template provenance, independent human/platform QA and remediation, authorized platform-account adapters, live economics/reconciliation, measured capacity, end-to-end live acceptance, and controlled launch readiness still require real evidence. Publication remains held for explicit owner approval, and this automation cannot enable it.

The continuation automation therefore remains enabled.

## Receipt deployment suppression

Pending verification after this receipt is merged with `[skip render]`.
