# Free-tier deployment path

This is deployment tooling, not evidence of live production or marketplace publication.
Existing Render service: content-control-render-worker. Do not create a duplicate service.

## Runtime dependencies

`Dockerfile` installs Node 22, Python 3.12, the pinned print libraries, English
Tesseract OCR, licensed DejaVu fonts, and FFmpeg. It runs as an unprivileged user.
The container gate builds this exact image, runs the real PostgreSQL/Python durable
review workflow, checks Python/OCR availability, and starts the existing web app.
All POD and publication switches default to false. No cloud credentials are supplied
when building or testing the image. Additional OCR languages require installation
and validation before jobs in those languages are enabled.

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
- POD_STORAGE_EXPIRES_AT: actual provider expiry, never a fictitious future date.

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
worker. The inspected database expires October 26, 2026. Migration does not extend
that expiry. An approved durable storage/backup arrangement is still required before
relying on this database for ongoing production. No paid resources are created here.

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

Content Control PR #76 adds checksum-managed `003_pod.sql`. All four migration
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

