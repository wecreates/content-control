# POD run receipt R392 — reject executable operational metrics results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R391 receipt merge `5014bc4851ec02bffd425d0f8880707d5499c841`; Money Factory started from `611cc886e0302014ce85c07715b71c23a3ea6408`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No concurrent POD/KDP pull request or duplicate R392 job existed.
- Concurrent scheduled work was preserved. Before this receipt, Content Control main advanced through runtime-security evidence `41babad0bba3937797001c7e5b868699d9ddcef5`, zero-credit QA evidence `be545d61`, and accepted-candidate rollback-ledger evidence `c856f51d8dc070b369e1b99ae9ecc5c196dc4009`; the receipt branch started from that current head.
- Concurrent Free Production Watchdog run `41161240785`, job `124419040910`, retained `REPAIR_REQUIRED` for its independently documented dependency-security, live-deployment, caption, provenance and candidate-convergence gates, then dispatched its existing free repair workflows. It did not identify a regression in the R392 POD metrics change and was not modified by this run.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

The authenticated `/api/print/metrics` route directly dereferenced each node-postgres query result's `rows`, array entries and selected fields for queue states, failures, storage, financial totals, expired leases and outbox counts before operational-health computation and response serialization. Accessor-, Proxy-, sparse- or otherwise executable results could therefore execute adapter code inside the monitoring and reconciliation trust boundary.

Regression-only local commit `bc71496f1ca5938a8b19adee3029df098692c461` and remote head `54ebfac3b68c9b123415065325401109aa69d7fe` reproduced the defect:

- focused local run: 17 tests, 16 passed, and only the new regression failed because the `rows` getter executed;
- hosted integration run `41160195783`, job `124415855887`: 1,016 tests, 1,015 passed and only the new regression failed with the same getter trace;
- expected-red container run `41160195839` also failed and is not acceptance evidence.

Content Control PR #919 snapshots every result immediately through own data descriptors. It accepts the legitimate inert node-postgres `Result` wrapper while rejecting Proxies, accessors, sparse or oversized arrays, non-record rows, executable selected fields, malformed identities and non-canonical counts/totals as `POD_METRICS_QUERY_UNVERIFIED`. It bounds result cardinality by the finite platform/state/currency or singleton aggregate domain, validates unique queue and currency identities, then freezes private rows and arrays before health computation or response serialization.

Final local commit `8b8ab860c7a6b39e958c286efb592593ac2ef04a` and remote exact head `c88f72da524ce1dee64a906f46f702b043a7a23d` passed:

- focused operational-health and storage-expiry suites: 33/33;
- broad local POD suite: 1,016 total, 1,007 passed, nine environment-only skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- exact-head integration run `41160756471`, job `124417547705`: 1,016/1,016 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41160756462`, job `124417548163`: production-image build, non-root/offline dependency check, Python QA/rendering, 1,016/1,016 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #919 merged as `52f9b76dceabad6be903093a981ccd14f01624b5`. Post-merge System Wiring run `41161211064` and POD integration run `41161211070`, job `124418949568`, passed; the latter repeated 1,016/1,016 Node/PostgreSQL tests and 385 Python tests with publication disabled.

## Money Factory authority pin

Money Factory PR #347 changed only the Content Control verification pin from the R391 merge to `52f9b76dceabad6be903093a981ccd14f01624b5`. Exact pin head `7cf0efb04b58db602998bd796f78226a9d662136` passed cross-repository run `41161221559`, job `124418983055`: 655/655 Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #347 merged as `6bd0439c8084280bd2b9e021e9b41a1ef0807310`. Its main workflow pins Content Control exactly to `52f9b76dceabad6be903093a981ccd14f01624b5`.

## Authorized Render verification

Render detected functional merge `52f9b76dceabad6be903093a981ccd14f01624b5` and created deploy `dep-dbilb77b9u1s73asp3t0`. Deploy-started event `evt-dbilb7fdnq4s73df3jo0` was followed by pipeline-minutes-exhausted event `evt-dbilb7dh3lcs73fs5s6g` and failed deploy-ended event `evt-dbilb7fdnq4s73df3jr0`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens monitoring, financial reconciliation and security; it does not prove real provider statements, live restricted-database/preflight access, independent durable backup, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and market intelligence, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics, owner-phone operations, monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
