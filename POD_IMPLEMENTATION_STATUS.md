# POD/KDP implementation and acceptance status

This change extends server-lowmem.js and the existing capability registry. It does
not replace Content Control or enable publication. Runtime records use dedicated
PostgreSQL tables; cyzor_social_vault is never accessed by this lane.

| Stage | Implemented | Remaining acceptance requirement |
|---|---|---|
| 1 Durable storage | Transactional migrations, bounded content-addressed PostgreSQL artifacts, immutable evidence | Provision scoped runtime credentials, execute migration, restart/restore verification. 128 MiB default budget stops production when full. Large-scale storage is not provisioned. |
| 2 Money Factory integration | Exact bridge rules, signed scoped grants, upstream readiness adapter, idempotent event inbox/outbox | Mount inbox/grant adapters in deployed MF authority and verify full round trip. PRELAUNCH ceiling remains unchanged. |
| 3 Market collection | Authorized-source intake, JSON-LD extraction, reference geometry, signed observation ingestion | Authorize and validate each platform data source. No invented BSR, search volume or print dimensions. |
| 4 Rights screening | Country/category coverage checks, terminology matching, uncertainty tombstones, signed evidence | Supply current registry coverage and independently verified asset/font rights. This is screening, not automated legal clearance. |
| 5 Original generation | Deterministic geometric art generator, provenance, licensed-font composition | Validate commercially useful briefs and diversity; no AI provider configured. 100 concepts/day is a budget, not measured successful throughput. |
| 6 Templates | Signed template provenance, dimensions, native PPI, safe-zone checks, aspect-preserving placement | Import current official product templates and approve print proofs for each product. |
| 7 KDP books | Cover PDF, embedded-font text interiors, page count/text/size checks | Editorial review, supported official trim/gutter specs, cover/interior combined release manifest and actual KDP preview validation. |
| 8 QA | Exact OCR, hashes, geometry, DPI, collision checks, mandatory competitive evidence | Configure calibrated independent comparative reviewer; CLIP never proves superiority. No claim of 100% objective perfection. |
| 9 Orchestration | Atomic queue claims, leases, fencing, budgets, expiry recovery, bounded repair, awaited worker loop | Supply production task/grant/artifact resolvers, run worker on a durable always-on host and load-test 100/1,000 concepts/day. |
| 10 Publishing | Fail-closed executor, per-account quotas, dry-run isolation, ambiguous-outcome hold and observed-live reconciliation | Implement and verify authorized submit/readback adapter for each marketplace. None is enabled. No anti-bot evasion. |
| 11 Financial feedback | Immutable evidence-backed events, currency-separated totals, outbox/inbox | Connect actual provider statements and core MF verified ledger. Recorded net is not proven profit or cash balance. |
| 12 Mobile operations | Authenticated metrics and responsive dashboard, unavailable-state errors | Deploy and verify owner access on phone. Dashboard is read-only; operational mutation controls remain API-only. |

## Run and test

`npm run test:pod` runs Node unit/HTTP tests. The PostgreSQL test runs only when
POD_TEST_DATABASE_URL points to a disposable test database; never use production.
`npm run test:pod-python` exercises actual OCR, geometry and PDF rendering.
`.github/workflows/pod-integration.yml` supplies PostgreSQL 18 and Python 3.12,
matching the database version verified in the owner's Render workspace.
POD_DEPLOYMENT_READINESS.json records the inspected service/database configuration
and the blocked live-schema inspection. The earlier PostgreSQL 16 CI also passed.
The full model QA additionally requires requirements-free-qa.txt/lock dependencies.

Run `npm run pod:storage-init` as a separate deployment step with
DATABASE_MIGRATION_URL and DATABASE_RUNTIME_USER. The runtime role must already
exist and have login/connection permissions without superuser, role-management,
schema ownership or DDL grants. This migration grants access only to named POD
tables. Never place migration credentials in the web worker environment. It does
not revoke unrelated existing role grants; audit those independently.

Configure POD_DATABASE_URL (verified TLS), POD_STORAGE_EXPIRES_AT,
POD_BRIDGE_PATH, INTERNAL_OPERATIONS_KEY and distinct >=32-byte keys for
POD_UPSTREAM_KEY, POD_QA_KEY, POD_INTAKE_KEY, POD_FINANCE_KEY, POD_MARKET_KEY,
POD_PROVIDER_KEY. Python gates additionally use POD_REGISTRY_KEY,
POD_RIGHTS_KEY, POD_TEMPLATE_KEY, POD_REVIEW_KEY and POD_SOURCE_KEY.
Keep publication and production flags false until acceptance requirements pass.
Short-lived attestations must be refreshed against current authoritative evidence;
do not re-sign stale approvals simply to extend their lifetime.

Setting POD_SERVICE_ENABLED=true checks existing migration checksums; it never
auto-creates storage. A POD failure blocks this lane without killing unrelated
Content Control services. `/api/print/dashboard` loads the read-only dashboard;
all data endpoints require a bearer operations key. Keep that key off URLs/logs.

The free-tier-first package provides no always-on hosting guarantee. Queue
backpressure stops before storage/quota exhaustion. No paid resources, platform
accounts, marketplace listings or live revenue were created by this change.

## Follow-up: production/package integration

Production-only signed grants now permit internal PRELAUNCH generation without
publication permission; LAUNCH and submit still require publication permission.
The worker assembles a supplied, signed KDP interior specification and manuscript
into the cover manifest before independent review. The package hash binds both
PDFs and the interior receipt. KDP QA rejects missing/corrupt interiors. Generated
package files are written to the existing bounded ArtifactStore before queue
completion; no reliance on ephemeral Render files for completed packages.
Template safe boxes consistently use x/y/width/height in Node and Python.

Local verification: 39 Node tests passed across both repositories, one PostgreSQL
test skipped (no disposable database configured), and 18 Python tests passed,
including real PDF assembly and OCR. Synthetic test dimensions are not approved
marketplace templates. No live deployment or marketplace publication was tested.
The production resolver, authoritative MF runtime, current rights/editorial
review, database provisioning and platform adapters remain acceptance blockers.
KDP upload/Print Previewer and AI disclosure requirements must be satisfied through
its documented publishing flow:
https://kdp.amazon.com/en_US/help/topic/G200641240
https://kdp.amazon.com/en_US/help/topic/G200672390

## Runtime and cross-repository review lane

`initializePodService({production: {resolveTask, resolveGrant}})` now owns an awaited
production-only worker lifecycle. Missing authoritative resolvers block startup of
that worker; setting a flag alone does not fabricate readiness. Shutdown drains
in-flight work before closing the pool. No publisher is invoked by this lifecycle.
Production QA completion atomically emits an outbox event, with duplicate fenced
completion rejected. The public status endpoint distinguishes requested publication
from actual enabled capability.

`node scripts/pod_review_cli.mjs INPUT FONT OUTPUT` creates original procedural art,
cover/interior PDFs, supplied metadata, research notes and provenance using the
existing Python modules. The paired Money Factory `integrations/pod/production_agent.py`
invokes this fixed coordinator and checks every returned artifact hash. This is a
local/runner review lane; it returns REVIEW_REQUIRED, never marketplace-ready.
Manuscripts and metadata must be supplied; it does not invent authors, research,
rights clearances or editorial approvals. Output directories must be new.

CLIP is now explicitly optional (`pod_vision_qa.py --descriptive-similarity`); it is
descriptive and cannot replace the mandatory independently signed comparative
review. Standard QA no longer downloads a model merely to compute this extra score.
The fixture test demonstrates technical QA with test-only signed attestations,
not real editorial or rights approval.

The first follow-up passed PostgreSQL 18 CI without skips:
https://github.com/wecreates/content-control/actions/runs/38477814168
The live Render read-only database connector still failed TLS/connectivity during
the follow-up; no network allowlist was broadened and no production SQL was run.

## Core wiring repair: durable task inputs and review hold

The server now constructs concrete task resolvers from ArtifactStore. Production
jobs bind `task_sha256` in both the brief and the upstream approval/grant. The
referenced JSON descriptor has schema_version 1, a `files` map of basename to
artifact SHA256, and roles `source`, `template`, `textLayers`, `assetRights`, and
`reference` naming files in that map. KDP also has `interior` roles `template`,
`pages`, `font`. See tests/pod-production-e2e.mjs for a synthetic complete example.
Input files are restored to a bounded disposable directory; text-layer font paths
are relative to that directory, while signatures bind the original portable JSON.
Font blobs use font/ttf. All input bytes remain hash-verified in the durable store.

After generation the worker persists the output before entering REVIEW_REQUIRED.
This uses the existing qa_failed state plus reason_code, so no schema migration
is needed. It does not consume repeated attempts while waiting. Authenticated
GET /api/print/jobs/:id/package and GET /api/print/artifacts/:sha provide the exact
review inputs. POST /api/print/jobs/:id/review accepts only a current signed QA PASS
bound to that stored package/template; it never publishes. Reviewers reconstruct
the package from its file map and run the existing signed QA CLI with independent
rights/comparative evidence. POST /api/print/jobs/:id/retry uses the existing bounded
repair path with a fresh scoped grant. REVIEW_REQUIRED is not an automatic failure
or an automatic approval.

Startup now probes the actual Python dependencies and OCR executable before any
production queue claim. Missing dependencies report BLOCKED_PYTHON_RUNTIME. Install
requirements-pod-runtime.txt and tesseract-ocr on the authorized worker before
enabling production. Node-only deployment success does not prove Python readiness.
The service/database/publication flags remain disabled until live configuration
and approved evidence exist. This change does not create an upstream approval,
rights clearance, reviewer identity, marketplace adapter or database credential.


## Verified repair evidence — 2026-10-14

- PR #52 merged startup preflight enforcement and redacted production-worker
  heartbeat/failure health. Missing database isolation, migration checksums,
  verified TLS, bridge configuration, storage lifetime or required distinct keys
  blocks the POD lane. Optional POD failure does not terminate unrelated services.
  CI passed: https://github.com/wecreates/content-control/actions/runs/38575680901
- PR #53 merged an atomic rights recheck before independent QA acceptance.
  A concept that is no longer PASS or is permanently unpublished cannot enter
  qa_passed through a signed review. PostgreSQL 18 regression passed with the full
  integration gate:
  https://github.com/wecreates/content-control/actions/runs/38575814945
- Render reported deployment dep-db7okjunha3s73as3tug live at
  2026-10-14T13:59:32.279091Z for merge
  fa6330a30b5c56b8d072cb3d4b44b96251abdfda, containing both repairs.
  This verifies code deployment only. The read-only public status fetch was
  unavailable through the available retrieval tool; no authenticated POD runtime,
  database migration, production job, or marketplace acceptance is asserted.
- Money Factory PR #13 adds the bounded signed-event HTTP receiver around the
  existing transactional inbox. Local Node verification passed 12 tests; its
  cross-repository CI and merge status must be checked separately. Mounting it in
  the deployed authority remains outstanding.
  https://github.com/wecreates/Money-factory/pull/13

Production database administration was not retried because no changed authorized
connection path was established. No publication flag, readiness ceiling, rights
clearance, paid infrastructure, or marketplace permission was changed. The 24-area
completion registry remains open. Current runtime work is performed during active
authorized execution sessions; a continuously running self-hosted agent has not
been installed or verified.


## Continued verification — 2026-10-14, 14:46 UTC

- Money Factory PR #14 merged the real PostgreSQL 18 event-bridge recovery gate.
  The test invokes Content Control's actual outbox and Money Factory's actual
  HTTP receiver/inbox, with a local transport and disposable test schema.
  It verifies lost-acknowledgment recovery, eight concurrent duplicate deliveries,
  conflicting replay rejection, and database rejection without false delivery.
  CI passed: https://github.com/wecreates/Money-factory/actions/runs/38582761908
  This is test-environment evidence, not a live authority round trip.
- Content Control PR #56 closes the other QA readiness path: direct production
  completion now locks and verifies current concept rights before PASS, and the
  ready list excludes revoked/tombstoned concepts. PostgreSQL regression and the
  full integration gate passed:
  https://github.com/wecreates/content-control/actions/runs/38582954870
  Render reported commit 0da96757118abb9eea4490013b0e52aaf769e67d live in
  deployment dep-db7pah5bedkc738tsgn0 at 2026-10-14T14:45:24.910215Z.
- PR #57 repairs child-process cancellation and output limits. The runner waits
  for process close before task cleanup and escalates ignored SIGTERM to SIGKILL.
  Thirty focused local tests passed, including a real child that ignores SIGTERM.
  Full CI was still running at this checkpoint; consult its final result and PR
  merge state before treating this fix as deployed:
  https://github.com/wecreates/content-control/actions/runs/38583251828
  https://github.com/wecreates/content-control/pull/57

No production migration, owner credential provisioning, real rights approval,
authorized marketplace submission, financial reconciliation, or live capacity
benchmark was performed. Publication remains held. The 24 acceptance areas retain
their live-evidence requirements; these repairs do not waive them.


## Process-stage verification and merged-head gate — 2026-10-14

PR #57 passed the full Node/PostgreSQL/Python/OCR/PDF integration gate and merged:
https://github.com/wecreates/content-control/actions/runs/38583251828

PR #61 also passed and merged. It rejects PASS output left by a nonzero QA
process, and abort/timeout/output-limit/spawn errors no longer fall through to
reading a leftover QA file. Ordinary nonzero exits may retain only FAIL evidence;
the database still authenticates every persisted envelope:
https://github.com/wecreates/content-control/actions/runs/38583749928

Concurrent PR #58 added explicit default-off database-role provisioning tooling.
Its merge is not evidence of production credentials or connectivity. No live
database retry was made without a changed authorized connection path.

The POD integration workflow now also runs on relevant main-branch changes.
This checks combinations of concurrently merged work; PR-specific passing results
alone do not establish that the final combined head passes. Older runs on the same
PR/ref are cancelled when superseded. These gates use disposable PostgreSQL and
synthetic signed fixtures, never live publication or production credentials.


## Provider observation identity repair — 2026-10-14

A focused regression reproduced cross-job replay acceptance: the provider inbox
compared only evidence_sha256, so a different job reusing the same provider event
and evidence file could receive a false duplicate acknowledgment. Reconciliation
also failed to require a valid package hash before database access.

The receiver now requires explicit string identities and a SHA-256 package binding,
and compares the persisted job/account/platform/listing/event/package/proof scope
before acknowledging a replay. Fresh envelope timestamps remain permissible for
the same immutable observation. Five focused local tests pass after three failed
against the previous implementation. The existing PostgreSQL integration test now
checks a real transaction: conflicting replay leaves the second job submitted and
creates no additional publication event. Consult this change's CI for that result.

This is fixture-based correctness evidence only. No real marketplace observation,
provider credential, live database write, or publication was performed. The live
service inspected at the start of this pass was commit
a176c1e99d2045f62316c55b9c200cb53d8d23d1. Database provisioning remains unverified;
no unchanged blocked database access path was retried.


## Verified identity-binding gates — 2026-10-14, 15:20 UTC

- PR #64 passed the full PostgreSQL/Python integration gate and merged:
  https://github.com/wecreates/content-control/actions/runs/38587996687
  Render reported merge 226a0ff69974df6f72f8b3d0c042bed234657069 live in
  dep-db7pqp942hec739hjqj0 at 2026-10-14T15:20:16.567222Z.
- PR #65 fixes the same missing-binding failure in shared QA and release policy.
  Matching absent hashes can no longer satisfy either gate. Three regression
  cases reproduced the prior failure; the combined focused suite passed 8 tests.
  Full integration CI passed before merge:
  https://github.com/wecreates/content-control/actions/runs/38588206040
  Its deployment was building at this checkpoint; deployed acceptance is separate.
- The HTTP mount order was inspected: the POD router is mounted before other
  API routers and no global JSON parser consumes its raw artifact uploads.
  No upload-path change was necessary.

No live publication, production database administration, credentials, rights
clearance, revenue, or capacity acceptance was introduced. The 24-area registry
remains open. Existing known database access limitations were not retried without
a changed authorized path. Verification used available local tests and hosted CI,
not a claimed continuously running self-hosted worker.


## Offline market-source authorization repair — 2026-10-14

An eight-test reproduction found that --html bypassed the source policy entirely:
missing/denied authorization, substituted snapshot bytes and substituted source
URLs could still produce PASS intake evidence. Text-mode reading also normalized
CRLF, so source_sha256 did not identify the actual imported bytes.

Both live and offline intake now authenticate pod:source-policy and require an
approved HTTPS host before parsing. Offline imports additionally require the signed
policy's snapshot object to bind source_url and sha256 to the exact imported bytes.
Reads stop at 2 MiB plus one byte; hashes preserve original UTF-8/newline bytes.
Host allowlists must be arrays, not substring-matched strings. The signed intake
result records collection_authorized and a digest of the verified source policy.
No source permission is created by these fields; an actual authority must supply
current authorization. No marketplace is contacted by the regression suite.

Local Python 3.12 verification: 13 tests passed, including expired-policy rejection,
network-free online-contract checks and a real CLI process proving unauthorized
imports return exit 2 and sign only UNKNOWN/permanently-unpublished evidence.
The new suite is included in the existing POD integration gate. Hosted CI and
merged deployment remain separate verification steps.

At inspection, Render reported ac150167a06e94b340df0866e6700615d61adeee live in
dep-db7prr782drs73da7av0 (finished 2026-10-14T15:22:52.010942Z). Previous combined
POD main gate 38588431426 passed. No production database retry, platform access,
rights clearance, publication enablement or live acceptance was performed.

## Python evidence lifetime parity — 2026-10-14

The Python verifier accepted signed evidence with arbitrarily long validity,
unlike Node's existing 900,000 ms maximum. It also accepted boolean true as
schema version 1 and as an integer issue time. Six regression tests exposed four
failing assertions/subtests before the repair. Python now requires actual integer
schema/timestamp values and rejects validity spans greater than 15 minutes.
The exact 15-minute boundary remains valid; expired and future evidence still fail.

All 38 locally available Python POD tests passed, including actual OCR/PDF checks,
the 13 market-source tests and six evidence-lifetime tests. Hosted integration CI
must independently verify the durable PostgreSQL and cross-language paths.
This change does not refresh any approval: authorities must issue evidence from
current records; re-signing stale rights, templates or reviews remains prohibited.

## Verified source/evidence repairs — 2026-10-14, 16:30 UTC

- PR #67 passed the full integration gate and merged:
  https://github.com/wecreates/content-control/actions/runs/38597951292
  Its main-branch gate also passed (38598199644). Render reported
  4e20ff98c35a71a76adb7da9d57921259215da7b live in
  dep-db7qqpui0phs739g86dg at 2026-10-14T16:28:27.041247Z.
- PR #68 passed and merged:
  https://github.com/wecreates/content-control/actions/runs/38598216977
  Combined main-branch PostgreSQL/Python integration and System Wiring Audit
  both passed for d26876d4111cf04722d12bdc1bda68de732f4d6f:
  https://github.com/wecreates/content-control/actions/runs/38598432562
  https://github.com/wecreates/content-control/actions/runs/38598432544
- Render reported that combined commit live in dep-db7qri7avr4c73flv0k0,
  finished 2026-10-14T16:30:10.514613Z. This is code-deployment evidence only,
  not an authenticated POD runtime or actual production acceptance result.
- Local verification additionally passed eight Node identity-binding regressions,
  38 Python POD tests and syntax compilation of the changed Python files.

No publication flag, network allowlist, live credential or resource plan changed.
No production database administration was retried without a changed access path.
Money Factory head 63ba9b144066870b6613a431fb380decaef947dc and both repositories'
open PRs were inspected; no duplicate POD PR or unrelated video PR was merged.
The 24-area checklist remains open: code and synthetic CI cannot supply live
database isolation/recovery, current rights/account/source/template approvals,
authorized adapters, financial statements or measured production capacity.
Continue only from verified current heads and actual authorized evidence.

## Production template-provenance enforcement — 2026-10-14

The official-template validator existed but was not called by the production
worker. A signed yet unverified or wrong-scope template could reach generation
and the durable review hold. Eight of nine focused tests failed before repair.
The worker now checks template provenance before launching any Python stage,
including the KDP interior's separately signed pod:interior-template record.
Missing interiors fail before cover generation rather than after creating files.

Stored task descriptors now require templateScope: {product, country}. Product is
a nonempty identifier of at most 128 characters; country is an uppercase two-letter
code. Scope is bound by the existing task_sha256 in the Money Factory grant and
brief. The resolver copies it from the stored descriptor; platform comes from the
authorized job. Both cover and interior records must match that scope and attest
official_source_verified=true with a valid credential-free HTTPS source URL,
source SHA-256 and a non-future observation time. The existing bounded signed
evidence lifetime still applies. Python retains detailed geometry/font/page checks.

Legacy descriptors without scope now fail closed. Supply a new descriptor hash
and a fresh authoritative grant; do not mutate hash-addressed bytes, auto-fill
country/product, invent official provenance or re-sign stale evidence. Internal
rendering helpers and synthetic CI dimensions are not marketplace approvals.

Local verification passed 13 focused Node tests for pre-generation blocking,
scope validation, resolver restoration and preservation of QA process-failure
handling. The real PostgreSQL/Python test also now checks that rejected template
provenance/scope leaves a failed job with no manifest or additional output blobs;
its hosted CI result must be verified before claiming that integration passed.
Publication, database permissions, paid infrastructure and live acceptance are
unchanged. The existing 24-area checklist still requires actual provider evidence.

## Release-authority timing repair — 2026-10-14

Two synthetic adapter regressions demonstrated that publication could proceed
using a grant fetched before artifact checks even when that grant expired or the
authority revoked permission during those checks. The executor now completes
artifact verification first, checks cancellation, then requests and authenticates
the current scoped grant. Cancellation is forwarded to the grant resolver. QA,
release scope and local kill switches are checked without awaited work between
that fresh grant and adapter invocation. This narrows the local race; it does not
claim atomic revocation across independent external systems.

Four release-freshness tests failed before repair and pass afterward. The combined
focused Node suite passed 25 tests. Enabled flags appear only in isolated fake-
adapter tests; no live environment, external marketplace, listing or credential
was changed. Real release still requires an authorized adapter and explicit
publication approval, neither of which is supplied by this repair.

## Verified template/release integration — 2026-10-14, 16:42 UTC

- PR #70 passed and merged. Its hosted logs confirm 99 Node tests passed with
  zero skips, plus the real PostgreSQL/Python durable-production test including
  the rejected-template cases:
  https://github.com/wecreates/content-control/actions/runs/38599545277
  Render reported 9be06c36646c848afacf4cddd5cef7f6f101fa70 live in
  dep-db7qvte7bikc73ddi7pg at 2026-10-14T16:39:24.967812Z.
- PR #71 passed and merged. Hosted logs confirm 103 Node tests passed with zero
  skips, plus the durable-production test:
  https://github.com/wecreates/content-control/actions/runs/38599778450
  The combined main integration gate and wiring audit passed for
  5180c243198afb6dfb05ee8d2e14995d4e7b0750:
  https://github.com/wecreates/content-control/actions/runs/38599987943
  https://github.com/wecreates/content-control/actions/runs/38599988032
  Render reported that commit live in dep-db7r0lh42hec739jiusg, finished
  2026-10-14T16:41:11.656201Z. Deployment does not prove authenticated runtime or
  marketplace acceptance.
- Money Factory PR #15 documents the enforced descriptor/provenance contract and
  retains its existing task-hash authority boundary. Its cross-repository gate
  passed before merge:
  https://github.com/wecreates/Money-factory/actions/runs/38600098190
- Local verification also passed 25 focused Node tests, 38 Python POD tests and
  JavaScript syntax checks. Fixtures use synthetic permissions and fake adapters;
  they are not real official-template approvals, listings or financial evidence.

No production database access was retried, no network scope was expanded, and
no live credentials, rights approvals, resource plans or publication flags changed.
Database/recovery acceptance and actual authority/account/source/template/reviewer/
adapter/financial/capacity evidence remain open in the 24-area checklist. This work
uses available execution sessions and hosted CI, not a claimed always-on agent.

## Build quota diagnosis and prevention — 2026-10-14, 17:35 UTC

Render's build log for dep-db7rqe60tbcc73eqatqg explicitly reports exhausted
workspace build pipeline minutes, not a Docker/compiler failure. The two latest
automatic provenance-report commits and the earlier documentation merge #72
failed to deploy. The most recent successful deployment remains
dep-db7r0lh42hec739jiusg / 5180c243198afb6dfb05ee8d2e14995d4e7b0750.

A narrow report-only commit policy now supports the documented Render skip marker
for exact allowlisted evidence files. The provenance workflow uses that policy;
runtime/mixed/unknown changes do not acquire the marker. Four local tests pass,
including a real temporary Git repository, the actual workflow shell expression
and a runtime-to-report rename that must still deploy. GitHub CI remains enabled.
No live service setting, quota, billing plan or publication flag was changed.

This preventive repair cannot restore exhausted minutes. Do not claim subsequent
code merges are live until an actual deployment succeeds. No production database
retry was attempted; useful independent implementation and hosted verification
can continue without expanding network access or buying infrastructure.

## Duplicate-intake rights revocation — 2026-10-14

Three failing local regressions confirmed that fingerprint deduplication returned
an existing PASS concept without applying fresh FAIL/UNKNOWN evidence. It also
returned an existing concept ID across business boundaries. Intake now locks the
matched concept, rejects cross-business conflicts and atomically tombstones a
previously publishable concept on adverse evidence. One pod.concept.rights_blocked
outbox event records the evidence payload hash and scope. The existing Money
Factory inbox accepts this pod-prefixed observation without treating it as revenue.

Later PASS or different-denial retries cannot alter/revive a permanent tombstone;
retries do not consume the unique-concept budget or duplicate the denial event.
Five local regression tests pass. The PostgreSQL test now exercises four
concurrent denial retries, loss of ready-list/publish-claim eligibility, exact
budget/event counts and cross-business denial. Its CI outcome is separate from
local test evidence. Existing in-flight external submissions are not claimed to
be atomically cancelable by this transaction.

Render build quota is still exhausted, so merging this runtime repair is not
proof of deployment. Publication remains held; no live database operation or
rights clearance was performed.

## Verified rights repair and deployment hold — 2026-10-14, 17:46 UTC

- Report-only build policy PR #73 passed its integration gate and merged:
  https://github.com/wecreates/content-control/actions/runs/38608668182
  Its GitHub workflow change is active without requiring a Render application
  deployment. Only the exact allowlisted report paths receive [skip render];
  runtime changes still request deployment and GitHub CI is not skipped.
- Rights-revocation PR #74 passed and merged. Hosted logs confirm 112 Node
  tests passed with zero skips, plus the real PostgreSQL/Python durable test,
  including concurrent adverse re-intake and permanent-tombstone assertions:
  https://github.com/wecreates/content-control/actions/runs/38609015983
  Combined main integration and wiring gates passed for
  8808a873cf84be83018d046698acbdfec935a29b:
  https://github.com/wecreates/content-control/actions/runs/38609220950
  https://github.com/wecreates/content-control/actions/runs/38609220723
- That runtime repair is NOT deployed. Render attempt
  dep-db7ruvjm8hqs73f2i3c0 failed at 2026-10-14T17:44:31.779531Z.
  Its build log at 17:44:31.410259956Z explicitly reports exhausted workspace
  pipeline minutes. No manual retry, cache clear, plan or spending change was made.
  Last verified live deployment remains dep-db7r0lh42hec739jiusg,
  commit 5180c243198afb6dfb05ee8d2e14995d4e7b0750, finished
  2026-10-14T16:41:11.656201Z. Deployment is not live acceptance.
- Additional local verification passed 30 focused Node tests, 38 Python POD
  tests and JavaScript syntax checking. Local tests did not use production
  credentials or confer rights, account access, publication permission or revenue.

The free-minute reset date remains unverified through the available connector;
owner inspection of Render's workspace Build Pipeline settings is needed to
establish it. Do not purchase minutes or change spending limits under this task.
After free capacity is restored, verify an actual successful deployment before
claiming PR #74 is live. Do not repeatedly rebuild while quota remains exhausted.

All 24 live acceptance areas remain open. No production database administration
was retried without a changed access path. Publication flags, network scope,
credentials and resource plans were unchanged. Independent code/test work may
continue; the repository records session-bounded work, not an always-on worker.

## Market-observation evidence integrity — 2026-10-14

Seven of eight new local regression tests failed against the existing intake:
malformed rank proof was accepted, proof references need not exist, the rank
proof hash was discarded, and conflicting observations with the same identity
were silently reported as non-inserted. The repair validates/persists rank proof,
requires source/image/rank artifacts, returns the canonical ID for exact retries,
and rejects conflicts across scope, economics, rank, proof and observation JSON.

Additive migration 003 adds the rank-proof reference and immutable market rows.
Existing 001/002 checksums are unchanged; old missing evidence is not fabricated
or backfilled. Preflight blocks until all three migrations match. The migration
has NOT been applied to production. The API contract is documented in
integrations/pod/MARKET_EVIDENCE.md. Collection permission remains an independent
upstream requirement; stored references do not prove truth, demand or rights.

All 31 focused local Node tests pass after the repair, including the eight new
market tests and missing-migration preflight test. The PostgreSQL integration
test now exercises four concurrent identical imports, retained rank proof,
conflict rejection, missing evidence, append-only protection and repeat migration.
Hosted CI must independently verify that database behavior before merge.

Current heads and open PRs were inspected before work; unrelated video changes
were preserved. Render still reports failed builds and no new successful POD
deployment. No repeat database-access attempt, live credential, resource plan,
network rule or publication flag change was made. All 24 live acceptance areas
remain open; this code repair does not satisfy their real-world evidence needs.

## Final local publication eligibility — 2026-10-14

Four new regressions reproduced an external-side-effect risk in the executor:
after claiming a job, remote artifact/grant work could outlive the lease or
overlap an account suspension/rights tombstone, yet the adapter was still called.
The executor now requires a final database check after grant resolution. The
check binds job/account/platform/fencing token, publishing state, active account
and current non-tombstoned rights. It holds shared row locks only for the short
transaction and evaluates lease expiry using clock_timestamp after lock waits.

Grant and QA validity, cancellation and publication kill switches are checked
after that last awaited operation. Missing/false eligibility results fail closed.
No transaction or database lock is held across the external adapter call. This
narrows the local race; it does not promise atomic revocation across independent
systems. Provider idempotency/readback and ambiguous-outcome recovery remain
mandatory. Publication stays disabled in the real environment.

The four failing regressions now pass; an additional test verifies cancellation
and kill-switch changes during the final database wait. The PostgreSQL suite adds
actual lease expiry, fencing/scope mismatch, account disablement, ambiguous state
and permanent-rights denial checks. Hosted CI is required before merging these
database-path changes. No marketplace adapter, account or clearance is invented.

Market-evidence PR #76 passed and merged at
dd9eab9f469759bf233fd9ba906c3a823a3689dc. Its hosted logs confirm 121 Node tests
passed with zero skips and the real PostgreSQL/Python durable workflow passed:
https://github.com/wecreates/content-control/actions/runs/38622442650
That gate also exercised migration 003 and concurrent market observations in
disposable CI PostgreSQL, not the production database. Live deployment and the
24 acceptance areas remain unverified; no Render quota workaround was attempted.

## Verified market/release integration — 2026-10-14, 19:23 UTC

- Content Control PR #76 merged after its full integration gate passed; logs
  confirm 121 Node tests passed with zero skips plus the real PostgreSQL/Python
  durable workflow: https://github.com/wecreates/content-control/actions/runs/38622442650
- PR #77 merged as cdd659fdbce2ea8cf57d6f2ee94f357dddb8a883 after 126 Node tests
  passed with zero skips plus the durable workflow:
  https://github.com/wecreates/content-control/actions/runs/38622841774
  Combined main integration and System Wiring Audit both passed:
  https://github.com/wecreates/content-control/actions/runs/38623041412
  https://github.com/wecreates/content-control/actions/runs/38623041392
- Money Factory PR #16 aligns the bridge documentation with durable market
  proof and local release denials. Concurrent main work was preserved by
  refreshing its base to d46aa20fda4cdbc817454f12f8b9a0c1b277c52e. Its matching
  cross-repository gate passed before merge:
  https://github.com/wecreates/Money-factory/actions/runs/38623052071
- Additional local verification passed 62 focused Node tests, 38 Python POD
  tests and syntax checks on the changed runtime modules. New regression tests
  failed before the corresponding repairs. Hosted PostgreSQL used disposable
  fixtures, not the production database, credentials or actual platform accounts.

Deployment remains UNVERIFIED. The Render connector continued to report
dep-db7s8ip5efls73cs4od0 (8d2934dc3e9ea0a4acdf1d10eda2318b98529e76) as its
latest attempt, failed 2026-10-14T18:05:00.684148Z; its 18:05:00.400541473Z build
log explicitly reports exhausted build pipeline minutes. The connector did not
show a deployment for either newly merged runtime repair during this inspection.
Do not infer a successful or failed new deployment from the merge alone. Last
verified successful application deployment remains 5180c243198afb6dfb05ee8d2e14995d4e7b0750
in dep-db7r0lh42hec739jiusg at 2026-10-14T16:41:11.656201Z.

No manual deployment retries, network expansion, plan/spending changes, new live
credentials, production database attempt or publication enablement occurred.
The already-reported quota blocker is unchanged; no repeated owner notification
is needed. Production migration 003 is still pending authorized access. All 24
acceptance areas remain open for real deployment, rights/account/template/reviewer,
adapter, financial, recovery and measured-capacity evidence. Continue independent
authorized work from current heads; this is not a claim of continuous worker uptime.

## Financial authority identity protection — 2026-10-14

Three new regressions exposed a reconciliation integrity gap: financial events
were deduplicated only by provider/provider-event ID, so the same upstream event
could be counted again under a new provider identity. Non-string/blank identities
and future-dated occurrences were also accepted. Intake now requires both
provider and upstream identities to resolve to one exact immutable record.
Conflicts fail closed; exact retries emit no second outbox observation.

Additive migration 004 makes authority_event_id unique. Historical duplicates
fail migration for explicit ledger reconciliation; no financial history is
deleted, modified or assigned fabricated upstream IDs. Preflight requires all
four checksums. FINANCIAL_EVIDENCE.md defines line-level identity, compound
statements and the distinction between recorded net amounts and verified profit.

All 28 focused local Node tests pass, including the eight financial regressions
and missing-migration startup test. The PostgreSQL test adds concurrent exact
replays, conflicting reattributions, immutable totals/outbox counts and a temporary
historical-duplicate fixture that must reject migration 004. Its hosted CI outcome
must be verified before merge; production migration/deployment is not established.
No production database retry, network change, credential, paid resource, live
financial event or publication permission was introduced. All 24 live gates remain
open; the already-reported deployment quota blocker has not changed.

The first hosted financial gate (38624046354) correctly failed: PostgreSQL returns
timestamps as Date objects, and Date.parse(Date) discarded milliseconds during
exact replay comparison. A new local millisecond fixture reproduced the failure.
Comparison now uses the Date object's epoch milliseconds without string coercion;
the fixture passes. That failed revision was not merged. A fresh hosted gate must
verify the corrected commit and real concurrent financial tests before merge.

## Verified financial replay repair — 2026-10-14

Content Control PR #79 passed on corrected head
41b0c628242cfcd4860704a83ea758209c214d38 and merged as
dbf3821e4cc5e25581ebbe5849dbfe0288d9f0ab. Hosted logs confirm 135 Node tests
passed with zero failures/skips, including actual PostgreSQL financial contention,
exact millisecond retries, immutable totals/outbox counts and rejection of a
temporary historical duplicate set. The real PostgreSQL/Python durable workflow
also passed: https://github.com/wecreates/content-control/actions/runs/38624332851

Money Factory PR #17 passed its cross-repository gate and merged as
ea9f44451fe1a1bff34bd89de826776c70b3d755. It documents the authoritative line-ID
contract without mounting a live authority or inventing ledger entries:
https://github.com/wecreates/Money-factory/actions/runs/38624195363
Additional local checks passed 71 focused Node tests, 38 Python POD tests and
JavaScript syntax checks. The initially failed hosted run remains recorded above;
it was investigated and fixed, not hidden or merged as passing.

Render's individual-deployment read still reported
dep-db7r0lh42hec739jiusg / 5180c243198afb6dfb05ee8d2e14995d4e7b0750 as live.
No deployment of the financial repair was verified. The deployment list continued
to show the 18:05 UTC failed attempt as its latest entry. The known free-build
quota and production-database access blockers are unchanged. Migration 004 has
only been executed in disposable CI; no production migration attempt was made.

Publication flags remain disabled, with no new live credentials, network access,
spending changes, financial claims or fabricated approvals. The 24-area checklist
remains open. Follow the protected migration instructions only with real authorized
access and resolve any genuine duplicate authority events through the upstream
ledger process; never delete/relabel history to obtain a passing migration.

Combined main integration and System Wiring Audit passed for dbf3821e:
https://github.com/wecreates/content-control/actions/runs/38624555415
https://github.com/wecreates/content-control/actions/runs/38624555748
These are repository/CI results, not a production runtime or financial acceptance.

