# POD run receipt R386 — reject executable artifact read results

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `877b331b20e6ef38e9b7cf581014229b39ee5e48`; Money Factory started from `cd385bd775b54d7b6ef9b7e8d261b263992026bc`.
- No open POD/KDP pull request or duplicate R386 job existed. Older unrelated pull requests were left untouched.
- The current `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md` were read before implementation. All 24 live acceptance areas still required attributable deployment/provider evidence; code or fixture success was not treated as live acceptance.
- The unchanged database-administration failure path was not retried because no credible new access path was available.

## Confirmed defect and repair

`ArtifactStore.get` read a database adapter's result array and row through ordinary property access and returned the adapter-owned mutable Buffer directly. Accessor- or Proxy-backed result structures could therefore execute caller code inside artifact restoration, and accepted bytes were not privately snapshotted at this boundary.

Regression-only head `1e9ced82d9bc17ef52ea83ac7ed947210d2b98ad` reproduced the defect:

- focused local run: 35 tests, 34 passed, with only the new regression failing because the `rows` accessor executed;
- hosted integration run `41128494540`, job `124313058907`: 1,010 tests, 1,009 passed and only the new regression failed with `rows getter executed` instead of `ARTIFACT_ROW_UNVERIFIED`;
- the superseded expected-red container run `41128493702` was cancelled and is not counted as evidence.

Content Control PR #907 resolves the query result, row array, first entry, body and media type only through non-executable data descriptors. It rejects Proxy/accessor-backed results with the fixed `ARTIFACT_ROW_UNVERIFIED` diagnostic and privately snapshots accepted Buffer bytes before hashing and return.

Repaired exact head `7563d57cf4dafecaaf0698e6ed8b8ff1eeb1f823` passed:

- focused local artifact tests: 35/35;
- the first serialized full local run encountered one unrelated FIFO timeout under load; the isolated artifact-archive file immediately passed 55/55, including that FIFO case;
- a repeat serialized full local run: 1,010 total, 1,001 passed, nine environment skips, zero failures;
- integration run `41128726737`, job `124313855060`: 1,010/1,010 Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, syntax, workflow controls and four free-review guards;
- container run `41128726979`, job `124314319563`: production-image build, non-root/offline dependency check, 385 Python tests, 1,010/1,010 Node/PostgreSQL tests, real print/durable review E2E, and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #907 merged as `1556414b778f128a5c12a37276d3c97a7823e40f`. Post-merge System Wiring run `41129761594` and POD integration run `41129761651`, job `124317380386`, both passed.

## Money Factory authority pin

Money Factory PR #341 changed only the Content Control verification pin to the exact merge above. Exact pin head `332ef5e8a4a5c0cb05322cebf7fe6f49113e2ac6` passed cross-repository run `41129800883`, job `124317516550`: 653 Node contract tests; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #341 merged as `bb62848bed28adaf43f23acaaed9cab928db2034`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge `1556414b778f128a5c12a37276d3c97a7823e40f` and created deploy `dep-dbigi83m8hqs738ndk70`. Deploy-started event `evt-dbigi8fg4pms73a6ibmg` was accompanied by pipeline-minutes-exhausted event `evt-dbigi89ffr0s73cc5mkg` and failed deploy-ended event `evt-dbigi89ffr0s73cc5mm0`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not retry the unchanged database-administration path, broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production or publication.

All 24 live acceptance areas remain OPEN. This repair strengthens durable artifact recovery and security but does not prove live hosting, current grants, owner account records, authorized source intelligence, official provider templates, independent human review, authorized marketplace submit/readback, real economics or financial reconciliation, measured 100/1,000-per-day capacity, end-to-end provider acceptance, or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
