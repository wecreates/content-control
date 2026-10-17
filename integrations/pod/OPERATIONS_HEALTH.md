# Read-only POD health observations

The authenticated `GET /api/print/metrics` response keeps its queue, incident,
artifact-byte and financial-total fields, and adds a `health` observation. All
queries run in one PostgreSQL `REPEATABLE READ READ ONLY` transaction with a
two-second lock timeout and five-second per-statement timeout. It reads aggregate
values from dedicated POD tables only. It returns no job IDs, briefs, event
payloads, signing envelopes, connection URLs or raw errors.

Diagnostics deliberately do not call the write-side `db.active()` gate. An
already-initialized service can therefore report approaching/elapsed storage
expiry while production and other writes remain blocked. The runtime preflight,
production leases, grants and publication checks are unchanged. This endpoint
cannot extend expiry, enable workers, clear failures, approve content or publish.

| Observation | Threshold / meaning |
|---|---|
| STORAGE_EXPIRY_UNKNOWN | Missing/invalid configured expiry; critical |
| STORAGE_EXPIRED | Configured expiry reached; critical |
| STORAGE_EXPIRING | At most 24 hours remain; critical, matching the existing write block |
| STORAGE_EXPIRING_SOON | More than 24 hours but at most seven days remain; warning |
| ARTIFACT_BUDGET_UNKNOWN | Malformed deployment budget; critical, no fallback capacity claim |
| ARTIFACT_STORAGE_EXHAUSTED | Used bytes meet or exceed the configured budget; critical |
| ARTIFACT_STORAGE_LOW | At least 90% of budget used; warning |
| EXPIRED_WORKER_LEASES | Processing/publishing rows with expired leases; critical |
| OUTBOX_DELIVERY_OVERDUE | Undelivered feedback exists with oldest age at least 15 minutes; warning |

Counts, age and byte totals remain decimal strings, including values beyond
JavaScript's exact integer range. Capacity calculations use BigInt. Currency
totals remain separately grouped recorded amounts; they are not profit forecasts
or proof that the live upstream ledger has reconciled them. Queue counts distinguish
review holds from incidents. An old feedback event can reflect a deliberately
disabled outbox; investigate its actual runtime/configuration rather than assuming
a provider or authority outage. These observations do not send alerts to others.

`health.status` is CRITICAL, WARNING or NO_ALERTS. NO_ALERTS means only that these
specific thresholds were not reached. Every response carries
`scope: operational_snapshot_only`, `acceptance_verified: false` and
`publication_enabled: false`; it is never a completion certificate. The configured
expiry is an input, not a fresh provider API lookup. Worker process heartbeats
remain available in the existing `/status` response.

The production lifecycle rechecks its in-process POD_PRODUCTION_ENABLED flag
before lease recovery and after each awaited stage. Disabling it drains current
work and ends the loop as STOPPED; it does not keep recovering leases or record
late results as completed healthy cycles. Existing diagnostics are retained.
An already-started database operation or callback is not undone. Disabling during
the 15-second polling wait takes effect when that wait ends; call the lifecycle
stop method to abort the wait and propagate cooperative cancellation immediately.
Setting the flag back to true does not restart the stopped lifecycle. The host
must start a new one. This is not remote configuration polling, a live shutdown
drill or authorization to enable production or publication.

The dashboard preserves successful metrics even if the separate job-list request
is blocked. Its requests remain authenticated, same-origin, bounded and read-only;
session clearing and stale-response handling remain in effect.

## Manual diagnostics when startup is blocked

If preflight prevented service initialization, the HTTP metrics endpoint still
returns a sanitized 503 because it has no database pool. An authorized operator
with the existing restricted, verified-TLS POD_DATABASE_URL can run:

```sh
node scripts/pod_operations_snapshot.mjs
```

Use the existing protected environment for credentials, expiry and artifact budget;
never pass secrets as command arguments or commit them. This command creates only
a temporary connection pool, executes the same read-only queries, prints the
aggregate report, and closes the pool. It does not run migrations, service
preflight, workers, authority requests or publication, and does not change any
environment setting. Connection/query errors produce a fixed diagnostic without
database details. It cannot recover missing database access or change provider
network rules.

## Evidence boundary

Unit/DOM tests cover expiry/capacity boundaries, exact large counters, cleanup,
missing configuration and metrics preservation when job inspection fails.
Disposable PostgreSQL coverage verifies read-only enforcement, a consistent
snapshot across concurrent writes, redaction of fixture identities/payloads, and
continued refusal of write operations during the expiry window. Passing these
tests does not establish deployed phone acceptance, production monitoring,
available database access, retained backups or any of the 24 live acceptance areas.
