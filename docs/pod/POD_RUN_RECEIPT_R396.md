# POD run receipt R396 — reject executable financial-totals query results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R395 receipt merge `e92b9e25bd84d5c0ba44bc080018877e00209ec1`; Money Factory started from `f34835776f1d3ff52a0b7ddd69ba7b57f970d89e`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No open POD/KDP implementation pull request or duplicate R396 job existed; unrelated long-lived pull requests were preserved.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

Financial reconciliation directly returned the node-postgres financial-totals result `rows`. Accessor-, Proxy-, sparse-, oversized- or malformed driver-owned results could therefore execute adapter code inside the reconciliation trust boundary or escape as mutable financial evidence.

Regression-only local commit `7c0e8f60a3bce2303b7141428ae0fcaa75f87a52` and remote head `3294aaebfb927ac66aba6631bdeb4c444a103401` reproduced the defect:

- focused local run: 16 tests, 15 passed, and only the new regression failed with `FINANCIAL_TOTAL_ROWS_GETTER_EXECUTED`;
- hosted integration run `41177670350`, job `124468483001`: 1,032 tests, 1,031 passed and only the new financial-totals regression failed with `FINANCIAL_TOTAL_ROWS_GETTER_EXECUTED`;
- expected-red container run `41177670351` was superseded, so it is not acceptance evidence.

Content Control PR #927 descriptor-snapshots financial-total query results before they enter reconciliation reports. It rejects result/row/array Proxies, accessors, sparse or oversized arrays, malformed rows, zero or invalid evidence counts, invalid signed totals, invalid currency codes and duplicate currencies as `FINANCIAL_QUERY_UNVERIFIED`. Rows are bounded to the possible three-letter uppercase currency-code space; accepted scalar fields are copied into frozen rows, and the returned array is frozen and detached from driver-owned objects.

Final local commit `9f0e6b2e587fbfb116f57bacc8fdc7cc3f2b228b` produced remote exact head `7170504a23f7afc82198d1ab63b13900be3fc6d8`, which passed:

- focused finance/read-storage suite: 33/33;
- broad local POD suite: 1,033 total, 1,024 passed, nine environment-only PostgreSQL skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- exact-head integration run `41177834539`, job `124468966023`: 1,033/1,033 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41177834493`, job `124469011168`: production-image build at image SHA-256 `1a511048e60a77b276f7c3d8113f1ad8396136def0a91d5c606303876d59e8ad`, non-root UID 10001/offline dependency check, 385 Python QA/rendering tests, 1,033/1,033 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #927 merged as `a355c80b29c37feee747f2fbc61ca8fd10504648`. Post-merge System Wiring run `41178314466`, job `124470356890`, passed. POD integration run `41178314302`, job `124470356507`, passed 1,033/1,033 Node/PostgreSQL tests and 385 Python tests with both publication flags false and the real production-to-durable-review E2E passing.

## Money Factory authority pin

Money Factory PR #351 changed only the Content Control verification pin from the R395 merge to `a355c80b29c37feee747f2fbc61ca8fd10504648`. Exact pin head `df3370c23a141fbb1bba5a58c6d825e69a27f39f` passed cross-repository run `41178327430`, job `124470393037`: 670/670 pinned Content Control Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #351 merged as `6afae471484e494b7b501b042390d75c8547eda4`. Its main workflow pins Content Control exactly to `a355c80b29c37feee747f2fbc61ca8fd10504648`.

## Authorized Render verification

Render detected functional merge `a355c80b29c37feee747f2fbc61ca8fd10504648` and created deploy `dep-dbip05dg1s2s73f835c0`. Deploy-started event `evt-dbip05dh3lcs73fu9uk0` was followed by pipeline-minutes-exhausted event `evt-dbip05aqphnc73dhkl5g` and failed deploy-ended event `evt-dbip05ndnq4s73dh9o60`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

The authorized service remained active, unsuspended, one free Docker instance with auto-deploy enabled when inspected. This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens financial reconciliation and security; it does not prove a provisioned restricted database, independent live backup/restore drill, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and live market sources, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics and reconciliation statements, owner-phone operations, live monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
