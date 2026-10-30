# POD run receipt R385 — reject executable artifact write inputs

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `1fa0666e0ffd5652a1e8b1ea8d27e6faf69dc7f3`; Money Factory started from `47f1f4c2aa3690c72d038dc788663b2ea1895b2b`.
- No open POD/KDP pull request or duplicate R385 job existed. Older unrelated pull requests were left untouched.
- The current `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md` were read before implementation. All 24 live acceptance rows remained OPEN, and code or fixture success was not treated as live acceptance.
- The unchanged database-administration failure path was not retried because no credible new access path was available.

## Confirmed defect and repair

`ArtifactStore.putMany` still read caller-owned batches and records through ordinary array iteration and destructuring. A Proxy-backed batch or accessor-backed entry could therefore execute caller code and reach database acquisition before input validation.

Regression-only head `269dc9bf7f3b1fa6de2085b9d1318d6eb710965d` reproduced the defect:

- focused local run: 34 tests, 33 passed, with only the new regression failing because the Proxy batch reached the database;
- hosted integration run `41121419133`, job `124288289168`: 1,009 tests, 1,008 passed and only the new regression failed; the trace showed `database reached` instead of `ARTIFACT_BATCH_UNVERIFIED`;
- the superseded expected-red container run `41121419244` was cancelled and is not counted as evidence.

Content Control PR #905 snapshots the array shape and artifact `body`/`mediaType` fields through descriptor-safe data properties before hashing or database access. It rejects Proxy/accessor-backed batches and records without invocation using fixed diagnostics, while preserving semantic validation, byte snapshots, budgets and immutable writes.

Repaired exact head `eaf5d2a48b7a2aca4ebba87c8089ae59bb37ed41` passed:

- focused local artifact tests: 34/34;
- the first full local run encountered one unrelated descendant-cleanup timing failure; the isolated Python-stage file immediately passed 17/17;
- a serialized full local rerun: 1,009 total, 1,000 passed, nine environment skips, zero failures;
- integration run `41121647277`, job `124288990064`: 1,009/1,009 Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, syntax, workflow controls and four free-review guards;
- container run `41121647254`, job `124289316786`: production-image build, non-root/offline dependency check, 385 Python tests, 1,009/1,009 Node/PostgreSQL tests, real print/durable review E2E, and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #905 merged as `4b0ac6156705753190f6bfe3f76123703dea1942`. Post-merge System Wiring run `41122866965` and POD integration run `41122867293`, job `124293558113`, both passed.

## Money Factory authority pin

Money Factory PR #340 changed only the Content Control verification pin to the exact merge above. Exact pin head `5c458aa3b2e79e61864cf1d8c6ad6d2f525bf411` passed cross-repository run `41122950728`, job `124293887920`: 652 Node contract tests; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #340 merged as `cd385bd775b54d7b6ef9b7e8d261b263992026bc`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge `4b0ac6156705753190f6bfe3f76123703dea1942` and created deploy `dep-dbifpn15efls739vj13g`. Deploy-started event `evt-dbifpn81ikfs738bebag` was accompanied by pipeline-minutes-exhausted event `evt-dbifpndpg34c7385s9g0` and failed deploy-ended event `evt-dbifpnc06tpc73dbmr3g`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not retry the unchanged database-administration path, broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production or publication.

All 24 live acceptance areas remain OPEN. In particular, this repair does not prove live dedicated database administration, durable live recovery, current grants, owner account records, official provider templates, independent human review, authorized marketplace submit/readback, real economics or financial reconciliation, measured 100/1,000-per-day capacity, end-to-end provider acceptance, or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
