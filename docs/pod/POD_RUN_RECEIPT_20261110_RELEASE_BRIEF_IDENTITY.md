# Final release brief and submission identity

The final local publishing guard already rechecks the durable manifest and
signed QA after artifact and authority waits. It now also requires the current
durable brief and idempotency key to match the claimed snapshot. JSON object
ordering is immaterial; changed brief content or a different key is not.

The publisher rejects a contradictory claim whose row job, account or platform
disagrees with the brief before it invokes artifact, grant, adapter or settlement
callbacks. An inconsistent identity is left for existing durable lease recovery
instead of settling a potentially unrelated job.

Two focused tests reproduced missing rejections on the prior main tree. The
disposable PostgreSQL regression changes the stored brief and key independently,
requires both stale reads to fail, then restores the original values and verifies
that the guard can succeed. Fixture adapters do not make provider requests.

This is regression evidence for publication safeguards, not live acceptance.
No production SQL, live authority, provider call or publication activation is
part of the verification.
