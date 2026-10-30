# POD run receipt R387 — reject executable artifact query results

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `445bf60b228880eddbb4e38b4f542524710576f2`; Money Factory started from current main `20c4860d5872a3f54a7c4ce32c5176f884a964cb`, including an unrelated monitor cadence tick that was preserved.
- No open POD/KDP pull request or duplicate R387 job existed. Older unrelated pull requests were left untouched.
- The current `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md` were read before implementation. All 24 live acceptance areas still required attributable deployment/provider evidence; code or fixture success was not treated as live acceptance.
- The unchanged database-administration failure path was not retried because no credible new access path was available.

## Confirmed defect and repair

`ArtifactStore.putMany` read immutable-row lookup and storage-usage database results through ordinary property access and iteration. Accessor- or Proxy-backed query results could therefore execute adapter code inside the artifact transaction before insertion.

Regression-only local commit `7c0cc103ccf58f871bfae5c4e8b3e1b66d581312` and remote regression head `83321c1f779c4a1aebf800c36d706d844028421d` reproduced the defect:

- focused local run: 36 tests, 35 passed, with only the new regression failing because the lookup `rows` getter executed;
- hosted integration run `41137733486`, job `124344229395`: 1,011 tests, 1,010 passed and only the new regression failed with the same trace;
- superseded expected-red container run `41137733444`, job `124344229260`, was cancelled during Python tests and is not counted as acceptance evidence.

Content Control PR #909 added a bounded descriptor-safe snapshot for query result arrays, each row and required fields. It rejects Proxy/accessor/sparse/oversized/wrong-cardinality structures with `ARTIFACT_QUERY_UNVERIFIED` and validates the canonical nonnegative usage counter before `BigInt` budget arithmetic.

Repaired local commit `e888087f736d77fc0a8ff29cad9877fe82656936` and remote exact head `7bc3681010929eadde39b03ee86435cb5bf44439` passed:

- focused local artifact tests: 36/36;
- serialized full local run: 1,011 total, 1,002 passed, nine environment skips, zero failures;
- integration run `41137900741`, job `124344780426`: 1,011/1,011 Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, syntax, workflow controls and four free-review guards;
- container run `41137900768`, job `124345277207`: production-image build, non-root/offline dependency check, 385 Python tests, 1,011/1,011 Node/PostgreSQL tests, real print/durable review E2E, and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #909 merged as `de740a8ffa764ecf7f7318d8be7caf2d8454aa52`. Post-merge System Wiring run `41138803982` passed. Post-merge POD integration run `41138803999`, job `124347753772`, passed 1,011/1,011 Node/PostgreSQL tests, 385 Python tests, production E2E, workflow controls and four guards with both publication flags false.

## Money Factory authority pin

Money Factory PR #342 changed only the Content Control verification pin, starting from current main so the unrelated monitor tick remained intact. Exact pin head `d997234284f391a797eafda5dde7ff26d3c78b64` passed cross-repository run `41138839499`, job `124347869249`: 654 Node contract tests; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #342 merged as `467e7b84a354ba5b455a3dfd81b02d242d8ae338`, and Money Factory main pins Content Control exactly to `de740a8ffa764ecf7f7318d8be7caf2d8454aa52`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge `de740a8ffa764ecf7f7318d8be7caf2d8454aa52` and created deploy `dep-dbihlvp5efls739it5q0`. Deploy-started event `evt-dbihlvp38ooc73dkk140` was followed by pipeline-minutes-exhausted event `evt-dbihlvp38ooc73dkk15g` and failed deploy-ended event `evt-dbihm0179ius7390p4sg`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not retry the unchanged database-administration path, broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production or publication.

All 24 live acceptance areas remain OPEN. This repair strengthens durable artifact storage/recovery and security but does not prove live hosting, current grants, owner account records, authorized source intelligence, official provider templates, independent human review, authorized marketplace submit/readback, real economics or financial reconciliation, measured 100/1,000-per-day capacity, end-to-end provider acceptance, or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
