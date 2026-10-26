# Free-tier deployment path

This is deployment tooling, not evidence of live production or marketplace publication.
Existing Render service: content-control-render-worker. Do not create a duplicate service.

## Runtime dependencies

`Dockerfile` installs Node 22, Python 3.12, the pinned print libraries, English
Tesseract OCR, licensed DejaVu fonts, and FFmpeg. It runs as an unprivileged user.
The container gate runs on PR changes to POD runtime code, tests, migrations,
Node dependency manifests, the web entry point and image configuration. Markdown
inside integrations/pod is excluded from that image trigger. Superseded runs on
the same PR are cancelled. It verifies UID 10001 and installed dependencies, then
runs the POD Python suite with networking disabled, the Node/PostgreSQL suite and
the durable review E2E inside the exact Dockerfile image. Database tests use only
the workflow's disposable local PostgreSQL service. The startup smoke retains
both publication and production disabled. No image is pushed or deployed by this
gate, and no cloud credentials are supplied when building or testing it.
The local startup probe waits at most 60 seconds for `/api/print/status`, rejects
redirects and invalid or oversized responses, and requires the service, production
loop and outbox to be DISABLED with publication neither enabled nor requested.
It checks image defaults without injecting enabling flags or cloud credentials.
Each probe attempt owns a referenced timer, so standalone Node cannot exit while
awaiting an unreferenced transport. Header and body waits share that attempt's
abort signal and monotonic deadline; failed-response cancellation is best effort
and cannot hold the probe open. Child-process regressions exercise these limits
without a test server keeping the child alive.
The shared `/health` route measures video acceptance and is not used as POD startup
evidence. These image checks do not change Render's configured health route or
replace the separate live deployment smoke.
Additional OCR languages require installation and validation before jobs in those
languages are enabled. A successful container gate is build/test evidence, not
proof that Render has deployed that revision or that any live acceptance row passes.

After the container gate passes, the existing Render service can use Docker runtime
with Dockerfile path `./Dockerfile`. Preserve its environment variables, domain,
health path `/health`, free plan, and integrations. The checked-in render.yaml uses the same Docker runtime and explicit free plan.
Runtime deployment success does not imply that the POD database is initialized.
The dashboard source update triggers deployment; do not trigger a duplicate deploy.
Rollback uses the previous Node runtime/build/start configuration.

## Database migration without Render Shell

The manually dispatched `POD database deployment (manual, no publication)` workflow
runs only from main, is serialized, and uses the `pod-database` GitHub environment.
Configure that environment's required reviewers before adding migration credentials.
It is never triggered by PRs, schedules, application requests, or service startup.

Environment secrets:
- POD_MIGRATION_DATABASE_URL: external TLS URL for the existing migration owner.
- POD_RUNTIME_DATABASE_URL: external TLS URL for an existing dedicated restricted POD role.

Environment variables:
- POD_RUNTIME_USER: that role's exact username.
- POD_STORAGE_EXPIRES_AT: actual provider expiry as canonical UTC
  `YYYY-MM-DDTHH:mm:ssZ` or exact millisecond ISO text, never a fictitious future
  date. Date-only, offset or otherwise normalized text is rejected.

Default dispatch is check-only. Selecting apply runs the existing checksum-guarded,
advisory-locked, transactional migration and then verifies access using the runtime
credentials. It rejects differing hosts/databases, the same owner/runtime identity,
expiry within 24 hours, disabled TLS settings, or publication flags that aren't false.
A migration alone is not success: all six runtime database checks must pass. The
receipt includes no connection URLs, passwords, database content, or signing keys.
It does not create or rotate credentials or expand database network access.

If the GitHub runner cannot reach PostgreSQL under existing restrictions, stop with
BLOCKED. Do not open the database to the internet to make the workflow pass. This
path does not eliminate the need for an authorized connection and dedicated role.

Keep migration credentials out of Render's web-service environment. Only its runtime
URL goes there; it may use the provider's verified-TLS internal endpoint. Configure
POD_BRIDGE_PATH, POD_STORAGE_EXPIRES_AT, POD_UPSTREAM_KEY, POD_QA_KEY and
INTERNAL_OPERATIONS_KEY from the existing authorization authorities. Do not invent
approvals or grant the production worker the migration owner's privileges.

## Activation and remaining operational limits

Run `scripts/pod_preflight.mjs` with the real runtime configuration. Enable the POD
service and production loop only after schema, role isolation, TLS, bridge contract,
keys, dependencies, task resolvers and expiry checks pass. Publication stays disabled.
Run an authorized internal job and verify durable artifact hashes and review hold
before treating live production as verified. Test fixtures are not real rights or QA.

Free Render web services sleep during inactivity; this is not a guaranteed 24/7
worker. The prior inspected Render database expired October 26, 2026 and is no
longer the planned POD runtime database. The authorized replacement is the free
Neon project `damp-base-09108632`, production branch
`br-orange-sun-arizhns5`, database `content_control_state`. Its verified free-plan
limits are 1 GiB of logical storage and a six-hour restore window. No provider
project-deletion date was found. Until a longer-lived arrangement is approved, use
the current verified quota-period boundary, November 1, 2026 at 00:00:00 UTC, as a
conservative operational cutoff rather than representing it as a deletion date.
An approved independently retained backup arrangement is still required before
relying on this database for ongoing production. No paid resources are created here.

## October 26 Neon replacement and recovery drill

The exact five repository migrations were applied transactionally under the
database owner and recorded in `pod_schema_version` with their repository SHA-256
values. The live Render runtime uses `pod_runtime_restricted`: a login with no
superuser, database-creation, role-management, replication, bypass-RLS, inheritance,
database-create or schema-create privilege and no elevated memberships. It has only
SELECT/INSERT/UPDATE on the ten named POD data tables and SELECT on the migration
version table. It does not own the schema or tables and has no social-vault access.
Migration-owner credentials are not stored in Render.

Snapshot `snap-broad-rice-arc4u25c` was created from the production branch and
restored without replacing production to isolated branch
`br-polished-thunder-ar0d4qka`. The recovered branch reached ready state and the
restricted role verified 11 public tables, the exact five migration rows and no
database/schema-create or administrator attributes. The snapshot and recovery
branch expire or consume the same bounded free resources; this is a provider-local
recovery drill, not an independently retained backup or proof of long-term durability.

The existing Render service stores the restricted TLS runtime URL and the cutoff
above. `POD_SERVICE_ENABLED`, `POD_PRODUCTION_ENABLED`, `POD_OUTBOX_ENABLED`,
`PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED` are all false. The environment
change triggered deploy `dep-dbfls0o473hc73dlmjag`, which ended before build after
event `evt-dbfls138vfls739d82k0` reported exhausted pipeline minutes. Therefore the
live application has not consumed the Neon configuration and no hosting acceptance
is claimed. Full production preflight still requires the real bridge, operations and
signing authorities and an independently reachable verified-TLS runtime connection.

## First-time restricted account provisioning

The manual workflow now has a separate `provision_role` switch, default false.
Selecting both `apply` and `provision_role` creates a missing `pod_`-prefixed login
using the password already stored in POD_RUNTIME_DATABASE_URL (minimum 32 bytes).
Creation and schema migration share one transaction and advisory lock: a failed
migration rolls back the new account too. Passwords are stored as SCRAM hashes.
The account receives no administrator attributes or inherited role privileges;
only the existing POD table grants are applied. An existing account's password
is never rotated or overwritten. Elevated memberships block migration even when
NOINHERIT is set. Post-migration runtime/TLS/isolation checks remain mandatory.

Creating a live database identity and sharing the migration credential with the
protected GitHub environment are separate security-sensitive operations requiring
explicit authorization. This implementation does not grant that authorization,
change database network rules, provision live credentials, or enable production.

## Build-minute exhaustion and report-only commits

On October 14, 2026 at 17:34:49 UTC, Render explicitly canceled a build because
the workspace's current-period build pipeline minutes were exhausted. The last
verified live application commit remained 5180c243198afb6dfb05ee8d2e14995d4e7b0750.
Do not repeatedly trigger builds, increase spend limits, change plans, clear
caches or create replacement services to work around the quota. Its reset date
has not been verified. Test/merge evidence is not deployment evidence while blocked.

`scripts/pod_deploy_commit_policy.mjs` allows Render's documented `[skip render]`
commit marker only when every staged change is an exact allowlisted report path.
The provenance workflow uses it for its two generated JSON reports. POD completion,
implementation-status and free-deployment documentation are also allowlisted.
The watchdog and live deployment smoke workflows also use the staged policy.
Their exact observation paths, state/free-production-watchdog.json and
state/live-deployment-health.json, can skip a rebuild when every staged change is
allowlisted. The live receipt records a probe result; rebuilding identical
runtime bytes cannot make that result pass, and the next real application release
includes the repository copy. Other staged health, completion and operations
paths remain outside the allowlist. Any mixed commit retains normal deployment,
including state/content-control-health.json.
Observation-only commits still preserve failure status and repair routing; the
marker does not skip GitHub CI, approve a candidate or change publication gates.
The GitHub report can advance while its copy in the running container remains
old until the next actual deployment. No service setting or broad filter changes.
Unknown paths, application code, dependencies, templates, runtime health state,
media and mixed commits retain the normal deployment message. Rename detection
is disabled during inspection so moving application code into a report path cannot
hide its deletion. CI is not skipped. No broad build filters are applied.

For a genuinely documentation-only merge, its merge commit must also include
`[skip render]`; the branch commit's message alone does not control the merge.
Never add this marker to a release that changes application behavior. Reports
remain current in GitHub; skipping their deployment does not refresh metadata
inside an already-running container. A later actual release includes them.

This avoids unnecessary future builds; it does not replenish quota, repair the
production database, or establish any live POD acceptance. Official behavior:
https://render.com/docs/deploys#skipping-an-auto-deploy

## Market-proof migration and final release checks

Content Control PR #76 adds checksum-managed `003_pod.sql`. All five migration
checksums must match before preflight passes. Apply through the existing protected
manual database path only after authorized connectivity and role isolation are
available; do not run DDL from application startup or edit the 001/002 files.
The migration retains rank-proof references and makes market observations
append-only. It leaves historical missing proof unknown instead of backfilling
fabricated evidence. Intake clients must store source/image/rank artifacts before
sending their signed observations; see integrations/pod/MARKET_EVIDENCE.md.

PR #77 also requires `PodDB.assertPublishable(job)` in the executor. It rechecks
lease/fencing, account state and concept rights after upstream grant lookup.
Custom executors must not replace it with a permissive stub. Grant/QA expiry and
local kill switches are checked after the database wait; a disabled flag still
forces the existing dry-run path without claims or platform calls.

These migrations and checks passed disposable CI, not production acceptance.
The Render connector's latest reported attempt at 18:05 UTC on October 14 still
failed due to exhausted workspace build minutes. No successful deployment of
these repairs or production migration was verified. Do not enable production or
publication on the basis of merged code or synthetic tests.

## Financial reconciliation migration

`004_pod.sql` adds unique upstream financial-event identity. Preflight requires
001 through 004 with their exact checksums. Existing duplicate authority IDs
must fail migration; do not delete financial rows, rewrite IDs, drop immutability
triggers or mark the migration applied to work around the conflict. Investigate
through the owner's established upstream ledger reconciliation process.

Financial intake requires stable, verified line-level authority events, stored
statement evidence and exact replay semantics. Preserve original occurrence time,
including milliseconds; forecasts are not recorded income. The contract is
integrations/pod/FINANCIAL_EVIDENCE.md. These changes do not constitute actual
provider reconciliation or verified profit, and no production migration is
authorized merely by passing CI. Use the existing protected manual deployment
workflow only when its access, role and approval prerequisites are satisfied.

## Optional encrypted artifact recovery

The manual `scripts/pod_artifact_archive.mjs` command now provides bounded,
encrypted artifact-only export and atomic restore. See
integrations/pod/ARTIFACT_RECOVERY.md before configuring a separately held archive
key or retention destination. Restore requires both publication flags explicitly
false and the existing complete read-only preflight. No archive job or upload is
enabled by deployment. Do not place archives only on ephemeral Render storage.

This is not queue/account/ledger recovery, provider expiry extension, verified
independent backup retention or a completed production restoration drill. No live
archive key is generated, no secret is copied and no new resource is purchased.
An actual owner-authorized production backup and restore test remains required.


## Provider listing identity migration

Migration 005 prevents multiple jobs from claiming the same provider listing in
one platform/account. Preflight now requires checksums 001 through 005. A legacy
duplicate set fails the transaction; never delete history or change provider IDs
merely to make deployment pass. See integrations/pod/LISTING_EVIDENCE.md for exact
readback/replay semantics. Repeated observations retain evidence without counting
another publication. Apply only through the established protected migration path
with authorized connectivity; no network expansion or publication is enabled.

The October 14 deployment of 419a1e544206adf8aae92df692fd0de0825927b2 failed at
21:36:56 UTC; its 21:34:55 UTC log again reports exhausted build minutes. A queued
build or merged PR is not proof that quota or production readiness is restored.



## Dedicated POD state snapshots

The optional manual `scripts/pod_state_archive.mjs` command now adds consistent,
encrypted export and offline verification of all ten dedicated POD data tables,
plus atomic restore into an empty migrated target. It requires an existing
restricted connection, exact schema checksums and a separately retained archive
key. Restore requires preflight and all publication, production and outbox flags
explicitly false; accounts are disabled and in-flight work is held for recovery.
See integrations/pod/STATE_RECOVERY.md for limits and cutover requirements.

This adds queue/account/quota/inbox/outbox/financial-state recovery tooling beyond
the artifact-only archive. It is not a backup of Money Factory, credentials,
provider state or the entire PostgreSQL instance. No live backup, external
retention destination, replacement database, restore drill or expiry extension
is established by this implementation. Production acceptance remains open.
