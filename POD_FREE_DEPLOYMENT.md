# Free-tier deployment path

This is deployment tooling, not evidence of live production or marketplace publication.
Existing Render service: content-control-render-worker. Do not create a duplicate service.

## Runtime dependencies

`Dockerfile.pod` installs Node 22, Python 3.12, the pinned print libraries, English
Tesseract OCR, licensed DejaVu fonts, and FFmpeg. It runs as an unprivileged user.
The container gate builds this exact image, runs the real PostgreSQL/Python durable
review workflow, checks Python/OCR availability, and starts the existing web app.
All POD and publication switches default to false. No cloud credentials are supplied
when building or testing the image. Additional OCR languages require installation
and validation before jobs in those languages are enabled.

After the container gate passes, the existing Render service can use Docker runtime
with Dockerfile path `./Dockerfile.pod`. Preserve its environment variables, domain,
health path `/health`, free plan, and integrations. The existing Node configuration
in render.yaml is deliberately unchanged until this runtime transition is verified.
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
