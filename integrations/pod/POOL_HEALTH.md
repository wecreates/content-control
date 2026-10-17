# Idle database connection failures

Every pool created by createPodPool installs its error listener before it can
connect. An idle backend disconnect is handled without logging driver errors,
connection URLs, client objects or database contents. The pg driver removes the
failed idle client; later acquisition can create a replacement under the existing
two-connection cap, verified TLS and connection/query deadlines.

The service status includes database_health with a bounded cumulative
idle_connection_failures count, last_idle_connection_failure_at and the fixed
POD_DATABASE_IDLE_CONNECTION_FAILED code. Snapshots contain no raw errors and
cannot reset the counter. This is incident history, not a current availability
probe; zero incidents does not mean the database is configured or healthy. The
history is process-local and resets on restart. Disabled services have null
database_health. Persisted queue/retry diagnostics and actual recovery drills
remain separate requirements.

This handler neither retries a failed transaction nor authorizes a job. Active
query errors, lease/fencing checks, storage expiry and all approval checks retain
their existing behavior. No production session is terminated or TLS weakened.
The recovery regression terminates only its own disposable CI backend and verifies
a different backend answers the next query. It is not a production failover test.

Driver semantics: https://node-postgres.com/apis/pool#error
