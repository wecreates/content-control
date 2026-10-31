# POD run receipt R397 — reject executable capacity query results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R396 receipt merge `a133a2591ee36b1e83418db4a8e20a0a74167668`.
- Money Factory had advanced from the R396 pin merge to `076dc0b18189d23d46a6f6b12671bd56615ab7d6` through one unrelated free-monitor cadence commit. That newer main was preserved as the pin base.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No open POD/KDP implementation pull request or duplicate R397 job existed; unrelated long-lived pull requests were preserved.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

The recorded-capacity endpoint directly destructured the node-postgres result `rows` and then read the returned row through ordinary property access. Accessor-, Proxy-, sparse-, oversized- or malformed driver-owned results could therefore execute adapter code inside authenticated capacity reporting or supply mutable measurement evidence.

Regression-only local commit `8674376448ff320cf4edd2a2292cad3f3e364e4e` and remote head `5ba3e7bc86ff13091c5e8436c5038eaf86ebcf00` reproduced the defect:

- focused local run: six tests, five passed, and only the new regression failed because `CAPACITY_ROWS_GETTER_EXECUTED` escaped instead of the fixed fail-closed diagnostic;
- hosted integration run `41183004204`, job `124484089816`: 1,034 tests, 1,033 passed and only the new capacity regression failed with `CAPACITY_ROWS_GETTER_EXECUTED`;
- expected-red container run `41183004168` was superseded, so it is not acceptance evidence.

Content Control PR #929 snapshots the one-row capacity result through own data descriptors before measuring historical activity. It requires exactly one dense inert row, copies trusted PostgreSQL timestamps and bounded count strings, and rejects result/array/row Proxies, accessors, sparse, empty or oversized arrays, malformed timestamps and executable fields as `CAPACITY_REPORT_INVALID`. Count strings are bounded to PostgreSQL `bigint` range width. The endpoint continues to report historical records only and never converts target counts into capacity or launch acceptance.

Final local commit `d5cf0c060faac09213e5f56267fdb2a6c15c8ed2` produced remote exact head `870b61514da6272ea7ec39308b4680c3a54cf9b5`, which passed:

- focused local capacity/metrics/operations suite: 44/44;
- broad local POD suite: 1,034 total, 1,025 passed, nine environment-only PostgreSQL skips and zero failures;
- exact-head integration run `41183152921`, job `124484531713`: 1,034/1,034 Node/PostgreSQL tests, 385 Python tests, real production-to-durable-review E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41183152937`, job `124484584353`: production image SHA-256 `a638f6c9fadcb66e2f3d90776648c611da597c5650fdf1bc5baa7f50c0df9a3c`, non-root UID 10001/offline dependency check, 385 Python QA/rendering tests, 1,034/1,034 Node/PostgreSQL tests, real durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

The local Python command reached 266 tests but its transient execution image lacked `cv2`, causing two import errors. It is not acceptance evidence. Both hosted Python suites installed the pinned dependency stack and passed 385/385.

PR #929 merged as `ded5fb815fdc42a6e15c6e2e090ba03e09b824d1`. Post-merge System Wiring run `41183682562`, job `124486134785`, passed. POD integration run `41183682561`, job `124486134883`, passed 1,034/1,034 Node/PostgreSQL tests and 385 Python tests with both publication flags false and the real production-to-durable-review E2E passing.

## Money Factory authority pin

Money Factory PR #352 changed only the Content Control verification pin from the R396 merge to `ded5fb815fdc42a6e15c6e2e090ba03e09b824d1`. Exact pin head `13bfdc93f530e6f1fd983cc7aa759b7c6767f57b` passed cross-repository run `41183722230`, job `124486256220`: 670/670 pinned Content Control Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #352 merged as `8b1321b935ecca989359ad2870863262923d5b4b`. Its main workflow pins Content Control exactly to `ded5fb815fdc42a6e15c6e2e090ba03e09b824d1`.

## Authorized Render verification

Render detected functional merge `ded5fb815fdc42a6e15c6e2e090ba03e09b824d1` and created deploy `dep-dbiq6495efls73da4e40`. Deploy-started event `evt-dbiq64lh3lcs73fv2i5g` was followed by pipeline-minutes-exhausted event `evt-dbiq64iqphnc73didrk0` and failed deploy-ended event `evt-dbiq64ggbm7c73favnag`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

The authorized service remained active, unsuspended, one free Docker instance with auto-deploy enabled when inspected. This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens measured-capacity reporting and security; it does not prove a provisioned restricted database beyond the existing bounded evidence, independent live backup/restore retention, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and live market sources, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics and reconciliation statements, owner-phone operations, live monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
