# Enforced startup and observable worker state

POD service startup now runs the existing read-only deployment preflight before constructing PodDB or starting either worker. Missing checks, weak/shared upstream/QA/operations keys, privileged runtime roles, missing TLS, unexpected table grants, social-vault access, migration mismatch and expiring storage block the POD lane. The service owns pool shutdown; the preflight wrapper does not close a healthy service pool. No tables or credentials are created on startup.

The public status endpoint includes production_health with fixed codes, cycle count, last-start and last-completion timestamps, consecutive failures and the last production result. It exposes no job identifiers, inputs, database details or keys. Recovery failures and blocked production report RETRYING; an idle cycle reports IDLE, which is not successful asset production. Shutdown drains the worker and reports STOPPED. An in-flight operation has a start timestamp and no new completion timestamp, allowing an operator to distinguish a busy worker from a completed cycle. This is process-local health, not a durable uptime claim or an alert delivery service.

Authenticated JSON mutation requests are checked on their original bounded bytes
before any database method runs. Invalid UTF-8, a leading byte-order mark,
duplicate decoded keys at any depth (including escaped spellings), nonfinite
numeric overflow, malformed JSON and non-object/array roots fail with a fixed
`POD_REQUEST_INVALID` response. Parser errors, request bodies and stack traces
never cross the POD router's error boundary. Authentication still runs before
body parsing, so rejected unauthenticated bytes are not interpreted.

Verification added: each preflight failure independently blocks startup, incomplete/duplicate check evidence fails closed, pool ownership is preserved, recovery failures redact sensitive error details, and idle cycles cannot imply completed production. Twenty focused local Node tests passed. Production database access, independent rights/QA evidence and authorized marketplace submissions remain unverified; no publication switches were enabled.
