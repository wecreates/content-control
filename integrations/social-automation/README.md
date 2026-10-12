# Private social automation

Status: read worker and Instagram metadata adapter implemented and tested with
mock provider responses; live account authorization is not verified. Hosted
startup is off by default. Publishing, messages, ads, purchases and follows are
always disabled. `/api/social/runtime` reports the actual worker state without
returning credentials, account IDs, results, or job payloads.

## Implemented

- AES-256-GCM encryption for grants, job payloads and results, atomic file
  replacement, file sync and exclusive writer lock across store instances.
- Account identity verification before connection, plus identity recheck on
  each Instagram media read. Jobs bind to the account present at enqueue time.
- Read-only job allowlist, duplicate-key conflict detection, three-attempt
  retry budget, expiry checks, renewal hook and reauthorization state.
- Recurring worker: one media job per account per six-hour slot; retry processing
  every minute. Concurrent cycles are coalesced; saved jobs survive restart.
- Instagram API with Facebook Login adapter, pinned Graph v26.0, GET only,
  fixed host, no redirects, 20-second timeout, bounded response body, one page
  of up to five media metadata items. Paging URLs and unknown fields are dropped.
- Existing server initializes the service and stops it during shutdown.
- `npm run social:read-once` executes one owner-controlled cycle against an
  existing encrypted vault. It never imports grants or prints private results.

## Activation dependencies

No new infrastructure or paid service was provisioned. Current Render storage
has not been independently verified as private and durable. Activation needs:

1. Provider developer application, owner login, registered HTTPS callback,
   approved scopes and a secure OAuth onboarding implementation. No public
   credential-ingestion endpoint exists. Do not put credentials in chat.
2. A verified grant in the private encrypted store. `SocialAutomation.connect`
   verifies identity but is an internal interface, not an OAuth login flow.
   The current Instagram adapter requires the authorized professional account
   and Facebook Login route; it cannot access arbitrary private reels.
3. Private durable storage outside the application/repository tree, with a
   vault file accessible only to its owner. Configure SOCIAL_VAULT_FILE and the
   separate 32-byte hexadecimal SOCIAL_VAULT_KEY via hosted secret management.
   The public repository and monitor backup must never store the vault.
4. Only after storage and grants are ready, explicitly set
   SOCIAL_STORAGE_MODE=private_durable and SOCIAL_WORKER_ENABLED=true.
   This is operator configuration, not proof of durability: the public status
   continues to report durable_storage_verified=false. Missing, broad-permission,
   in-repository or locked vaults block startup without a fallback.
5. Add provider-specific OAuth renewal. The Instagram Facebook Login adapter
   currently has no refresh method; grants within 24 hours of expiry require
   reauthorization. No automatic renewal is claimed for Instagram.
6. Connect private result consumption to evidence-validated production routing.
   Metadata reads alone do not constitute video retrieval, full audio/video
   analysis, competitive review or business-performance evidence.

Other platform adapters and owner-facing OAuth onboarding remain unimplemented.
No live account or hosted durability/recovery test has passed yet.

## Recovery and execution limits

A failed process may leave `vault.lock`. The service deliberately refuses to
remove it automatically. An operator must stop all workers, confirm none still
owns the vault, inspect the failure, then remove the stale lock. Do not run
multiple hosted workers. Graceful shutdown aborts pending provider requests before stopping the worker.
A forced process termination can still leave a stale lock; it fails closed.

A crash after a provider read but before local commit can repeat that read.
Idempotency is not an exactly-once external execution guarantee. Legacy jobs
without account binding are blocked instead of being reassigned. The queue
holds at most 1000 jobs; archival and owner-controlled blocked-job recovery are
not yet implemented. Provider calls execute inside the transaction, so all
adapters must have bounded network timeouts. This adapter does.

Tests: `npm run test:social`. The existing social integration CI runs the worker,
HTTP boundary, Opus and Watch bridge tests. Mock tests do not prove live access.

Primary API reference: Meta's official Instagram API collection:
https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
Existing independent SDK probe: `scripts/instagram_official_read.py`.
