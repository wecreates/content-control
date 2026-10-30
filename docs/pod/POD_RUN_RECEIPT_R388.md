# POD run receipt R388 — reject executable outbox query results

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `93d13809071c6b75b96e975934a050dfa5d07086`; Money Factory started from `467e7b84a354ba5b455a3dfd81b02d242d8ae338`.
- No open POD/KDP pull request or duplicate R388 job existed. Untracked dependency/cache directories in the scheduled workspace were preserved.
- The current `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md` were read before implementation. All 24 live acceptance areas still required attributable deployment/provider evidence; code or fixture success was not treated as live acceptance.
- The unchanged database-administration failure path was not retried because no credible new access path was available.

## Confirmed defect and repair

`deliverOutbox` dereferenced the database adapter's result `rows`, result-array entries and event fields directly before signing and delivery. Accessor- or Proxy-backed query results could therefore execute adapter code before network dispatch or durable acknowledgement.

Regression-only local commit `cd5175c3557d443c3b5188702d73aee40408198b` and remote head `4e8298e0d995aced961239b93053df08342be1e7` reproduced the defect:

- focused local run: 27 tests, 26 passed, with only the new regression failing because the `rows` getter executed;
- hosted integration run `41139852938`, job `124351199767`: 1,012 tests, 1,011 passed and only the new regression failed with the same trace;
- superseded expected-red container run `41139852896`, job `124351199396`, was cancelled during Python tests and is not counted as acceptance evidence.

Content Control PR #911 added a bounded descriptor-safe snapshot for at most 20 query rows, their dense array entries and enumerable data fields. It rejects Proxy/accessor/sparse/oversized structures with `OUTBOX_QUERY_UNVERIFIED` and creates private frozen event records before signing, transport or acknowledgement.

Repaired local commit `7ee85e15c763a2874a32dc8355e5973b5ae2a8f7` and remote exact head `d77f8bb364f0db229de864c089b0e6bd4a4ba2ab` passed:

- focused local outbox tests: 27/27;
- serialized full local POD run: 1,012 total, 1,003 passed, nine environment skips, zero failures;
- integration run `41140084355`, job `124351958004`: 1,012/1,012 Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, syntax, workflow controls and four free-review guards;
- container run `41140084356`, job `124352201359`: production-image build, non-root/offline dependency check, 385 Python tests, 1,012/1,012 Node/PostgreSQL tests, real print/durable review E2E, and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #911 merged as `6ba94444b9e0badd492aa4b03f4312d81d0a98e7`. Post-merge System Wiring run `41140843336` passed. Post-merge POD integration run `41140843264`, job `124354431808`, passed all stages with both publication flags false.

## Money Factory authority pin

Money Factory PR #343 changed only the Content Control verification pin. Exact pin head `db63f42408fc740067ef69c82781e9c121de5078` passed cross-repository run `41140879774`, job `124354551082`: 655 Node contract tests; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #343 merged as `f8d61d22dac2601a56c4c5f8d33370aae6ae1643`, and Money Factory main pins Content Control exactly to `6ba94444b9e0badd492aa4b03f4312d81d0a98e7`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge `6ba94444b9e0badd492aa4b03f4312d81d0a98e7` and created deploy `dep-dbihurbm8hqs738p84j0`. Deploy-started event `evt-dbihur9ffr0s73cd7vm0` was followed by pipeline-minutes-exhausted event `evt-dbihur8hr58c73cjd810` and failed deploy-ended event `evt-dbihur979ius7390vakg`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not retry the unchanged database-administration path, broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production or publication.

All 24 live acceptance areas remain OPEN. This repair strengthens Money Factory authority delivery, monitoring and security but does not prove live hosting, current grants, owner account records, authorized source intelligence, official provider templates, independent human review, authorized marketplace submit/readback, real economics or financial reconciliation, measured 100/1,000-per-day capacity, end-to-end provider acceptance, or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
