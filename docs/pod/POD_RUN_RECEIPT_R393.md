# POD run receipt R393 — reject executable market-intelligence query results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R392 receipt merge `a411c6bd92569b6b37e394fbcc573c1e773b41f3`; Money Factory started from `6bd0439c8084280bd2b9e021e9b41a1ef0807310`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No open POD/KDP pull request or duplicate R393 job existed; unrelated long-lived pull requests were preserved.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

Authorized market-intelligence intake directly dereferenced the node-postgres insert result's `rowCount`, `rows`, returned row and `id`, then directly dereferenced replay query rows and nested JSON before deciding whether a signed observation was an immutable retry. Accessor-, Proxy-, sparse-, oversized- or nested executable results could therefore execute adapter code inside the market-evidence trust boundary.

Regression-only local commit `69291c25392a57ef9aa90df973b4f0d6b4b76fe2` and remote head `0ed0121a23b56e18c1ab660796b0a59495c50e55` reproduced the defect:

- focused local run: 23 tests, 22 passed, and only the new regression failed because the insert `rowCount` getter executed;
- hosted integration run `41165289373`, job `124431424770`: 1,017 tests, 1,016 passed and only the new market-query regression failed with the same getter trace;
- expected-red container run `41165289371` was superseded and cancelled, so it is not acceptance evidence.

Content Control PR #921 snapshots insert and replay results only through own data descriptors. It accepts the legitimate inert node-postgres result wrapper while rejecting accessors, Proxies, sparse or oversized arrays, non-record rows, malformed selected fields and executable nested observation JSON as `MARKET_QUERY_UNVERIFIED`. Insert count and returned-row cardinality must agree. Replay is bounded to one row, stored price parsing is bounded to the original safe-integer contract, nested JSON is copied and frozen under depth/node limits, and the replay SQL now selects only the fields used by the immutable comparison.

Final local commit `339601783a34e7203108796cc03b1942c2c17a92` and remote exact head `306af663463f98317b008d2850a2412e07d2906d` passed:

- focused market, evidence-expiry and storage-checkpoint suites: 43/43;
- broad local POD suite: 1,017 total, 1,008 passed, nine environment-only skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- exact-head integration run `41165886154`, job `124433394255`: 1,017/1,017 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41165886051`, job `124433469251`: production-image build, non-root/offline dependency check, 385 Python QA/rendering tests, 1,017/1,017 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #921 merged as `f3a8d5f5080adba749321a7094532dae557d7895`. Post-merge System Wiring run `41166401378` and POD integration run `41166401401`, job `124434801012`, passed; the latter repeated 1,017/1,017 Node/PostgreSQL tests and 385 Python tests with both publication flags false.

## Money Factory authority pin

Money Factory PR #348 changed only the Content Control verification pin from the R392 merge to `f3a8d5f5080adba749321a7094532dae557d7895`. Exact pin head `d017e023d0c5f2c166a6736ac6aebd5eb3ec2e4c` passed cross-repository run `41166414807`, job `124434842068`: 656/656 Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #348 merged as `e5a465eaf46cd8d078f9c1c5d0fc5d41e5798164`. Its main workflow pins Content Control exactly to `f3a8d5f5080adba749321a7094532dae557d7895`.

## Authorized Render verification

Render detected functional merge `f3a8d5f5080adba749321a7094532dae557d7895` and created deploy `dep-dbimd9tg1s2s73f63i4g`. Deploy-started event `evt-dbimda29249c73800ikg` was followed by pipeline-minutes-exhausted event `evt-dbimda12tl4s73e00utg` and failed deploy-ended event `evt-dbimda12tl4s73e00uvg`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens authorized market intelligence, immutable replay and security; it does not prove real provider statements, live restricted-database/preflight access, independent durable backup, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and live market sources, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics, owner-phone operations, monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
