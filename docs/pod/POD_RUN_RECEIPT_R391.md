# POD run receipt R391 — reject executable financial reconciliation results

Date: 2026-10-31 UTC

## Reconstructed state

- Content Control started from `23e637f048399f187568b07230e03092d32e423d`; Money Factory started from the then-current concurrent main `86eca9749bc3a460a898a93533f49225706e9f2a`.
- The current completion checklist, implementation status, free-deployment guide, open pull requests, recent workflows and authorized Render service were inspected before implementation. No concurrent POD/KDP pull request or duplicate R391 job existed.
- Money Factory had advanced after R390 for unrelated scheduled work while retaining the exact R390 Content Control pin and literal `PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false`; R391 branched from that current head.
- Scheduled Full Capability Validation run `41156817226` was inspected: its validation unit tests passed, its planner exited 2 and retained a blocked plan, and it was not a POD regression. No concurrent workflow was changed.
- The unchanged database-administration access path was not retried. Render free pipeline minutes remained exhausted, so no manual deploy retry, paid resource, cache/plan change or replacement service was created.
- Existing untracked dependencies and caches in the scheduled workspace were preserved.

## Confirmed defect, expected-red and repair

Financial intake directly dereferenced the ledger insert's `rowCount` and replay query's `rows`, array entries and row fields after stored-evidence verification but before its immutable replay decision and outbox mutation. Accessor- or Proxy-backed results could therefore execute adapter code in the financial reconciliation trust boundary.

Regression-only local commit `dfe40d0c2e437f8f7ee99e515f5b6b370ce3af52` and remote head `b37ea962edeff1f30d6f52dd7090d922e6738ac8` reproduced the defect:

- focused local run: 15 tests, 14 passed, and only the new regression failed because the `rowCount` getter executed;
- hosted integration run `41157266004`, job `124406696348`: 1,015 tests, 1,014 passed and only the new regression failed with the same getter trace;
- expected-red container run `41157265988` also failed and is not acceptance evidence.

The first repair correctly rejected executable structures, but exact hosted integration run `41157796568`, job `124408345030`, exposed a real-driver compatibility error: node-postgres returns an inert `Result` instance with a library prototype. That run passed the new executable-result regression but failed the real PostgreSQL finance assertion with `FINANCIAL_QUERY_UNVERIFIED`. Superseded container run `41157796615` was cancelled. Neither run is acceptance evidence.

Content Control PR #917 was corrected to accept only own data-property query fields from non-Proxy driver results, while retaining ordinary-record requirements for replay rows. It validates the insert count as a bounded safe integer, snapshots at most two dense replay rows into private frozen records, rejects accessors, Proxies, sparse arrays, oversized results and executable selected fields as `FINANCIAL_QUERY_UNVERIFIED`, and narrows the replay SQL to only the fields used by the immutable comparison.

Final remote exact head `bcfcaaa49f4f8a9de1710ea28b964227fa3e4ee4` passed:

- focused finance, evidence-expiry and storage-checkpoint suites: 35/35;
- broad local POD suite: 1,015 total, 1,006 passed, nine environment-only skips and zero failures;
- local Python/OpenCV/PDF suite: 385/385;
- integration run `41157954311`, job `124408837897`: 1,015/1,015 Node/PostgreSQL tests, 385 Python tests, production E2E, syntax, workflow controls and free-review guards;
- container run `41157954365`, job `124408994580`: production-image build, non-root/offline dependency check, Python QA/rendering, 1,015/1,015 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #917 merged as `01b22ce36d8d95ef175ab7c76a225b5529ede873`. Post-merge System Wiring run `41158604644` and POD integration run `41158604681`, job `124410841690`, passed.

## Money Factory authority pin

Money Factory PR #346 changed only the Content Control verification pin from the R390 merge to `01b22ce36d8d95ef175ab7c76a225b5529ede873`. Exact pin head `221b3e54d9f3c80b8611850f9942304fa5a82158` passed cross-repository run `41158620961`, job `124410895405`: 655 Node contracts; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`.

PR #346 merged as `611cc886e0302014ce85c07715b71c23a3ea6408`. Its main workflow pins Content Control exactly to `01b22ce36d8d95ef175ab7c76a225b5529ede873`.

## Authorized Render verification

Render detected functional merge `01b22ce36d8d95ef175ab7c76a225b5529ede873` and created deploy `dep-dbikr4nb9u1s73asdfeg`. Deploy-started event `evt-dbikr4q9249c73fv3a5g` was followed by pipeline-minutes-exhausted event `evt-dbikr4ogbm7c73f7o790` and failed deploy-ended event `evt-dbikr4q9249c73fv3a70`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free quota state is unchanged.

This run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production/publication.

## Acceptance truth

All 24 live acceptance areas remain OPEN. This repair strengthens financial reconciliation, immutable replay and security; it does not prove real provider statements, live restricted-database/preflight access, independent durable backup, deployed hybrid hosting, current Money Factory grants/revocation, authorized owner accounts and market intelligence, current regional rights and official templates, substantive KDP editorial/preview acceptance, calibrated independent QA/remediation, authorized live adapters for KDP/Redbubble/TeePublic/Zazzle/Spreadshirt, real economics, owner-phone operations, monitoring/recovery drills, measured 100/day or 1,000/day capacity, real end-to-end provider acceptance, or controlled launch.

`PUBLICATION_ENABLED=false` and `POD_PUBLICATION_ENABLED=false` remain mandatory. Publication is held for explicit owner approval only after every live criterion is verifiably complete.
