# POD run receipt R390 — reject executable listing reconciliation results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from `372c864e24f47f34ceba00982886db886a50bb18`; Money Factory started from `f52bc6179516d8057ab1d5df54ce622e080496dd`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No concurrent POD/KDP pull request or duplicate R390 job existed.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect and repair

Provider listing reconciliation directly dereferenced queue and provider-inbox query results, including retained JSON payload fields, after signature verification but before its immutable replay decision and publication-state/inbox mutations. Accessor- or Proxy-backed result structures could therefore execute adapter code in the reconciliation trust boundary.

Regression-only local commit `ed6e8573a4ca2a26f4fafa55b311d5feb7992029` and remote head `687399eb94980a6e7ef49f0dba0cae56e2c3ea19` reproduced the defect:

- focused local run: 14 tests, 13 passed, with only the new regression failing because the job `rows` getter executed;
- hosted integration run `41153953660`, job `124396517279`: 1,014 tests, 1,013 passed and only the new regression failed with the same getter trace;
- superseded expected-red container run `41153953705` was cancelled and is not acceptance evidence.

Content Control PR #915 added bounded descriptor-safe snapshots for the single locked queue row and single retained provider-inbox row. It rejects Proxy, accessor, sparse, oversized, non-ordinary or nested executable payload structures as `LISTING_QUERY_UNVERIFIED`, copies only the fields used by the decision into private frozen records, and no longer trusts executable `rowCount` before a replay decision.

Repaired local commit `75fd11c28660b7316891ac5b5c55f6a1cd40664e` and remote exact head `db2ae0143d0a33296ed72f55804cf4bcf2578ea8` passed:

- focused reconciliation, finance, release and storage suites: 103/103;
- serialized local POD suite: 1,014 total, 1,005 passed, nine environment-only skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- integration run `41154100629`, job `124396974347`: 1,014/1,014 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- container run `41154100622`, job `124397260621`: production-image build, non-root/offline dependency check, 385 Python tests, 1,014/1,014 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #915 merged as `9ee9cd03809562efe8397a9be21f20285e13da8a`. Post-merge System Wiring run `41154710471` and POD integration run `41154710472`, job `124398844384`, passed.

## Money Factory authority pin

Money Factory PR #345 changed only the Content Control verification pin. Exact pin head `d8ff4729ad89571204ae5b79cf2da97577965f54` passed cross-repository run `41154724436`, job `124398889413`: 655 Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #345 merged as `3b8b368feb17aa8d55634aac993f77fc50f638f5` and pins Content Control exactly to `9ee9cd03809562efe8397a9be21f20285e13da8a`.

## Hosted observation and remaining acceptance

Render detected functional merge `9ee9cd03809562efe8397a9be21f20285e13da8a` and created deploy `dep-dbik3q6q1p3s739t2lvg`. Deploy-started event `evt-dbik3q40jhrc73b9lnn0` was followed by pipeline-minutes-exhausted event `evt-dbik3q2qphnc73deo470` and failed deploy-ended event `evt-dbik3q2qphnc73deo490`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

All 24 live acceptance areas remain OPEN. This repair strengthens authorized provider readback, publishing safeguards, immutable reconciliation and security; it does not prove live hosting, current grants, owner account records, official marketplace access, real economics/statements, measured capacity, independent review, end-to-end provider acceptance or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
