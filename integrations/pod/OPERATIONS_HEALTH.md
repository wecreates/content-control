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
The observation clock must be an exact, nonnegative safe integer within
JavaScript's supported date range; malformed clock state fails with the fixed
`OPERATIONAL_CLOCK_INVALID` error. The configured expiry has the same exact
timestamp contract. Invalid expiry remains observable as critical
`STORAGE_EXPIRY_UNKNOWN` rather than being normalized into a plausible date.

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

`POD_STORAGE_EXPIRES_AT` must use canonical UTC text:
`YYYY-MM-DDTHH:mm:ssZ` or the exact `Date#toISOString()` millisecond form.
Date-only values, offsets, alternate separators, normalized fractional precision
and surrounding whitespace remain unknown or block activation/deployment. This
prevents permissive `Date.parse` normalization from extending a retention claim.

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
session clearing and stale-response handling remain in effect. Before identity,
acceptance or activity fields are used, the original response bytes must be strict
UTF-8 JSON without a leading byte-order mark, duplicate decoded keys or nonfinite
numeric overflow. Invalid responses are redacted and cannot reach artifact fetch
or preview rendering. Package inspection also binds the stored queue marketplace
to the manifest marketplace and the five supported platforms before artifact
access; mismatched or excluded-marketplace records cannot render or export.

The owner job list and the release-ready list apply the storage-lifetime gate
both before and after their database query. If retention crosses the safety
cutoff during a wait, neither list returns rows. The aggregate health query is
the deliberate exception described above so it can still report the expiry.
Review-package and artifact reads also recheck after the database wait and after
stored-manifest/artifact validation, so validation that crosses the cutoff
cannot return a held manifest or bytes.
Authenticated review-package, review-artifact and owner job-list endpoints map
that exact cutoff to sanitized HTTP 503 `POD_STORAGE_UNAVAILABLE`. They retain
their existing redacted 404/409 responses for unrelated lookup or validation
failures, so an operations outage is actionable without disclosing record state.
The same exact-only mapping applies to authenticated artifact upload, repair,
review acceptance, market/listing/financial evidence, concept intake and queue
creation routes. `POD_STORAGE_EXPIRING` returns sanitized HTTP 503
`POD_STORAGE_UNAVAILABLE`; signature, scope, validation, budget and record-state
failures retain their existing redacted HTTP 409 responses.

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
