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

## Encrypted artifact recovery implementation — 2026-10-14

Added a bounded manual AES-256-GCM artifact-library export/restore path using
the existing PostgreSQL artifact store and native Node cryptography. A read-only
repeatable snapshot exports exact hashes, encrypted objects and a catalog written
last. Restore authenticates every object, enforces budget/type/hash boundaries,
preserves immutable existing bytes and rolls back the entire transaction on any
failure. Both publication flags must be explicitly false; CLI restore additionally
requires target confirmation and the full restricted-role/TLS/schema preflight.

Seven local tests cover exact round trips, retries, permissions, late corruption
rollback, wrong keys, truncation/symlinks, no overwrite, cancellation, budgets and
CLI fail-closed configuration. A hosted PostgreSQL drill now creates two isolated
disposable databases, uses restricted artifact roles, verifies rollback and
reconnect persistence, and confirms no account or queue is restored. Its hosted
CI result must be checked before merging. No production access was attempted.

This is artifacts-only recovery, not a complete database backup or completed area
2. Queue/ledger recovery, independent durable retention, actual production export
and restoration, real key custody, storage expiry resolution and measured capacity
remain open. No archive is uploaded, retention provider chosen, credential invented,
publication enabled or paid resource created. See ARTIFACT_RECOVERY.md for the
manual contract and precise remaining acceptance evidence.

## Verified artifact recovery integration — 2026-10-14

PR #81 passed and merged as e2dc3bccafc373704c6ec3550a5eb98e8c0a5a53.
Its hosted logs confirm 143 Node tests passed with zero failures/skips, including
the two-database restricted-role recovery drill. The PostgreSQL/Python durable
production workflow also passed:
https://github.com/wecreates/content-control/actions/runs/38625816846
Additional local verification passed 42 focused Node tests, 38 Python POD tests
and syntax checks. No production database access, archive export, key creation,
retention upload or platform action was performed by these synthetic drills.

The Render deployment detail still reported 5180c243198afb6dfb05ee8d2e14995d4e7b0750
as live in dep-db7r0lh42hec739jiusg. Deployment of the recovery change is not
verified. The known quota/access limitations remain unchanged. All 24 live
acceptance areas remain open; full queue/ledger backup, real independent artifact
retention and production restoration have not been replaced with a passing unit
test. Publication remains held, and no spending/network/credential changes occurred.

Combined main POD integration and System Wiring Audit passed for e2dc3bcc:
https://github.com/wecreates/content-control/actions/runs/38626107567
https://github.com/wecreates/content-control/actions/runs/38626107542
This verifies the merged code in CI, not a new live deployment or completion of
the 24-area checklist.


## Outbox microsecond pagination repair — 2026-10-14

A new regression reproduced lost cursor precision: pg returns timestamptz as a
JavaScript Date, truncating microseconds. A full rejected batch could therefore be
selected repeatedly, starving later Money Factory feedback despite pagination.
The query now retains exact PostgreSQL timestamp text solely for its cursor;
signed event payloads and receiver deduplication identities remain unchanged.

All eight focused local outbox tests pass after the fix; the new precision test
failed beforehand. The existing real PostgreSQL integration suite now exercises
45 events, 20 persistent rejections, subsequent successful pages, exact ordering
and retry wraparound. Hosted CI must verify this database regression before merge.
No new dependency, migration, external request, production credential or network
change is introduced by the repair. Publication remains held disabled.

At this inspection, protected database deployment run 38627827260 was waiting;
no approval or duplicate dispatch was attempted. Render listed deployment
 dep-db7tsqslt5cc73e1054g for c9c3b09433ac8b6967bd9cd9be92faaad26a1189 as queued.
A queued deployment is not a successful rollout or evidence of restored build
quota. Production database and all 24 live acceptance areas remain unverified.


## Verified outbox pagination integration — 2026-10-14

PR #88 merged as 419a1e544206adf8aae92df692fd0de0825927b2 after its full gate
passed on 854c882885624692892c20006b2efb6646138941. Hosted logs verify 145 Node
tests passed with zero failures/skips, including the actual PostgreSQL 45-event
pagination fixture, plus 42 Python POD tests and the PostgreSQL/Python durable
production workflow:
https://github.com/wecreates/content-control/actions/runs/38638831168
Combined-main integration and System Wiring Audit also passed:
https://github.com/wecreates/content-control/actions/runs/38638995691
https://github.com/wecreates/content-control/actions/runs/38638995743

Eight focused local outbox tests and 12 current Money Factory HTTP/authority/grant
tests passed. The precision regression failed before the repair. Money Factory's
121d7ddecda71dec5c386b89ce6905d4c440cd23 bridge and inbox were inspected; no receiver
contract change is needed. These are synthetic test results, not a deployed
cross-repository round trip, approved marketplace interaction or verified profit.

Render still reports dep-db7r0lh42hec739jiusg / 5180c243198afb6dfb05ee8d2e14995d4e7b0750
as live. The c9c3b094 deployment remains queued in dep-db7tsqslt5cc73e1054g;
no deployment of PR #88 was verified. The public status URL could not be read
through the available lookup tool, so live endpoint/flag state was not independently
reverified. No runtime setting was changed, and publication must remain disabled.
The protected database workflow remains waiting; no duplicate dispatch, approval,
production database access or network widening was attempted. Its optional temporary
network-window path is outside this run's no-network-expansion authorization.

All 24 live acceptance areas remain open. Existing code and these CI results do
not replace production migration/recovery, live Money Factory mounting, authorized
accounts/sources/rights/templates/reviewers/adapters, actual financial statements,
measured capacity or controlled-launch acceptance. No paid resource, new credential,
archive key, claimed revenue or publication was created. This records bounded
repository work, not a continuously running self-hosted worker.

## Provider listing identity and repeat observations — 2026-10-14

Two new local regressions failed before repair: a fresh readback event for an
already published job produced another publication transition, and oversized
provider IDs reached database processing. Reconciliation now retains new readback
proof without repeating the transition, and bounds signed identities. Migration
005 makes provider listing identity unique within platform/account so changing
an event ID cannot attribute one listing to a second job. Existing duplicate
assignments fail migration; historical records are never deleted or relabeled.
Preflight now requires all five original checksums. Production DDL was not run.

All 18 focused reconciliation/preflight tests pass. Hosted PostgreSQL tests add
concurrent readbacks, cross-job attribution conflicts with inbox rollback, a race
for one listing, independent account namespaces, and historical migration conflicts.
Their hosted result must pass before merge. LISTING_EVIDENCE.md defines the contract.
These tests use synthetic evidence and do not create marketplace listings.

The latest Render deployment dep-db7tsqslt5cc73e1054g attempted merge 419a1e544206adf8aae92df692fd0de0825927b2
and failed at 2026-10-14T21:36:56.101505Z. Its log at 21:34:55.112621Z explicitly
reports exhausted workspace build pipeline minutes. The prior queued state is
superseded by this failed attempt, not a successful rollout. No manual retry,
plan/spend change, credential operation, database retry or network expansion was
performed. The known quota blocker does not require a repeated owner notification.
All 24 live acceptance areas remain open and publication stays disabled.


## Verified listing identity integration — 2026-10-14

PR #90 passed on c32f3db325390322317ba0b3d503af383eae9d72 and merged as
593a094a4dc2f0d47fdf2f3bbb3507c23a46494d. Hosted logs confirm 148 Node tests
passed, zero failures/skips, including concurrent observations, one listing per
account/job, atomic inbox rollback, independent account namespaces and refusal
to migrate historical duplicate listing assignments. All 42 Python POD tests
and the real PostgreSQL/Python durable production workflow also passed:
https://github.com/wecreates/content-control/actions/runs/38646322404
Combined main integration and wiring passed:
https://github.com/wecreates/content-control/actions/runs/38646555308
https://github.com/wecreates/content-control/actions/runs/38646555530
Local focused checks passed 26 tests and JavaScript syntax validation. Two new
regressions failed before the corresponding repair. Fixtures are not live accounts,
provider permissions, verified listings, production migration or financial evidence.

Concurrent main commit b643fb4e5aa76fc8201c3fd80481aa4678aa7f75 changed only the
live deployment health report to FAIL. It was inspected and preserved during merge,
not overwritten with a synthetic PASS. This report does not identify a runtime
root cause by itself; the inspected app error-log interval returned no entries.

Render attempted the merged repair in dep-db7vuo4s728c73fhoog0 and failed at
2026-10-14T22:17:05.091221Z. Its 22:17:04.892584637Z log explicitly confirms
exhausted workspace build pipeline minutes. PR #90 is NOT verified deployed.
The individual deployment read still reports 5180c243198afb6dfb05ee8d2e14995d4e7b0750
as live in dep-db7r0lh42hec739jiusg. No manual retry, plan/spend change, live database
operation, network expansion, credential creation or publication enablement occurred.

Protected database workflow 38627827260 remains waiting on the older
7d45ff10c90a53721be0a1926eaffb52c7734c3f revision. That revision predates migration
005 and cannot establish current schema readiness. When existing access and
required approvals are actually available, the migration must use the current
reviewed revision and all five checksums. No duplicate workflow was dispatched
and the optional network-expansion path was not used. All 24 live acceptance
areas remain open; this record does not claim continuous unattended execution.

## Production lease expiry after database waits — 2026-10-15

Resumed the unfinished local production-lease repair after checking current heads
and open PRs. Failure writes had no expiry check; review holds and completion used
PostgreSQL now(), fixed at transaction start. A lock wait could therefore allow a
late worker to overwrite queue state after its lease expired. All three paths now
lock the current processing row and fencing token, check clock_timestamp in a
separate statement after the lock, and check wall time again in the final update.
Completion still holds current rights through the successful readiness transition.
No migration, lease renewal, publication permission or new dependency is added.

Six focused local lease tests pass after the repair; the new rejection/order
checks failed against the original code. The PostgreSQL suite adds four controlled
row-lock/expiry cases: failure, review hold, passing QA and failing QA. Each must
reject the late write, preserve state/manifest/fencing and emit no event; recovery
then blocks the job and rejects the stale worker again. Hosted CI must validate
these real database tests before merge. Synthetic fixtures are not live acceptance.

Current Render service remains the existing free Docker service; latest listed
deployment dep-db808v942hec73bp3ubg failed on ef49076f1af7590f579d31f1f13dd8b59ecdf0f6.
No database access was retried, no network/spend/credential settings were changed,
and both publication flags remain held disabled. All 24 live gates remain open.

Initial PR #92 CI run 38692199039 passed all 154 Node tests (zero skips) and
42 Python tests, including the four real PostgreSQL lease barriers. The subsequent
durable end-to-end step failed its zero-incidents assertion because those deliberate
expired-lease fixtures left four blocked jobs in the shared disposable database.
The fixture now deletes only its own UUID job after verifying recovery and stale
worker rejection. The end-to-end incident assertion is unchanged. Full corrected
CI remains required before merge; this initial run is recorded as failed.

Corrected PR #92 head 2b474ac4192c58bf16ec541aec221c0c2b8ae124 passed
https://github.com/wecreates/content-control/actions/runs/38692725008
(job 116282140568): 154 Node tests, zero skipped; 42 POD Python tests; the real
PostgreSQL/Python durable review workflow; and three free-review guard tests.
Merged as fb3cf86e0cde856aba6f2d2dcfd3c7999610ebb4 after verifying the unchanged
main/head. Merged-main integration run 38692881464 and wiring run 38692881284
also passed. Money Factory remained d22df316830f37ff2029b96b3b28199f7cd8cde9.

Render attempted fb3cf86 in dep-db876acs728c73fokdeg and failed at
2026-10-15T06:31:06.124764Z. Its 06:31:05.944466933Z log explicitly reports
exhausted workspace build pipeline minutes. No manual rebuild or settings change
was made; PR #92 is merged/tested, not verified deployed. All live gates stay open.

## Signed QA expiry at readiness transitions — 2026-10-15

The follow-on audit reproduced five cases where acceptReview or completeProduction
accepted a signed QA envelope that expired during connection or rights-row waits.
Three unexpired control cases passed. Both methods now reverify the envelope after
their database waits, immediately before the state update; passing completion also
rechecks the package-bound QA result. An expired envelope rolls back without a
queue change or readiness event. No approval is renewed or synthesized.

All eight local QA-expiry tests and six production-lease tests pass. The PostgreSQL
suite additionally holds the actual concept rights row, confirms the worker is
blocked using pg_blocking_pids, advances the application clock to the signed expiry,
then releases the lock and verifies unchanged state and no event. These two cases
clean up their own synthetic jobs. Full hosted integration validation is required
before merge. Production credentials, migrations and publication remain untouched.

PR #93 head 46d557118013951c9016d17679349377f6bf0bb5 passed
https://github.com/wecreates/content-control/actions/runs/38693182715
(job 116283592028): 162 Node tests, zero failed/skipped; 42 POD Python tests;
the durable PostgreSQL/Python review workflow; and three free-review guard tests.
The real rights-row barrier cases passed alongside the lease-expiry barriers.
Merged as 9e453ab3b3a35650b259b6bad1da5d42b63b1108 after checking current heads.
Merged-main integration run 38693359892 and wiring run 38693359671 both passed.

Render deployment dep-db878hh42hec73bvr330 of that merge failed at
2026-10-15T06:35:51.903655Z; its 06:35:51.564348767Z log confirms exhausted
workspace build pipeline minutes. The individual deployment record for
dep-db7r0lh42hec739jiusg still reports 5180c243198afb6dfb05ee8d2e14995d4e7b0750
as live. Neither PR #92 nor #93 is verified deployed. No manual rebuild, purchase,
plan change, network expansion, secret creation or publication enablement occurred.

The protected database workflow 38627827260 remains waiting at older revision
7d45ff10c90a53721be0a1926eaffb52c7734c3f, which predates migration 005. There is
no new authorized database access path, so the failed connector/browser route was
not repeated and no duplicate deployment job was dispatched. Production database
preflight, durable recovery, live Money Factory authority, real account/evidence/
template/reviewer/adapter configuration, measured capacity and all other live
acceptance remain outstanding. All 24 checklist rows remain open. Test execution
in this run does not demonstrate a continuously running production worker.


Money Factory PR #19 documents the corresponding downstream lease/QA obligations
without changing bridge fields, readiness or ledger state. Its hosted cross-repo
run https://github.com/wecreates/Money-factory/actions/runs/38693475151 passed
13 Node authority/inbox tests (zero skips) and two Python production-agent tests.
Merged as ffa9efe28bf86be630cc788649159567ea111198 after verifying unchanged heads.
This is compatibility evidence, not a mounted live authority or verified profit.

## Upstream authorization expiry and repair rights — 2026-10-15

Fresh inspection found no overlapping POD PRs. Content Control main was
69f548c1b91fbcd373449eab38cae3147b21cdc1 and Money Factory main was
ffa9efe28bf86be630cc788649159567ea111198. PR #93 merged-main integration and
wiring remained passing. The latest Render attempt was still the failed
dep-db878hh42hec73bvr330; no changed database access path was observed.

New local regressions reproduced ten expired-authorization cases in registerIntake,
enqueue and requeueRepair after connection/database waits. Intake could commit a
new concept/budget or adverse duplicate evidence using an expired signature;
enqueue and repair could persist expired grants. These paths now revalidate their
original signed envelope after all database statements, before returning to commit.
Expiry aborts the transaction, including concept budget, queue and outbox changes.
The duplicate-intake return also checks freshness instead of bypassing validation.

Repair now takes a shared lock on concept rights along with the queue row, so
concurrent rights revocation is evaluated before requeue and rights stay locked
through the transition. This does not renew grants, revive tombstones or override
the Money Factory readiness ceiling. No schema or bridge-contract change is added.

All 15 new focused tests and the 14 existing lease/QA-expiry tests pass locally.
The new PostgreSQL helper exercises five expiry barriers plus concurrent repair
rights revocation. It checks actual database blocking, unchanged persisted queue/
rights, no concept-budget consumption and no emitted event, then removes only
its own synthetic fixtures. Full hosted integration remains required before merge;
local JavaScript execution is not proof of PostgreSQL or production acceptance.

All 24 live acceptance gates remain open. Publication flags stay false, and no
production database administration, credentials, paid resource, network change or
platform submission is introduced.

PR #95 head 8218f282ecb465a94af02ff0bb92ed23ab038e18 passed
https://github.com/wecreates/content-control/actions/runs/38694726760
(job 116288516786): 177 Node tests with zero failures/skips, 42 POD Python tests,
the durable PostgreSQL/Python workflow and three free-review guard tests. The six
new database barrier cases passed. Merged as b541c3c45f4968dd1647989fb52c0587399f4f9b.
Merged-main integration 38694903920 and wiring 38694903867 also passed.

Render deployment dep-db87fk6k1f9s73e7gfcg failed at 2026-10-15T06:50:56.805347Z.
Its 06:50:56.606633153Z log again explicitly reports exhausted build minutes.
PR #95 is tested and merged, not verified deployed. No manual retry or access/
resource changes were made.

## Signed evidence freshness through final database writes — 2026-10-15

The continued audit reproduced seven expired-envelope paths in market observations,
financial evidence and listing readback (including exact replay and already-published
observations). These handlers now reverify the signed envelope after their final
database statement before returning to commit. Existing immutable identity, proof
and replay-conflict rules remain unchanged. A historical observation can still be
submitted in a current envelope from its actual authority; no timestamps or signatures
are renewed locally.

Review acceptance and production completion also recheck QA after writing their
outbox event. Three further regression cases showed why the earlier check immediately
before the state update was insufficient if a later database statement took time.
Expiry rolls back the full transition rather than leaving a readiness event committed.

All 47 focused local tests passed after the fix, including the 25 evidence/QA-expiry
cases and existing authority/reconciliation tests. The disposable PostgreSQL helper
advances only the test application clock after actual SQL writes, then checks rollback
of the queue, market/financial rows, provider inbox and outbox in six cases. This is
controlled expiry testing, not a production traffic/capacity measurement. Hosted CI
must pass before merge. All 24 live acceptance gates and publication holds remain.

PR #96 head ca65bbacb059c5fd983bca955a7c1605efb681d9 passed
https://github.com/wecreates/content-control/actions/runs/38695345427
(job 116290492737): 194 Node tests, zero failures/skips; 42 POD Python tests;
the durable PostgreSQL/Python review workflow; and three free-review guard tests.
All six actual-SQL rollback cases passed. Merged as
790e32805d66caf8de360e3b796f1075d3866d6a after checking unchanged heads.
Merged-main integration run 38695494909 and wiring run 38695494958 also passed.

Render deployment dep-db87i8rm8hqs73bsh4kg of that merge failed at
2026-10-15T06:56:36.499323Z. Its 06:56:36.267963642Z log explicitly confirms
exhausted build pipeline minutes. The individual deployment record still reports
5180c243198afb6dfb05ee8d2e14995d4e7b0750 live in dep-db7r0lh42hec739jiusg.
PRs #95 and #96 are merged/tested, not verified deployed.

## Money Factory inbox expiry verification — 2026-10-15

The matching Money Factory receiver captured one request timestamp before database
work, so an event could expire during a connection or uniqueness wait and still
be committed/acknowledged. PR #20 now passes a clock function through the HTTP
handler, validates finite readings and rechecks the five-minute window immediately
before commit. The internal optional fourth acceptPodEvent argument is now a clock
function, not a numeric timestamp; the default and HTTP callers are updated/tested.
HTTP envelope, idempotency header, reply schema and observation-only semantics stay
unchanged. No event is converted into verified revenue or readiness.

Two HTTP regressions failed before the fix; all seven HTTP tests pass locally.
Hosted cross-repository run
https://github.com/wecreates/Money-factory/actions/runs/38695980312
(job 116292525967) passed all 16 Node tests with zero skips and both Python tests.
Its actual PostgreSQL unique-key barrier expires an envelope while insertion is
blocked, releases the blocker, then verifies rollback and no retained inbox row.
Existing lost-acknowledgement, replay, conflict and rollback tests also passed.
PR #20 merged as f43aae9843ff72a77691672bacc8d1f7643d818e, after head verification.
This does not establish that the receiver is mounted in the live MF service.

The protected database run 38627827260 is still waiting at the pre-005 revision
7d45ff10c90a53721be0a1926eaffb52c7734c3f. No credible changed access path appeared;
database administration was not retried, no duplicate migration was dispatched,
and no credentials, network rules, spend or service plans changed. All 24 live
acceptance areas remain open. Real configuration/evidence, restricted database
preflight, recovery, authorized adapters, capacity and end-to-end acceptance remain
required. Both publication flags remain false. These executed test/merge operations
are not a continuously running self-hosted production worker.


## 2026-10-15 production stage authority repair (merged; live deployment blocked)

At base f84025804bfe461a1132de6b9c30edc930bbe1aa, production checked the upstream grant only before loading task files. Task downloads, rendering and review could outlive that grant or a local rights/lease change. The worker now refreshes scoped upstream authority and checks current concept eligibility, fencing and the production lease before rendering, KDP interiors, artifact persistence, review/hold, QA and completion. Grant expiry and cancellation are checked again after local database waits. This does not renew leases or create permissions; unavailable/expired/revoked authority fails closed. Stage checks bound subsequent work; they do not claim instantaneous distributed cancellation of a stage already running.

Seven regression tests failed against the old coordinator and passed after the repair. Local focused tests: 27 passed, zero skipped, including later review/QA boundary denial and positive orchestration. Synthetic stage fixtures are coordinator tests, not independent QA approval. Added disposable-PostgreSQL barriers for lease expiration, rights revocation and permanent-unpublished changes while waiting on row locks; hosted execution passed as recorded below. No production database access was retried.

Current CI video smoke 38697946612 passed on 2026-10-15, but its video playback/hash/caption receipt does not prove the latest POD code or schema deployed. Render's last observed attempt remains dep-db87i8rm8hqs73bsh4kg (build failed); deployment/quota and protected migration limitations remain as previously recorded. All 24 live acceptance areas remain open. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No purchases, marketplace publication, evasion, social-vault access, new infrastructure or changed grants.


### Production stage repair verification receipt — 2026-10-15

- CC [PR #98](https://github.com/wecreates/content-control/pull/98), tested head `0bfe8bf8b5b94ca2c8400bba2582e43085e9e6e3`, merged as `84c07bb4e1f24494c2defd5b1a62c33ff6e8332c`.
- Initial run [38701651216](https://github.com/wecreates/content-control/actions/runs/38701651216), job 116311026815, found two fixture integration errors: rights UNKNOWN must set permanent-unpublished under the existing schema, and the existing nonzero-QA-process mock needed the new DB guard. Both fixtures were corrected without relaxing production gates.
- Passing PR run [38701874689](https://github.com/wecreates/content-control/actions/runs/38701874689), job 116311762447: 206 Node tests passed, zero failures/skips; 42 POD Python tests passed; real Python production -> durable review hold -> signed QA acceptance passed; three free-review guard tests and workflow-control validation passed. PostgreSQL exercised post-lock lease expiry, rights revocation, tombstones, fencing/account/platform rejection and unchanged queue/event state.
- Merged-main [POD integration 38702114852](https://github.com/wecreates/content-control/actions/runs/38702114852) and [System Wiring Audit 38702114840](https://github.com/wecreates/content-control/actions/runs/38702114840) succeeded.
- Automatic Render deployment `dep-db88e5e0tbcc73e9db3g` of the merge failed at 2026-10-15T07:56:06.186725Z. Build log at 07:56:05.941407347Z explicitly reports exhausted workspace build pipeline minutes. No manual retry, paid upgrade or spend-limit change was attempted. Rechecked live deployment remains `dep-db7r0lh42hec739jiusg`, revision `5180c243198afb6dfb05ee8d2e14995d4e7b0750`; therefore the repaired production worker is merged but not live-verified.
- MF main remains `f43aae9843ff72a77691672bacc8d1f7643d818e`; grant wire contracts are unchanged. No duplicate PR, migration dispatch or database administration retry was created. The existing waiting migration predates migration 005 and is not acceptance evidence.
- All 24 live acceptance rows remain open. Next dependent work is actual hybrid deployment and restricted-role/schema preflight when the existing access/quota blockers change, then attributable account/source/rights/template/reviewer/adapter and capacity/recovery acceptance. Publication flags remain false. Synthetic tests do not certify marketplace rights, product quality, revenue, deployed availability or a continuously running worker.


## QA package binding and physical resolution repair — 2026-10-15

At base 6d6f12a89c38173a473d8bb07ffc2fef503c3e37, QA read mask and KDP cover files without requiring their entries in the hash-bound manifest. It also trusted reported canvas size/native PPI without reconciling them with template dimensions, DPI or source/placed geometry. Regression-only CI [38709193507](https://github.com/wecreates/content-control/actions/runs/38709193507), job 116336066745, reproduced seven false PASS cases in five test methods/subtests: omitted masks/cover/receipt, inconsistent physical dimensions/DPI and inflated native PPI. The unchanged-package control passed. Fixtures use synthetic signed review/rights evidence and stub OCR to isolate these technical checks; they are not product approvals.

QA now requires all consumed package files to be hash-bound before reading them, rejects unsupported/mismatched platforms, and matches the stored KDP interior receipt to its manifest copy. Resolution is derived from template inches and DPI, compared to the actual raster and PNG density (allowing only PNG pixels-per-metre quantization), and recomputed from source/placed dimensions. Upscaled or contradictory claims fail closed. Source provenance still depends on the existing authorized generation and rights pipeline; these arithmetic checks do not independently prove source ownership or visual quality.

Local syntax compilation passed; local OpenCV is unavailable, so full Python execution uses the existing hosted pinned-dependency CI rather than a substitute QA implementation. Full repair CI and merged/deployed acceptance are pending. No production DB retry, new service, paid resource, permission fabrication, marketplace submission or publication enablement occurred. All 24 live acceptance gates remain open; existing deployment quota and database access blockers remain unchanged.


### Package/resolution verification receipt

PR [#100](https://github.com/wecreates/content-control/pull/100), head ab9f508a123875a809cc8d90379b3c40dd84d126, passed [38709504515](https://github.com/wecreates/content-control/actions/runs/38709504515), job 116337102937: 206 Node tests, zero failures/skips; 51 POD Python tests; the actual PostgreSQL/Python durable review pipeline; and three free-review guard tests. It merged as f85e2fe1964ca9e62b44cc3261a94ef3db58bfb5. Merged-main POD run 38709687141 and wiring run 38709687142 both succeeded.

Render deployment dep-db89c2lg1s2s73fbtvb0 failed at 2026-10-15T08:59:55.275598Z; its 08:59:55.087998274Z log explicitly reports exhausted build minutes. Last live deployment was rechecked as dep-db7r0lh42hec739jiusg, revision 5180c243198afb6dfb05ee8d2e14995d4e7b0750. These fixes are merged/tested, not live-verified. No manual deployment retry or database administration attempt was made.

## Derived QA receipt expiry repair — 2026-10-15

Continued inspection found that a signed QA PASS received a new 15-minute expiry regardless of the earlier rights/review deadline. Slow PDF/model evaluation could also outlive a rights envelope checked earlier. QA now revalidates both authorities at evaluation completion, carries their earliest expiry and caps a PASS receipt to that deadline. If evidence expires between evaluation and signing, both JSON report and receipt become FAIL. Failed diagnostics can still be signed; they never acquire a PASS verdict. Comparative weighted margins now reject booleans instead of treating true as numerical 1.

Five new test methods exercise expiry during review, both deadline orders, non-extension, missing/expired deadlines and boolean scores. Local Python syntax compilation passed; full hosted execution remains required before merge. There is no fabricated renewal, market/revenue evidence, publication enablement or claim that all 24 live criteria are complete.


### Derived QA expiry verification and deployment receipt — 2026-10-15

- [PR #101](https://github.com/wecreates/content-control/pull/101), tested head `21e00e3cbf5c3bd1e774a1f02396810a9544597c`, merged as `8a7a815edc5c1a7388d69590a0cfe6edf7611fd8`.
- [Hosted run 38710030780](https://github.com/wecreates/content-control/actions/runs/38710030780), job 116338838635, passed: 206 Node tests with zero skips/failures, 56 POD Python tests, actual PostgreSQL/Python durable generation -> review hold -> signed QA acceptance, three free-review guard tests and workflow-control validation. The new expiry tests use controlled clocks and synthetic signed evidence; no production authority or real clearance was created.
- Merged-main [integration 38710260806](https://github.com/wecreates/content-control/actions/runs/38710260806), job 116339606256, and [wiring 38710261066](https://github.com/wecreates/content-control/actions/runs/38710261066) succeeded. Both #100 and #101 are verified on their merged code, not just branch commits.
- Render deployment `dep-db89e8942hec73c28g1g` failed at 2026-10-15T09:04:34.501579Z. Log 09:04:34.249888406Z confirms the same exhausted build-minute quota. No manual rebuild, quota change, paid resource, replacement service or database administration retry was attempted. The last rechecked live revision remains `5180c243198afb6dfb05ee8d2e14995d4e7b0750` in `dep-db7r0lh42hec739jiusg`.
- MF main remains `f43aae9843ff72a77691672bacc8d1f7643d818e`; no upstream interface changes were needed. Dedicated production DB preflight/migrations and actual account/source/rights/template/reviewer/adapter configuration remain unverified. No changed database access path was observed. All 24 live checklist rows remain open, including capacity, recovery and end-to-end acceptance. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No scheduled execution is represented as an always-on self-hosted worker.


## KDP editorial approval enforcement — 2026-10-15

Inspection found that the interior renderer correctly declared editorial review UNASSESSED, but QA could still pass a KDP package based on technical checks and a cover comparison alone. Added the separate signed editorial-review contract in integrations/pod/EDITORIAL_REVIEW.md, bound to both the completed package and interior PDF. KDP now requires an authorized editorial evaluator and explicit editorial, originality, completeness, cover/interior consistency and disclosure checks. The receipt deadline includes this approval and is rechecked after comparison. No approval is synthesized by the renderer or CLI.

The production worker forwards the separate editorial evidence and host-owned evaluator allowlist. Task descriptors cannot authorize evaluators. Database completion, external QA acceptance and the publishing guard also require the editorial bit for KDP, so legacy technical-only receipts cannot release a book. Other POD platforms retain existing requirements. A dedicated POD_EDITORIAL_KEY is required for genuine KDP review; no live key or evaluator was created, and stored production still defaults to review hold.

Local focused JavaScript checks passed (54 existing/new production, grant, task and release tests plus the 23 base policy/publisher tests); Python syntax compilation passed. Full hosted PostgreSQL/Python verification is pending. Added real database coverage for blocked technical-only completion/review and valid synthetic editorial acceptance, plus Python hash/evaluator/check/expiry tests. Synthetic enabled-adapter tests invoke only in-memory fixtures, never a marketplace or live publication flag.

Current Render remains at its previously verified live revision; latest attempted deployment dep-db89e8942hec73c28g1g still reports build_failed. No credible database access change was observed, so administration was not retried. All 24 live acceptance areas remain open, including actual editorial calibration, rights, official preview, platform adapters, capacity and recovery. Both publication flags remain false; no credentials, paid resources, evasion, social-vault access or fabricated evidence are introduced.


### KDP editorial gate verification receipt

[PR #103](https://github.com/wecreates/content-control/pull/103), head e8d633f173396e6e8dd4274755d50f6164cd3aaf, passed [38716100591](https://github.com/wecreates/content-control/actions/runs/38716100591), job 116359043969: 208 Node tests with zero skips/failures, 60 POD Python tests, the durable PostgreSQL/Python production/review integration and three free-review guard tests. The new PostgreSQL enforcement fixture passed. Merged as 67f9b793c295e5819adb351cce0bcee8878c6f18; merged-main integration 38716303311 and wiring 38716303312 succeeded.

Render deployment dep-db8a59942hec73c33ve0 failed at 2026-10-15T09:53:41.733756Z. Its 09:53:41.435558523Z log explicitly reports exhausted build minutes. No manual retry, resource/spend change, database administration or live account approval occurred. This is tested/merged enforcement, not actual editorial acceptance or deployment.

## KDP interior glyph-bound repair — 2026-10-15

A local real-PDF reproduction using the installed ReportLab 4.4.9 and PyMuPDF 1.26.6 returned technical_checks_passed=true even though the last line's descenders reached 119.8828125pt against a permitted bottom of 117pt. The old renderer checked only the baseline. Two regression tests failed against that code; the valid two-page mirrored-margin control passed.

The renderer now checks ascent/descent before drawing and independently inspects the emitted PDF's text span bounds against the correct inside/outside/top/bottom margins. The existing 0.01pt PDF numeric tolerance is retained for post-render geometry, with no layout repair, font shrink or altered manuscript content. All three focused tests now pass locally; full hosted integration remains required before merge. Editorial remains UNASSESSED in the technical renderer and requires the separate approved evidence contract from #103. These synthetic manuscripts are test fixtures, not market-ready books or official template approval.


### Interior bounds verification and deployment receipt — 2026-10-15

- [PR #104](https://github.com/wecreates/content-control/pull/104), head `97c35fe8946b37146aede440cc33a6762bb175a4`, passed [38716632482](https://github.com/wecreates/content-control/actions/runs/38716632482), job 116360800280: 208 Node tests, zero skips/failures; 63 POD Python tests including the three real-PDF margin cases; actual PostgreSQL/Python durable review integration; three free-review guards and workflow-control validation.
- Merged as `65c9afe0f86caa81db80377d3d247295cc616f80`. Merged-main [integration 38716818202](https://github.com/wecreates/content-control/actions/runs/38716818202), job 116361422548, and [wiring 38716818245](https://github.com/wecreates/content-control/actions/runs/38716818245) succeeded. PR #103's separate editorial requirement remains enforced; geometry alone cannot approve publication or manuscript content.
- Render attempted `dep-db8a78lg1s2s73fctgag` and reported build_failed at 2026-10-15T09:57:54.795141Z. Its 09:57:54.60154676Z log confirms exhausted build pipeline minutes. The individually rechecked live deployment remains `dep-db7r0lh42hec739jiusg`, revision `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. Neither repair is live-verified. No manual deploy retry or paid resource/spend change occurred.
- Protected migration run 38627827260 remains waiting at pre-005 revision `7d45ff10c90a53721be0a1926eaffb52c7734c3f`; no duplicate or stale migration was executed. No credible changed DB access path was found, so administration was not retried. MF main was rechecked at `f43aae9843ff72a77691672bacc8d1f7643d818e`; its authority interfaces are unchanged.
- All 24 live checklist areas remain open. Actual hybrid deployment, restricted-role/schema preflight, independent reviewer/key configuration and calibration, rights/template/account evidence, platform previews/adapters, capacity/recovery and authorized end-to-end acceptance remain necessary. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. These executed tests/merges do not establish a continuously running production worker or real marketplace approval.


## Independent interior PDF preflight — 2026-10-15

The KDP QA gateway previously rechecked only page count and physical size after trusting the renderer's technical receipt. It now inspects actual interior PDF text geometry separately from generation: mirrored margins on every page, extracted span bounds, display-list text bounds (including off-page operations), visible fill text, uncropped/unrotated page boxes and supported text-only content. Empty pages, hidden/stroked text, unsupported graphics/forms/annotations and malformed nonfinite/boolean dimensions fail closed. This is limited to the existing text_no_bleed contract; it does not certify editorial quality, fonts/rights, official templates or platform preview acceptance.

Nine real-PDF tests passed locally, including six new negative-path methods and the existing valid mirrored-page control. A package-level regression mutates six actual PDFs while keeping matching hashes and synthetic passing receipts/approvals, to verify the full QA gateway still rejects the defects. Full hosted integration is pending; local OpenCV is unavailable, so no full local QA result is claimed. Publication remains disabled and no live approval/key was created.

Current heads were inspected before editing: CC 8d56e3de0c5d47435ea3d3b784a742b3ec0ff22a; MF b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6, whose latest change is the free-monitor cadence report. Unrelated open PRs were preserved. Render's latest attempt remains dep-db8a78lg1s2s73fctgag/build_failed; no changed database access path was found and no administration/deployment retry was made. All 24 live acceptance rows remain open.


### Independent interior QA verification receipt

[PR #106](https://github.com/wecreates/content-control/pull/106), head a7432687e54ee23a7b3b69772381122faba32014, passed [38725333316](https://github.com/wecreates/content-control/actions/runs/38725333316), job 116389642463: 208 Node tests without failures/skips, 70 POD Python tests, the actual PostgreSQL/Python durable review workflow and three free-review guard tests. Merged as 26c68b3fac51b42d94a0790c64e7549e74655db9; merged-main integration 38725497412 and wiring 38725497491 succeeded. Render deploy dep-db8b9ek9v7es73boitbg failed at 2026-10-15T11:10:51.843325Z; this is tested/merged code, not a live QA acceptance.

## Independent cover/interior pairing — 2026-10-15

The assembly step enforced trim pairing, but final QA only compared page count. Continued work adds a separate final physical pairing check: interior trim width, cover wrap width including spine/bleed, cover height including bleed and exact page count. Boolean, nonfinite, negative and malformed measurements fail closed. This uses supplied specifications, never an inferred spine formula or invented official template.

Ten focused real-PDF/pairing tests pass locally. The full-package regression creates a valid replacement interior at each of two mismatched trims, updates all hashes/receipts and uses synthetic review evidence; QA must return COVER_INTERIOR_MISMATCH. Full hosted verification is pending. The valid package control remains required. No real approval or publication is created; all 24 live acceptance areas remain open.


### Final pairing verification and deployment checkpoint — 2026-10-15

- [PR #107](https://github.com/wecreates/content-control/pull/107), head `47ceb32ccf5a0c7ec93b1bfc84a7648bebb98c1c`, passed [38725709203](https://github.com/wecreates/content-control/actions/runs/38725709203), job 116390917737: 208 Node tests with zero failures/skips, 72 POD Python tests (including ten PDF/pairing tests and both actual replacement-interior regressions), durable PostgreSQL/Python review integration, three free-review guards and workflow validation. Synthetic attestations remain fixtures, not real rights/editorial approval.
- Merged as `a10d11c6e62068172f02505b370699c3347c38bd`. Merged-main [integration 38725885584](https://github.com/wecreates/content-control/actions/runs/38725885584), job 116391505775, and [wiring 38725885967](https://github.com/wecreates/content-control/actions/runs/38725885967) succeeded. PR #106 also passed its merged-main checks, as recorded above. Dockerfile copies the new helper with the existing scripts and retains all POD/publication defaults false; no new dependency or infrastructure was added.
- Render deploy `dep-db8bb04s728c73fte6v0` failed at 2026-10-15T11:14:09.203356Z. Its 11:14:08.937559091Z log explicitly reports exhausted build pipeline minutes. The preceding #106 attempt `dep-db8b9ek9v7es73boitbg` likewise logged quota exhaustion at 11:10:51.539242027Z. Neither repair is live-verified. The individually rechecked last live deploy remains `dep-db7r0lh42hec739jiusg`, revision `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual retry, paid resource, spend change or widened network access occurred.
- MF main was rechecked at `b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6`; its latest commit only updates free-monitor state/events. Its current CONTENT_CONTROL_BRIDGE.json still declares POD production_ready=false and publication_enabled=false. No authority interface changes were needed. Protected migration 38627827260 remains waiting; no stale/duplicate migration was approved or dispatched and no changed DB administration path was found.
- All 24 live checklist rows remain open. Production database/role preflight, retained recovery, hybrid deployment, genuine accounts/sources/rights/templates/reviewers, all five authorized adapters, actual finances, mobile acceptance, measured capacity and end-to-end release acceptance remain unverified. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. Merged tests are not live acceptance or a continuously running worker. No unchanged blocker notification is repeated.


## Redacted production failure diagnostics — 2026-10-15

Current repository and workflow inspection found no duplicate POD PR. Ordered Capability Completion run 38732351094 and Full Capability Validation run 38731152890 intentionally failed closed with zero ready tasks and 2,500 blocked capabilities; their logs do not show a new POD test regression. Their blocker receipts were saved by those workflows. No unrelated capability status was rewritten.

The POD coordinator previously replaced all production failures with PRODUCTION_BLOCKED. Added a fixed diagnostic allowlist, structured nonzero child-output parsing and sanitized queue persistence. Unknown messages, paths, URLs, credentials and raw child output remain redacted. Both stdout and stderr now count toward the shared subprocess output bound, with stderr discarded. Existing nonzero-QA signed-FAIL behavior and process reap/cancellation guarantees remain enforced.

Repair archival retains the previous sanitized reason and clears the new raw attempt's stale reason. Authenticated QA failure explicitly sets QA_FAILED and successful completion clears it. This prevents a stale REVIEW_REQUIRED label from treating a genuine failed evaluation as an external review hold. Current authority, rights, fencing, lease and three-attempt limits remain required. See integrations/pod/FAILURE_DIAGNOSTICS.md; these diagnostics do not implement or certify every failure-specific repair.

77 focused local Node tests passed (29 process/worker/lease/diagnostic checks and 48 authority/evidence/template tests). Added real PostgreSQL coverage for reason persistence/redaction, retry archival/reset, failed-QA review rejection and exhausted retry limits; hosted integration is pending. No production SQL, marketplace action, new secret or paid resource was used. Both publication flags remain false. Render is still blocked on its previously observed build-minute quota, no changed database access path was found, and all 24 live acceptance rows remain open.


The first hosted run 38733624191 passed 215 Node tests (including the new real PostgreSQL cases) and 72 POD Python tests, then failed at the older durable-workflow assertion expecting PRODUCTION_BLOCKED for a rejected template. Updated that assertion to the specific TEMPLATE_PROVENANCE_REQUIRED code and added a real Python insufficient-native-resolution path asserting its exact code reaches the stored queue without persisting failed output.

Continued wiring carries sanitized reasons into the existing runtime health/error callback and counts authenticated QA_FAILED as a failed cycle, rather than resetting its failure count. Review holds and idle cycles retain non-error semantics. Fifteen focused local runtime/process tests passed after these changes, including real child exits and callback assertions. Full hosted verification of the revised head remains required; no external alert destination or live worker is claimed.


### Failure diagnostics verification and deployment receipt — 2026-10-15

- [PR #109](https://github.com/wecreates/content-control/pull/109), tested head `3d8a3fcbc46bd762795f3d5dd1cdceb307af75c1`, passed [38734050240](https://github.com/wecreates/content-control/actions/runs/38734050240), job 116418720037: 215 Node tests with zero failures/skips, 72 POD Python tests, real PostgreSQL/Python durable production/review integration (including the actual native-resolution rejection), three free-review guards and workflow-control validation. The first failed run and corrected older assertion are retained above.
- Merged as `d8a66e5a3c3b49bad2cb0e8cfb525765209fc964`. Merged-main [integration 38734313304](https://github.com/wecreates/content-control/actions/runs/38734313304), job 116419599233, and [wiring 38734313386](https://github.com/wecreates/content-control/actions/runs/38734313386) both succeeded. Tests use disposable PostgreSQL and synthetic approvals; they establish enforcement behavior, not actual accounts, clearance, financial events or live remediation acceptance.
- Render deploy `dep-db8cblbrjlhs73d1t4bg` failed at 2026-10-15T12:23:50.295312Z. Its 12:23:50.007110599Z log confirms the unchanged exhausted build-minute quota. The individually rechecked live deploy remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. This repair is merged/tested but not live-verified. No manual rebuild, plan/spend change, new resource or database network expansion was attempted.
- MF main was rechecked at `b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6`; no upstream contract changes were required. Protected migration run 38627827260 is still waiting. There was no credible changed DB access path, so no administration retry or stale/duplicate migration was executed.
- All 24 live acceptance rows remain open. Failure-specific repair implementations and real recovery/alert acceptance still require evidence; unknown or unstructured Python failures retain the generic safe reason. The remaining production DB/role, retained storage, hybrid deployment, authority/account/source/rights/template/reviewer/adapter configuration, real finances, mobile acceptance, measured capacity and end-to-end release requirements are unchanged. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No continuously running self-hosted worker or completion is claimed, and no unchanged blocker notification is repeated.


## Atomic bounded production package persistence — 2026-10-15

Inspection found that generated files were inserted one transaction at a time. If a later file exceeded storage capacity or failed persistence, earlier files remained stored even though the package failed. Production now verifies and reads the complete package within 32-file, 16-MiB-object and 64-MiB-package bounds before writing. Open-descriptor checks, fixed allocations and final length/hash verification avoid unbounded readFile allocation and reject path escapes or changed/nonregular output.

ArtifactStore.putMany performs deduplication, combined missing-byte capacity checks and all inserts under one existing advisory lock/transaction. Single-object put shares that contract. The worker renews authority after reading, before persistence; existing revocation checks remain in place. Default store capacity stays 128 MiB. No historical artifact deletion, new infrastructure, automatic upscaling or provider-expiry extension is introduced. Successfully committed batches can still become unreferenced after a later queue/review failure; full reclamation/recovery remains separate work.

46 focused local Node tests passed (27 package/production/process tests plus 19 worker/diagnostic/process checks). Added disposable PostgreSQL tests for budget rejection without partial blobs, rollback after a second-insert failure, concurrent whole-batch capacity contention and duplicate replay at a full budget. Full hosted integration is pending. See integrations/pod/PACKAGE_STORAGE.md. Current heads were checked (CC 9bfb7a2d3a80635c6f9427257b2509bc10a2de65, MF b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6); no competing POD PR was present. No credible changed production DB access path was found, so administration was not retried. Both publication flags remain false and all 24 live acceptance areas remain open.

### Atomic storage verification receipt — 2026-10-15 13:10 UTC

- PR [#111](https://github.com/wecreates/content-control/pull/111), tested head `2828d4ac6673ccec5c2eb3a658dc3853fa4328f7`, merged as `0f3d6f1d43e35c4e974b973f104534442c841dc2`. PR integration run [38739717428](https://github.com/wecreates/content-control/actions/runs/38739717428), job 116438148576, passed 221 Node tests with zero failures/skips, 72 POD Python tests, the real Python/disposable-PostgreSQL production-to-review acceptance flow and three free-review guard tests. The PostgreSQL suite exercised actual rollback after a second-insert failure, concurrent batch capacity contention, budget rejection with no partial persistence and idempotent replay at full capacity.
- Merged-main integration [38740220202](https://github.com/wecreates/content-control/actions/runs/38740220202), job 116439665581, repeated those passing results. System Wiring Audit [38740220574](https://github.com/wecreates/content-control/actions/runs/38740220574) passed. Workflow validation also passed with publication disabled. These are controlled test fixtures, not production acceptance or measured daily throughput.
- Automatic Render deploy `dep-db8d0ltbedkc73a31h6g` failed at 2026-10-15T13:08:40.489911Z; its 13:08:40.199648913Z log explicitly reports exhausted workspace build pipeline minutes. Last individually rechecked live deploy remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual retry, purchased capacity, replacement resource or network expansion was attempted. This package-storage change is merged and tested, not live-verified.
- MF main remains `b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6`. Protected migration run 38627827260 remains waiting at pre-005 head `7d45ff10c90a53721be0a1926eaffb52c7734c3f`. No changed production DB access path was established; no stale approval, duplicate job or administration retry occurred.
- All 24 live acceptance rows remain open. Whole-system recovery and safe reclamation of successfully committed but unreferenced packages remain unfinished; this fix only guarantees atomic blob-batch persistence. Production roles/migrations, retained backups, hybrid hosting, live authority and account/source/rights/template/reviewer/adapter evidence, real financial reconciliation, mobile acceptance, measured capacity and controlled end-to-end acceptance still require their existing evidence. PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED remain false. No continuously running self-hosted worker, clearance, revenue or completion is claimed. The unchanged external blocker is not re-notified.


## Exact delivered KDP cover validation — 2026-10-15

The previous PDF preflight used mean RGB error below one, allowing a localized altered or missing detail to pass on a large cover. Replaced it with exact rendered RGB pixel comparison against print.png. Preflight now rejects unsupported rotation, crop/media-box changes, multiple pages and interactive content before rendering; DPI and pixel limits remain bounded. The 0.01-point page-box tolerance covers coordinate serialization only, not pixel differences. The supported lossless generator passed real rendering tests at 300, 600 and 1,200 DPI.

Six new real-PDF regression tests passed locally with the ten existing interior/pairing tests (16 total). A further QA integration regression alters one cover pixel, rebinds its file and manifest hashes, supplies synthetic review evidence and requires binary failure. Local syntax checks passed; the full QA suite requires hosted OpenCV, which is unavailable locally. Hosted validation remains pending. See integrations/pod/COVER_PREFLIGHT.md. No threshold relaxation, generated approval, platform action or migration is introduced.

Fresh inspection found CC main 4a404bcf1e4bf510ed28b6641bcf89bba36e10d1, MF main b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6 and no competing POD PR. Live Render smoke 38741779263 and watchdog 38741892111 passed their video-artifact/configuration scope; neither proves deployment or acceptance of the POD changes. The latest Render POD release remains build-failed due to the already recorded quota. No credible changed DB access path exists, so administration was not retried. Both publication flags remain false and all 24 live acceptance areas remain open.

### Cover preflight verification and deployment receipt — 2026-10-15 13:34 UTC

- [PR #113](https://github.com/wecreates/content-control/pull/113), tested head `6613188c7dcc1dc8434089157f24738f71226812`, passed [integration 38743259258](https://github.com/wecreates/content-control/actions/runs/38743259258), job 116450141825: 221 Node tests with zero failures/skips, 79 POD Python tests (including real PDF rendering and the rebound-hash corruption regression), durable PostgreSQL/Python production-to-review acceptance, three free-review guards and workflow-control validation.
- Merged as `30bc487845114efe45178bd64818fd89729bb197`. Merged-main [integration 38743521743](https://github.com/wecreates/content-control/actions/runs/38743521743), job 116451039183, repeated those passing results. [System Wiring Audit 38743521965](https://github.com/wecreates/content-control/actions/runs/38743521965) passed. The lossless cover path remains usable while a single altered pixel cannot pass through the old average-error allowance. Tests use synthetic evidence and do not establish actual rights, editorial approval or marketplace preview acceptance.
- Automatic Render deploy `dep-db8dbmdbedkc73a3hs8g` failed at 2026-10-15T13:32:11.002715Z; the 13:32:10.429421897Z log confirms the unchanged exhausted build-minute quota. Individually rechecked live deploy remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual retry, plan change, spending, new service or expanded network access was attempted. This repair is merged and tested, not live-verified.
- MF main remains `b53a4db1d3d4bd8d7e9c0f8b5568edf9091ca2e6`. Protected migration run 38627827260 remains waiting at its old pre-005 head. No new DB access path was established; no administration retry or duplicate/stale migration execution occurred.
- All 24 live acceptance areas remain open. Production DB/role access, retained recovery, hybrid deployment, current live authority, real accounts and authorized source/rights/template/reviewer/adapter evidence, finance, mobile acceptance, measured capacity and end-to-end launch evidence remain unfinished. Publication flags remain false. No continuously running self-hosted worker or completion is claimed. Preserve these blockers and the separate scope of the existing video smoke checks; do not report their success as POD acceptance. No unchanged owner-only blocker notification is repeated.


## Recoverable interrupted production leases — 2026-10-15

Found a durable recovery dead end: recover() marks crashed/expired internal production as blocked/PRODUCTION_LEASE_EXPIRED, while the authenticated repair endpoint previously accepted only qa_failed. Extended the existing requeueRepair transaction to accept that specific blocked reason only when the lease is actually expired, no provider listing exists, current concept rights remain PASS and non-tombstoned, and fewer than three attempts have run. A fresh scoped upstream grant remains mandatory and is revalidated after database waits. The archived reason is preserved, the stale lease is cleared and attempt counters are retained. The next normal claim increments the fencing token. All other blocked/publication/ambiguous states remain ineligible.

27 focused local Node tests passed; the new disposable PostgreSQL recovery helper passes syntax validation and awaits hosted execution. It exercises actual recovery, concurrent retry exclusivity, stale-worker rejection, repeated-crash attempt limits, invalid authority, active/missing leases, known provider IDs and revoked rights. See integrations/pod/PRODUCTION_RECOVERY.md. No production activation, adapter submission, credential creation, migration or live database administration was performed.

Current inspection: CC main 7dcad2ef9613d4d2c09c7bc627b8a3514aa928ce, MF main de20c81f95c4f82b43a545c515546c5b9fdd8f49. Intervening changes are video QA/ledger and MF monitor evidence, preserved without modification. No competing POD PR was found. Latest Render deploy dep-db8ep55bedkc73a5sqf0 is build_failed; the prior explicit build-quota blocker and production DB access limitations have no verified resolution. Both publication flags remain false and all 24 live acceptance rows remain open.

### Interrupted production recovery verification — 2026-10-15 15:24 UTC

- [PR #115](https://github.com/wecreates/content-control/pull/115), tested head `28559b529b0c9fd48452dff934824f768f2708a3`, passed [integration 38759404546](https://github.com/wecreates/content-control/actions/runs/38759404546), job 116506403381: 221 Node tests with zero failures/skips, 79 POD Python tests, durable PostgreSQL/Python production-to-review acceptance, three free-review guards and workflow validation. The PostgreSQL suite executed the new interrupted-production recovery cases, including real concurrent retries and subsequent fenced claims.
- Merged as `44430866915323ffa828f6491e6a7f1510932339`. Merged-main [integration 38759693447](https://github.com/wecreates/content-control/actions/runs/38759693447), job 116507379010, repeated those passing results. [System Wiring Audit 38759693095](https://github.com/wecreates/content-control/actions/runs/38759693095) passed. Tests demonstrate the controlled retry path; synthetic grants and disposable data do not constitute a live recovery drill or real upstream authorization.
- Automatic Render deploy `dep-db8ev7u0tbcc73ei6o2g` failed at 2026-10-15T15:22:08.768101Z. Its 15:22:08.294133187Z log explicitly reports exhausted build pipeline minutes. Individually rechecked live deploy remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual rebuild, paid plan/spend change, replacement service or network expansion was attempted. This repair is merged/tested and not live-verified.
- MF main remains `de20c81f95c4f82b43a545c515546c5b9fdd8f49`. Protected migration run 38627827260 is still waiting at old pre-005 head `7d45ff10c90a53721be0a1926eaffb52c7734c3f`. No changed production DB access path was found, so no stale/duplicate migration or administration retry was executed.
- All 24 live acceptance rows remain open. Actual DB role/migration verification, retained whole-system recovery, hybrid deployment, current live authority and real account/source/rights/template/reviewer/adapter evidence, finance, mobile acceptance, measured 100/1,000-concept capacity and controlled end-to-end launch evidence remain unfinished. Other failure-specific remediation still requires implementation and verified outcomes. Both publication flags remain false; no running self-hosted worker, clearance, revenue or completion is claimed. The unchanged owner-only blockers are not re-notified.


## Authenticated job browsing and print previews — 2026-10-15

The phone dashboard previously displayed raw aggregate metrics only. Extended the existing dashboard with bounded authenticated job browsing, separate review-hold/failure filters and direct job-ID lookup for stored print previews. Added a read-only GET /api/print/jobs endpoint and parameterized allowlisted query returning only seven operational fields, at most 50 newest matching jobs. Unknown failure text is sanitized. Existing review, repair, authority and release routes are unchanged.

Preview requests stay same-origin with redirects blocked and bounded response reads. Print bytes must match the manifest's SHA-256; non-PNG and over-25-million-pixel images are rejected before browser decoding. Text is rendered with textContent. Credentials remain page-local, blob URLs are revoked, and in-flight responses cannot restore cleared sessions. CSP permits local blob images only. This UI cannot approve QA or publish, and does not replace independent KDP interior review. See integrations/pod/MOBILE_OPERATIONS.md.

18 focused local Node tests passed, including five new DOM/stream simulations covering authenticated routes, unsafe text, hash mismatch, decoded-image bounds, oversized streams, stale requests and cleanup. Added HTTP route tests and actual PostgreSQL coverage for filter rejection, result limits, reason redaction, selected fields and review-hold separation; hosted execution remains pending. Browser simulation is not actual phone acceptance.

Fresh heads were CC 088c2f2cb3fc3aed299d2a2e5ee06fe0531e4a36 and MF de20c81f95c4f82b43a545c515546c5b9fdd8f49, with no competing POD PR. Render remains build-failed on the previously verified quota blocker, and no changed DB access path was established. No production database, credentials, external account, paid resource or publication switch was changed. All 24 live acceptance areas remain open.

The first hosted integration run 38764907724 failed because the new operations-listing fixture used revision zero, correctly rejected by the existing positive-revision constraint. Corrected fixture numbering to start at one; no schema or assertion was weakened. The revised head requires the full hosted suite to pass.

### Mobile operations verification and deployment receipt — 2026-10-15 16:04 UTC

- [PR #117](https://github.com/wecreates/content-control/pull/117), revised tested head `71d05aa62041700226d8211cfa21f8c6f1186f99`, passed [integration 38765169229](https://github.com/wecreates/content-control/actions/runs/38765169229), job 116526386632: 227 Node tests with zero failures/skips, 79 POD Python tests, durable PostgreSQL/Python production-to-review acceptance, three free-review guards and workflow validation. Actual PostgreSQL tests verify the 50-row limit, selected fields, reason redaction, rejected filters and review-hold separation. HTTP and client simulations cover authentication, hashes, size limits, cancellation and cleanup. The initial positive-revision fixture failure remains recorded above.
- Merged as `5b7d25e767f632ad5921b51dc403f3a4c77c6c8c`. Merged-main [integration 38765504417](https://github.com/wecreates/content-control/actions/runs/38765504417), job 116527519376, repeated those passing results. [System Wiring Audit 38765504541](https://github.com/wecreates/content-control/actions/runs/38765504541) passed. These automated checks do not establish successful real owner authentication, phone rendering/accessibility acceptance or current independent product approval.
- Automatic Render deploy `dep-db8fhre89jmc739ptf6g` failed at 2026-10-15T16:01:52.134902Z. The 16:01:51.362732955Z log confirms the unchanged exhausted build-minute quota. Individually rechecked live deploy remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual rebuild, paid capacity, replacement resource or expanded network access was attempted. The new dashboard is merged/tested, not verified live.
- MF main remains `de20c81f95c4f82b43a545c515546c5b9fdd8f49`. Protected migration run 38627827260 remains waiting at its old pre-005 head. No credible changed DB access path was established, and no stale/duplicate migration or administration retry occurred.
- All 24 live acceptance areas remain open. Production role/schema access, retained whole-system recovery, hybrid hosting, current live authority, real account/source/rights/template/reviewer/adapter evidence, financial reconciliation, actual phone acceptance, measured capacity and controlled end-to-end launch evidence still require verification. Both publication flags remain false. No continuously running self-hosted worker, approval, revenue or completion is claimed; unchanged owner-only blockers are not re-notified.


## Static PDF behavior and invisible interior text — 2026-10-15

Reproduced four independent-interior preflight false passes: white-on-white text, a URI link, an embedded file and a catalog JavaScript OpenAction. Added shared parsed document/page policy for both KDP covers and interiors. Encryption (including owner-only encryption), actions, name trees, forms, outlines, optional content, collections, associated files and all page annotation dictionaries are outside the supported generated print subset and now fail closed. Literal PDF names in metadata remain harmless. The black-text interior contract now verifies trace colors as well as fill mode and opacity. This does not claim general malware scanning or perfect rendering.

23 local real-PDF tests passed; Python compilation passed. One initial test fixture used an empty Collection dictionary that the PDF serializer removed; corrected it to an actual nonempty Collection before verification without weakening the policy. Extended the full QA regression to rebind all hashes and synthetic approvals for white text, links, attachments and document actions; hosted execution remains pending because local cv2 is unavailable. See integrations/pod/STATIC_PDF_CONTRACT.md. No dependencies, database schema, credentials or publication switches changed.

Inspected current CC main b5b0823608d4e32295b4e04054e2f54c119f4f36 and MF main de20c81f95c4f82b43a545c515546c5b9fdd8f49, open PRs, recent workflows and the authorized Render service. No competing POD change was found. Latest automatic deploy remains dep-db8fhre89jmc739ptf6g/build_failed; no changed DB access path was established. All 24 live acceptance areas remain open, both publication flags remain false, and retained recovery, real source/account/rights/template/reviewer/adapter inputs, deployment and end-to-end acceptance are still unverified.


### Static PDF verification and deployment receipt — 2026-10-15 16:34 UTC

- [PR #119](https://github.com/wecreates/content-control/pull/119), tested head `1fc2d88cd6be0bf851a529d5bc03607e25890144`, passed [integration 38769501052](https://github.com/wecreates/content-control/actions/runs/38769501052), job 116541315417: 227 Node tests with zero failures/skips, 86 POD Python tests, durable PostgreSQL/Python production-to-review acceptance, three free-review guards and workflow validation. Actual PDF tests cover both formats and full QA rejects the four newly reproduced cases despite matching package/receipt hashes and synthetic approvals.
- Merged as `e361437b7fd0d28ba77ba2a533e81ba7b30dceed`. Merged-main [integration 38769771842](https://github.com/wecreates/content-control/actions/runs/38769771842), job 116542223909, repeated those passing results. [System Wiring Audit 38769771814](https://github.com/wecreates/content-control/actions/runs/38769771814) passed. This establishes the technical regression repair, not real editorial/rights approval, print perfection or marketplace preview acceptance.
- Automatic Render deploy `dep-db8fvtks728c73f3as8g` failed at 2026-10-15T16:31:52.106716Z. Its 16:31:51.742708351Z log explicitly reports the unchanged exhausted build-minute quota. Individually rechecked live deployment remains `dep-db7r0lh42hec739jiusg`, commit `5180c243198afb6dfb05ee8d2e14995d4e7b0750`. No manual rebuild, spending/plan change, replacement service or expanded network access was attempted. The repair is merged/tested, not live-verified.
- MF main remains `de20c81f95c4f82b43a545c515546c5b9fdd8f49`. Protected migration run 38627827260 remains waiting at its old pre-005 head. No credible changed production DB access path was established, so no administration retry or stale/duplicate migration was executed.
- All 24 live acceptance rows remain open. Production role/schema verification, retained whole-system recovery, hybrid hosting, current live authority, real account/source/rights/template/reviewer/adapter evidence, finance, phone acceptance, measured capacity and controlled end-to-end launch evidence remain unfinished. Both publication flags remain false. No continuously running self-hosted worker, clearance, revenue or completion is claimed. Unchanged owner-only blockers are not re-notified.


## Offline encrypted archive verification — 2026-10-15

Added a read-only verify mode to the existing artifact archive command. It requires no database configuration, authenticates the catalog and every referenced object, enforces existing bounds, and emits a content-free receipt bound to the encrypted catalog hash. Hardened archive reads with nonblocking opens plus regular-file checks, cancellation between reads, and root/file symlink rejection. FIFO regression tests run in deadline-bounded child processes so a blocking-open regression cannot hang the test runner.

Restore now verifies archive integrity before its insertion transaction and repeats authentication during insertion. Added a real PostgreSQL race test that changes a later archived file after the first INSERT and requires complete rollback; the existing isolated-database reconnect/idempotency drill remains. The CLI's existing restore confirmation and configuration preflight remain mandatory. No live archive, key, retention destination or database access was created.

18 focused local Node tests passed, including six new archive verification regressions; affected CLI and PostgreSQL tests pass syntax checks. Hosted PostgreSQL execution remains pending. Documentation is in integrations/pod/ARTIFACT_RECOVERY.md. This remains artifact-only recovery; whole-system recovery and independent retained production backups are not claimed.

Fresh CC main is 361371d2aba7d01c027ad7dafe11f1b794fe1bab; intervening provenance reports were preserved. MF main remains de20c81f95c4f82b43a545c515546c5b9fdd8f49. No competing POD PR was found. Render's last automatic attempt is still dep-db8fvtks728c73f3as8g/build_failed, and no credible changed DB administration path was established. All 24 live acceptance areas remain open and both publication flags remain false. Existing video smoke/watchdog success is not POD deployment or acceptance evidence.
