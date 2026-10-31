# POD run receipt R394 — reject executable state-archive query results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from the R393 receipt merge `fc1223999af98e4ee5d8855fbd29370deb6c00cc`; Money Factory started from `e5a465eaf46cd8d078f9c1c5d0fc5d41e5798164`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No open POD/KDP implementation pull request or duplicate R394 job existed; unrelated long-lived pull requests were preserved.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

Dedicated state export and recovery directly dereferenced node-postgres result `rows`, row fields and restore `rowCount` values for migration/schema checks, column catalog checks, cursored export, empty-target checks and restore receipts. Accessor-, Proxy-, sparse- or oversized executable results could therefore run adapter code inside the durable-recovery trust boundary or poison restore evidence.

Regression-only local commit `91845b37595a26f6d52291365dd73521fc695d9c` and remote head `c6720fc36f4f880e338dd28efc20ebd52f17ae76` reproduced the defect:

- focused local run: 49 tests, 48 passed, and only the new regression failed because the `rows` getter executed;
- hosted integration run `41171512756`, job `124450270769`: 1,018 tests, 1,017 passed and only the new state-archive regression failed with `STATE_ARCHIVE_ROWS_GETTER_EXECUTED`;
- expected-red container run `41171512688` was superseded, so it is not acceptance evidence.

Content Control PR #923 descriptor-snapshots migration, column, cursor, empty-target and mutation-count results before use. It accepts legitimate inert node-postgres result wrappers while rejecting result/row/array Proxies, accessors, sparse or oversized arrays, unexpected row fields and unbounded counts as `STATE_ARCHIVE_QUERY_UNVERIFIED`. Migration rows are bounded to five, schema columns to 64, cursor and empty-target rows to one, mutation counts to the archive row cap, and accepted scalar records are copied and frozen.

The first repair head `428ed2254c8f797477c6023388dfb30f351a078d` was not accepted: hosted integration run `41171611120`, job `124450567110`, passed 1,025 of 1,026 tests but exposed that two restore receipt fields still held whole PostgreSQL result objects. The repair was corrected to snapshot the awaited mutation counts, and a successful bounded-count regression was added. That failed run is recorded as defect-finding evidence, not acceptance evidence.

Final local commits `cdddc3c502536aad02e4b8f0cb865c91a93963c7` and `15a30fe302fd51579461dca7af6b3bfeb60b175a` produced remote exact head `de37de37e25f70768e61406d1c14c7dd679586d0`, which passed:

- focused state-archive suite: 58/58;
- broad local POD suite: 1,027 total, 1,018 passed, nine environment-only PostgreSQL skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- exact-head integration run `41171984362`, job `124451702771`: 1,027/1,027 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- exact-head container run `41171984397`, job `124451769882`: production-image build, non-root/offline dependency check, 385 Python QA/rendering tests, 1,027/1,027 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #923 merged as `0a81b479520e481ce853e6707d2c0543f6a57573`. Post-merge System Wiring run `41172403426` passed. POD integration run `41172403427`, job `124452956687`, passed 1,027/1,027 Node/PostgreSQL tests and 385 Python tests with both publication flags false.

## Money Factory authority pin

Money Factory PR #349 changed only the Content Control verification pin from the R393 merge to `0a81b479520e481ce853e6707d2c0543f6a57573`. Exact pin head `cd08ec2a2daeac24f7bb7563e5d67e8d60f74b9c` passed cross-repository run `41172415134`, job `124452993234`: 666/666 pinned Content Control Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121/121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #349 merged as `59775ea6b440972357da8cf9ff3c7592084aebcb`. Its main workflow pins Content Control exactly to `0a81b479520e481ce853e6707d2c0543f6a57573`.

## Authorized Render verification

Render detected functional merge `0a81b479520e481ce853e6707d2c0543f6a57573` and created deploy `dep-dbinmj15efls73d8690g`. Deploy-started event `evt-dbinmj7dnq4s73dghtd0` was preceded by pipeline-minutes-exhausted event `evt-dbinmj5h3lcs73ftittg` and followed by failed deploy-ended event `evt-dbinmjaqphnc73dgtfmg`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

Scheduled live-smoke run `41172435193`, job `124453053911`, consequently recorded a blocked live candidate with publication false and persisted `state/live-deployment-health.json` as skip-render commit `834bd73b50828c159055b9dc85eb3e1afda3e00f`; Render recorded commit-ignored event `evt-dbinmtrm8hqs73f1esrg`. The authorized service remains active, unsuspended, one free Docker instance with auto-deploy enabled.

This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens dedicated durable-state export/recovery and security; it does not prove a provisioned restricted database, independent live backup/restore drill, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and live market sources, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics and reconciliation statements, owner-phone operations, live monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
