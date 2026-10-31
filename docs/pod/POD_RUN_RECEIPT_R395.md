# POD run receipt R395 — reject executable artifact-archive query results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R394 receipt merge `da2cbbc893a2027f8f9a23bae9dbf1086636cc28`; Money Factory started from `59775ea6b440972357da8cf9ff3c7592084aebcb`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No open POD/KDP implementation pull request or duplicate R395 job existed; unrelated long-lived pull requests were preserved.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

Dedicated artifact backup and recovery directly dereferenced node-postgres result `rows`, row fields and restore usage/identity results. Accessor-, Proxy-, sparse- or oversized executable results could therefore run adapter code inside the durable-artifact trust boundary or falsify recovery evidence.

Regression-only local commit `965f11b3` and remote head `5df63a7c07ec7880893f7e280db490f72e3072ec` reproduced the defect:

- focused local run: 56 tests, 55 passed, and only the new regression failed with `ARTIFACT_ARCHIVE_ROWS_GETTER_EXECUTED`;
- hosted integration run `41174749732`, job `124459891466`: 1,028 tests, 1,027 passed and only the new artifact-archive regression failed with `ARTIFACT_ARCHIVE_ROWS_GETTER_EXECUTED`;
- expected-red container run `41174749724` was superseded, so it is not acceptance evidence.

Content Control PR #925 descriptor-snapshots artifact cursors, storage usage and existing-artifact identity results before use. It accepts inert node-postgres result wrappers while rejecting result/row/array Proxies, accessors, sparse or oversized arrays, unexpected or missing row fields and executable artifact buffers as `ARCHIVE_QUERY_UNVERIFIED`. Cursors, usage and identity lookups are bounded to one row; accepted scalars are copied and frozen, and accepted artifact bytes are privately copied. The prior oversized legacy-body diagnostic remains `ARCHIVE_ARTIFACT_INVALID`.

Final local commit `58ce18f0` produced remote exact head `919d4e6879b32e6da07deb662846bdaa9d64a5eb`, which passed:

- focused artifact-archive suite: 59/59;
- broad local POD suite: 1,031 total, 1,022 passed, nine environment-only PostgreSQL skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- exact-head integration run `41174961795`, job `124460496700`: 1,031/1,031 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41174961781`, job `124460504859`: production-image build, non-root UID 10001/offline dependency check, 385 Python QA/rendering tests, 1,031/1,031 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #925 merged as `69652a0097eb5f1e76b7c3fd0fc531dd6112b916`. Post-merge System Wiring run `41175435973` passed. POD integration run `41175435908`, job `124461897503`, passed 1,031/1,031 Node/PostgreSQL tests and 385 Python tests with both publication flags false and the real production-to-durable-review E2E passing.

## Money Factory authority pin

Money Factory PR #350 changed only the Content Control verification pin from the R394 merge to `69652a0097eb5f1e76b7c3fd0fc531dd6112b916`. Exact pin head `f206f0451a96875730955824c3762b0c4e10b494` passed cross-repository run `41175498299`, job `124462077923`: 670/670 pinned Content Control Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #350 merged as `f34835776f1d3ff52a0b7ddd69ba7b57f970d89e`. Its main workflow pins Content Control exactly to `69652a0097eb5f1e76b7c3fd0fc531dd6112b916`.

## Authorized Render verification

Render detected functional merge `69652a0097eb5f1e76b7c3fd0fc531dd6112b916` and created deploy `dep-dbioc7jbc2fs73cmq10g`. Deploy-started event `evt-dbioc7p2tl4s73e14pvg` was followed by pipeline-minutes-exhausted event `evt-dbioc7qqphnc73dh8rp0` and failed deploy-ended event `evt-dbioc7q9249c73815gt0`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

The authorized service remained active, unsuspended, one free Docker instance with auto-deploy enabled when inspected. This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens dedicated durable-artifact backup/recovery and security; it does not prove a provisioned restricted database, independent live backup/restore drill, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and live market sources, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics and reconciliation statements, owner-phone operations, live monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
