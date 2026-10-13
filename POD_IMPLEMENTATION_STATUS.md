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
