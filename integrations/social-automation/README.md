# Private social automation foundation

Status: implemented and unit tested; not activated in production. Publishing,
messages, ads, purchases, follows, and all external mutations are disabled.
The existing public dashboard serves readiness at `/api/social/runtime`.
It never accepts credentials or exposes the private store.

## Implemented

- AES-256-GCM authenticated encryption for grants, job payloads and results.
- Atomic file replacement and serialized updates within one store instance.
- Account identity verification through a provider adapter before connection.
- Read-only job allowlist, idempotency-key conflict detection, bounded retries,
  expiry checks, renewal hook, and explicit reauthorization state.
- Safe status projection excludes account IDs, tokens, payloads and results.
- Public readiness stays NOT_ACTIVATED until real activation wiring exists.

## Activation dependencies

This module is not an OAuth service or a deployed scheduler. It deliberately
has no public credential-ingestion or job-mutation endpoint. Before activation:

1. Configure owner authentication and provider developer applications with
   registered HTTPS callbacks, granted scopes, and any required app review.
2. Implement each provider's OAuth adapter: state and PKCE validation where
   applicable, code exchange, identity check, read operations, provider-specific
   renewal, revocation handling, pagination and quota handling. The separate
   official Instagram Python SDK probe does not yet implement this JS adapter.
3. Provision private durable storage. Render free ephemeral storage and the
   public repository/monitor backup are not acceptable credential storage.
   Keep the 32-byte hexadecimal SOCIAL_VAULT_KEY separate from the private
   absolute SOCIAL_VAULT_FILE. Never commit either value or the encrypted vault.
4. Run one owner-controlled worker/store instance with bounded provider network
   timeouts. This implementation has no cross-process locking or scheduler.
   Provider calls currently execute inside the transaction and must terminate.
5. Add authenticated private result consumption and validated evidence routing
   into existing Content Control and Money Factory workflows. Results alone do
   not establish full video/audio coverage or business performance.
6. Verify a live account read, expiry/renewal, worker restart and durable recovery
   before changing readiness to active. Keep external writes disabled.

Idempotency prevents repeated processing of a committed job in this store.
A crash after a provider read but before local commit can repeat that read.
This is not a claim of exactly-once external execution. Failed jobs stay blocked
until an owner-controlled recovery mechanism is implemented. The queue has a
1000-job capacity and no automatic archival policy yet.

No paid service is introduced. Free durable hosting availability has not been
verified; no infrastructure has been provisioned. Platform authorization may
expire or be revoked even after a successful initial login.

Run `npm run test:social` for runtime and HTTP boundary tests.
