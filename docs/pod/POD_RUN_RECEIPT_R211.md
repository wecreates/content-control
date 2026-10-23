# POD run receipt r211 — aggregate Python verification gate

Date: 2026-10-23

## Scope and reconstruction

The run reconstructed current heads after r210 and read the current completion,
implementation-status and free-deployment documents, open pull requests, workflow
results, and the authorized existing Render service. Content Control started from
`c5d5167eca66bd7f2e9cf5eca4127a65f9ffe1cb`; Money Factory started from
`feda14420d95843c4c43abda82851a46a5c6b604`. The only open matching Content
Control result was unrelated draft PR 378; Money Factory had no open POD PR.
Database administration was not retried because no credible access-path change was
present.

## Repaired verification boundary

The documented `npm run test:pod-python` command discovered only
`tests/test_pod.py`, omitting ten other `test_pod*.py` suites. The integration
workflow compensated with ten separately maintained one-file invocations, leaving
the documented/local and hosted gates able to drift.

[Content Control PR 514](https://github.com/wecreates/content-control/pull/514)
merged exact tested head `461a96606f2e0b9fea437b1a972d5e75c8b2279d` as
`a6b6c5aa3c05f73cf174da5bda09b3b6477d5754`. The package script now uses the
quoted `test_pod*.py` discovery pattern, the integration workflow invokes that
aggregate gate once, and `package.json` changes trigger that workflow. A regression
test locks the command, suite discovery and nonduplicated workflow contract.
Exact changed blobs were:

- `.github/workflows/pod-integration.yml`:
  `0504de834a3435f426c2b5ea1cb511c1595578b1`
- `package.json`: `1699511ede3295b50fbe20a8aa96e14e08892237`
- `tests/pod-python-gate.test.mjs`:
  `1cac159ed8f3c470e3d15bd9eb2ee61ac4722e53`

## Verification evidence

The local command-contract regression passed 2/2 and workflow-control policy
verification passed with publication disabled. The broad local Node POD run
reported 673 tests: 664 passed and two expected environment-gated skips. Six
PostgreSQL files could not import the absent local `pg` package. One load-sensitive
process-tree case failed during the broad run and immediately passed in its isolated
15/15 suite. The local Python runtime lacked the pinned OpenCV wheel, so no local
Python-suite pass is claimed.

Hosted gates supplied the missing exact dependencies and both passed on the exact
PR head:

- integration run `39979226615`, job `120501792647`, passed the Node/PostgreSQL
  suite, consolidated 11-file Python discovery command, real production E2E,
  syntax and workflow-control checks;
- production-container run `39979226690`, job `120501793142`, built the Docker
  image and passed its non-root dependency probe, aggregate Python suite,
  Node/PostgreSQL suite, real print/durable-review check and publication-disabled
  startup smoke.

Dependent [Money Factory PR 165](https://github.com/wecreates/Money-factory/pull/165)
pinned verification to Content Control
`a6b6c5aa3c05f73cf174da5bda09b3b6477d5754` while retaining explicit
`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`. Exact tested head
`145da46febc39beb401500398ac0ded7c9650423` merged as
`dcef4157481294cd84c5773ef22e913ee35783d5` after an unchanged-base and clean
mergeability check. Cross-repository run `39980314393`, job `120505583865`, passed
all selected Content Control and Money Factory bridge, review, recovery, rights,
KDP and adapter-contract stages. The changed workflow blob was
`761f098d27988a0ac56c150c109657dfeb86c439`.

## Deployment observation and remaining acceptance

Render automatically attempted the exact Content Control merge as deploy
`dep-dbdnvimk1f9s73fhfc7g`. Deploy-start event
`evt-dbdnviihv4oc73bv40i0` bound
`a6b6c5aa3c05f73cf174da5bda09b3b6477d5754` at
2026-10-23T15:39:54.724884Z. Event `evt-dbdnviihv4oc73bv40j0` reported
`pipeline_minutes_exhausted` at 15:39:54.782410Z, and event
`evt-dbdnvisp5sqc7388kg10` recorded the failed deploy at 15:39:55.342239Z.
No application build ran. A following unrelated runtime-integrity commit also
failed for the same quota condition. No manual retry, paid workaround, replacement
service, credential access, widened network, or unchanged database-administration
retry occurred.

All 24 live acceptance areas remain **OPEN**. This run repairs verification
coverage only; merged code and hosted CI are not live acceptance. Production
restricted database/schema/migrations, retained recovery evidence, deployed hybrid
dependencies, mounted Money Factory authority/current grants and revocation, real
accounts/sources/rights/templates/reviewers, authorized five-platform adapters,
actual economics/reconciliation, owner-phone acceptance, monitoring/recovery
drills, measured capacity and a real authorized end-to-end launch remain
unverified. Both publication flags remain false. Etsy remains excluded. No
approval, clearance, revenue, publication, successful deployment or continuously
running self-hosted worker is claimed.
