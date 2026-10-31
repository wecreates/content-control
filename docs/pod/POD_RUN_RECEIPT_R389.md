# POD run receipt R389 — reject executable stored-evidence query results

Date: 2026-10-30 UTC

## Reconstructed state

- Content Control started from `6f3694337edc447377e579c9eea88af0b58a7648`; Money Factory started from `f8d61d22dac2601a56c4c5f8d33370aae6ae1643`.
- Three concurrent Content Control commits after R388 updated only runtime-security audit, zero-credit QA proof and accepted-candidate ledger state. They were preserved in the exact R389 base. No open POD/KDP pull request or duplicate R389 job existed, and the scheduled workspace's untracked dependency/cache directories were preserved.
- The current `POD_COMPLETION_CHECKLIST.md`, `POD_IMPLEMENTATION_STATUS.md` and `POD_FREE_DEPLOYMENT.md`, recent workflow results, Money Factory pin and authorized Render service were inspected before implementation. All 24 live acceptance areas still required attributable deployment/provider evidence; code and fixture results were not treated as live acceptance.
- The unchanged database-administration failure path was not retried because no credible changed access path was available.

## Confirmed defect and repair

The shared `assertStoredEvidence` verifier dereferenced the database adapter's result `rows`, result-array entries and evidence fields directly before financial or provider-listing mutation. Accessor- or Proxy-backed query results could therefore execute adapter code before immutable evidence decisions and downstream writes.

Regression-only local commit `47f324ac4a57746a0cc3f837fa2b97b1f9792e23` and remote head `18f963c94e9ba58461a501b703080c77b9d9369a` reproduced the defect:

- focused local run: 14 tests, 13 passed, with only the new regression failing because the `rows` getter executed;
- hosted integration run `41146073130`, job `124371369768`: 1,013 tests, 1,012 passed and only the new regression failed with the same getter trace;
- superseded expected-red container run `41146073169`, job `124371369939`, was cancelled during Python tests and is not counted as acceptance evidence.

Content Control PR #913 added a bounded descriptor-safe snapshot for at most the requested evidence-hash count. It requires dense array entries, ordinary or null-prototype rows and exactly the three selected enumerable data fields (`sha256`, `media_type`, `body_sha256`). Proxy, accessor, sparse, oversized or unexpected-field structures fail with `EVIDENCE_QUERY_UNVERIFIED` before financial/listing mutation. Accepted rows are copied into private frozen records before validation.

Repaired local commit `02c34376b4fe208f0eee1642b4cab8b90ddebc79` and remote exact head `78216d887910aa8af1a75f303fa01bea58064816` passed:

- focused financial/listing/stored-evidence suites: 28/28;
- serialized full local POD run: 1,013 total, 1,004 passed, nine environment skips and zero failures;
- local Python/OpenCV/PDF run: 385/385;
- integration run `41146221641`, job `124371838232`: 1,013/1,013 Node/PostgreSQL tests, 385 Python tests, stored-task production E2E, syntax, workflow controls and four free-review guards;
- container run `41146221564`, job `124372235750`: production-image build, non-root/offline dependency check, 385 Python tests, 1,013/1,013 Node/PostgreSQL tests, real print/durable-review E2E and startup smoke reporting `publication_enabled=false`, `production_status=DISABLED` and `outbox_status=DISABLED`.

PR #913 merged as `afe31ba8f5d9d6cc18af97dd326272ceed0e56cb`. Post-merge System Wiring run `41147036665` passed. Post-merge POD integration run `41147036757`, job `124374435988`, passed all stages with both publication flags false.

## Money Factory authority pin

Money Factory PR #344 changed only the Content Control verification pin. Exact pin head `781ca75bb03ff08ca27c835a1410732d4219d480` passed cross-repository run `41147055959`, job `124374497881`: 655 Node contract tests; Python groups of 34, 23, 40, 28, 28, 93, 5, 6 and 23 tests; 121 authority/bridge Node tests; and 81 adapter Python tests. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` remained literal `false`. PR #344 merged as `f52bc6179516d8057ab1d5df54ce622e080496dd`, and Money Factory main pins Content Control exactly to `afe31ba8f5d9d6cc18af97dd326272ceed0e56cb`.

## Hosted observation and remaining acceptance

Render auto-deploy detected functional merge `afe31ba8f5d9d6cc18af97dd326272ceed0e56cb` and created deploy `dep-dbiirjjm8hqs73eterkg`. Deploy-started event `evt-dbiirk92tl4s73dtqu60` was followed by pipeline-minutes-exhausted event `evt-dbiirka9249c73ftsnl0` and failed deploy-ended event `evt-dbiirklh3lcs73fqlru0`. The attempt stopped before build or startup, so it is not live deployment acceptance. No manual retry was triggered because the free pipeline limit is unchanged.

This scheduled run used only its actually available local runner and authorized GitHub/Render connectors. It did not operate or claim a continuously running self-hosted worker. It did not retry the unchanged database-administration path, broaden network access, use marketplace credentials, contact providers, create paid resources, access social-vault data, include Etsy, or enable production or publication.

All 24 live acceptance areas remain OPEN. This repair strengthens financial reconciliation, provider readback, immutable evidence handling and security, but it does not prove live hosting, current grants, owner account records, authorized source intelligence, official provider templates, independent human review, authorized marketplace submit/readback, real economics or provider statements, measured 100/1,000-per-day capacity, end-to-end provider acceptance, or controlled launch. Publication remains held for explicit owner approval only after every live criterion is verifiably complete.
